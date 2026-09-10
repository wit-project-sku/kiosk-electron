import type {
  WeatherDayForecast,
  WeatherForecast,
  WeatherSiteDay,
  WeatherSiteForecast,
  WeatherSnapshot,
} from '@shared/types/weather';
import type { KioskId } from '@shared/types/kiosk';
import { createLogger } from '@main/core/logger';
import {
  getKioskCoordinates,
  getKioskLayout,
  isJejuLayout,
  type GeoCoordinates,
} from '@shared/config/kioskLocations';
import { JEJU_WEATHER_SITES, type WeatherSite } from '@shared/config/weatherSites';
import type { KioskService } from './KioskService';
import type { LocalCacheService } from './LocalCacheService';

const log = createLogger('weather-service');

/** Refetch interval. 30 min keeps us well within OpenWeatherMap's free tier. */
const REFRESH_MS = 30 * 60 * 1000;

/** local_cache key for offline-first persistence of the last snapshot. */
const CACHE_KEY = 'weather';

/** local_cache key for the multi-day outlook (separate row, same refresh tick). */
const FORECAST_CACHE_KEY = 'weather_forecast';

/** Rows the 제주 weather panel draws: 오늘 · 내일 · four weekdays. */
const FORECAST_DAYS = 6;

type WeatherListener = (snapshot: WeatherSnapshot) => void;
type ForecastListener = (forecast: WeatherForecast) => void;

/** Subset of the OpenWeatherMap `/data/2.5/weather` response we consume. */
interface OwmResponse {
  name: string;
  main: { temp: number; feels_like: number; humidity: number };
  wind: { speed: number };
  weather: { main: string; description: string; icon: string }[];
}

/** Subset of the OpenWeatherMap `/data/2.5/forecast` (5 day / 3 hour) response. */
interface OwmForecastResponse {
  list: {
    /** Unix seconds, UTC. */
    dt: number;
    main: { temp: number; temp_min: number; temp_max: number };
    weather: { main: string; description: string; icon: string }[];
  }[];
  /** `timezone` is the city's UTC offset in seconds (32400 for 제주). */
  city: { name: string; timezone: number };
}

/** Working accumulator — one per local date, folded into a WeatherDayForecast. */
interface DayBucket {
  date: string;
  minC: number;
  maxC: number;
  /** Best morning/afternoon slot so far: distance from the target hour + entry. */
  morning: { distance: number; icon: string; main: string } | null;
  afternoon: { distance: number; icon: string; main: string } | null;
}

/** The hour each half-day glyph is meant to represent (mid-morning / mid-afternoon). */
const MORNING_HOUR = 9;
const AFTERNOON_HOUR = 15;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Folds the 3-hourly list into one bucket per LOCAL calendar date.
 *
 * The kiosk sits in the same timezone as the forecast city, but deriving the
 * date from the host clock would silently break on a mis-set kiosk — so the
 * local wall clock is reconstructed from `dt + city.timezone` and read with the
 * UTC getters, which is exact regardless of what the machine thinks the time is.
 */
function bucketByLocalDate(json: OwmForecastResponse): DayBucket[] {
  const offsetMs = (json.city?.timezone ?? 0) * 1000;
  const buckets = new Map<string, DayBucket>();

  for (const entry of json.list ?? []) {
    const local = new Date(entry.dt * 1000 + offsetMs);
    const date =
      `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())}`;
    const hour = local.getUTCHours();
    const w = entry.weather?.[0];
    const icon = w?.icon ?? '';
    const main = w?.main ?? '';

    let bucket = buckets.get(date);
    if (!bucket) {
      bucket = {
        date,
        minC: entry.main.temp_min,
        maxC: entry.main.temp_max,
        morning: null,
        afternoon: null,
      };
      buckets.set(date, bucket);
    }

    bucket.minC = Math.min(bucket.minC, entry.main.temp_min);
    bucket.maxC = Math.max(bucket.maxC, entry.main.temp_max);

    // Each half-day keeps the reading closest to its representative hour, so a
    // day that only starts at 18:00 (today, fetched late) still gets a glyph.
    const slot = hour < 12 ? 'morning' : 'afternoon';
    const distance = Math.abs(hour - (slot === 'morning' ? MORNING_HOUR : AFTERNOON_HOUR));
    const held = bucket[slot];
    if (!held || distance < held.distance) bucket[slot] = { distance, icon, main };
  }

  return [...buckets.values()];
}

/** The query string both endpoints take, for one point on the map. */
const weatherQuery = ({ lat, lon }: GeoCoordinates, apiKey: string): string =>
  `lat=${lat}&lon=${lon}&units=metric&lang=en&appid=${apiKey}`;

/**
 * One bucket as ONE column-cell of the 제주 날씨 panel — the day's low/high and
 * a SINGLE glyph, where {@link WeatherDayForecast} keeps two.
 *
 * Afternoon first, morning as the fallback. The panel's columns are places now
 * rather than halves of the day, so each cell has room for one reading, and the
 * 15:00 slot is the one a multi-day outlook is conventionally summarised by.
 * The fallback is not hypothetical: the last date in the 120-hour window is
 * often reached in the morning only, and today's bucket has no morning left in
 * it after noon.
 */
function toSiteDay(bucket: DayBucket): WeatherSiteDay {
  const slot = bucket.afternoon ?? bucket.morning;
  return {
    date: bucket.date,
    minC: Math.round(bucket.minC),
    maxC: Math.round(bucket.maxC),
    icon: slot?.icon ?? '',
    main: slot?.main ?? '',
  };
}

/**
 * Fetches current weather and the 5-day/3-hour outlook from OpenWeatherMap,
 * caches both locally, and refreshes every 30 minutes. All network lives here in
 * the main process; the renderer only ever reads the cached values via IPC. The
 * API key is read from `OPENWEATHER_API_KEY` (see `.env.example`) — the same key
 * serves both endpoints, so the outlook needs no new credential.
 */
export class WeatherService {
  private current: WeatherSnapshot | null = null;
  private forecast: WeatherForecast | null = null;
  /**
   * Last good outlook per 제주 site, held across refreshes so ONE site failing
   * keeps its column instead of blanking it — the same "keep the last outlook"
   * rule the whole-forecast fetch follows, applied per column.
   */
  private siteForecasts: WeatherSiteForecast[] | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private warnedNoKey = false;
  private readonly listeners = new Set<WeatherListener>();
  private readonly forecastListeners = new Set<ForecastListener>();

  constructor(
    private readonly cache: LocalCacheService,
    private readonly kiosk: KioskService,
  ) {}

  /** Hydrate from cache for an instant first paint, then begin polling. */
  start(): void {
    const cached = this.cache.get(CACHE_KEY);
    const data = cached?.data as Partial<WeatherSnapshot> | undefined;
    if (data && typeof data.tempC === 'number') {
      this.current = data as WeatherSnapshot;
    }
    const cachedForecast = this.cache.get(FORECAST_CACHE_KEY);
    const forecastData = cachedForecast?.data as Partial<WeatherForecast> | undefined;
    if (forecastData && Array.isArray(forecastData.days) && forecastData.days.length > 0) {
      this.forecast = forecastData as WeatherForecast;
      // A row cached before `sites` existed simply has none; the panel draws its
      // columns empty until the first refresh fills them.
      if (Array.isArray(forecastData.sites) && forecastData.sites.length > 0) {
        this.siteForecasts = forecastData.sites as WeatherSiteForecast[];
      }
    }
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getCurrent(): WeatherSnapshot | null {
    return this.current;
  }

  getForecast(): WeatherForecast | null {
    return this.forecast;
  }

  subscribe(listener: WeatherListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeForecast(listener: ForecastListener): () => void {
    this.forecastListeners.add(listener);
    return () => {
      this.forecastListeners.delete(listener);
    };
  }

  private emit(): void {
    if (!this.current) return;
    for (const listener of this.listeners) listener(this.current);
  }

  private emitForecast(): void {
    if (!this.forecast) return;
    for (const listener of this.forecastListeners) listener(this.forecast);
  }

  private async refresh(): Promise<void> {
    const apiKey = process.env['OPENWEATHER_API_KEY'];
    if (!apiKey) {
      if (!this.warnedNoKey) {
        log.warn('OPENWEATHER_API_KEY not set; weather disabled. See .env.example');
        this.warnedNoKey = true;
      }
      return;
    }

    // Coordinates follow the running kiosk's physical location (화성휴게소 for W005,
    // 오색시장 for W004, Insadong otherwise) — derived from the provisioned kioskId.
    const kioskId = this.kiosk.getConfig().kioskId;
    const query = weatherQuery(getKioskCoordinates(kioskId), apiKey);

    /*
     * Three independent fetches: a failing outlook must not drop the current
     * snapshot the home card reads, and vice versa; the 제주 site columns are a
     * third that must not take either of them down.
     *
     * Cost, since this is now up to five calls rather than two: on a 제주 kiosk
     * that is 5 every 30 min = 240/day, against OpenWeatherMap's free tier of
     * 60/minute and 1M/month. Everywhere else it stays at 2.
     */
    const [, outlook, sites] = await Promise.all([
      this.refreshCurrent(query),
      this.fetchOutlook(query),
      this.fetchSites(apiKey, kioskId),
    ]);

    if (sites) this.siteForecasts = sites;
    /*
     * Published once, after BOTH have settled, so the panel never paints a frame
     * carrying this refresh's days beside the previous refresh's columns.
     *
     * The second branch is the outlook failing while the sites answered: the
     * columns are the whole panel now, so they are still worth publishing
     * against the days we already hold rather than being dropped for a fetch
     * nothing currently draws.
     */
    if (outlook) this.publishForecast(outlook.days, outlook.city);
    else if (sites && this.forecast) {
      this.publishForecast(this.forecast.days, this.forecast.city);
    }
  }

  /**
   * The 제주 날씨 panel's three columns, or null off 제주 / when every site
   * failed. No other layout draws the panel, so no other kiosk pays for these.
   *
   * A site that answers replaces its column; a site that does not keeps the one
   * it had, so a single flaky request cannot blank a column that was fine a
   * moment ago. The order is `JEJU_WEATHER_SITES`', which is the order the frame
   * draws 제주시 · 서귀포시 · 성산 in.
   */
  private async fetchSites(
    apiKey: string,
    kioskId: KioskId,
  ): Promise<WeatherSiteForecast[] | null> {
    if (!isJejuLayout(getKioskLayout(kioskId))) return null;

    const fetched = await Promise.all(
      JEJU_WEATHER_SITES.map((site) => this.fetchSite(site, apiKey)),
    );
    const held = new Map((this.siteForecasts ?? []).map((s) => [s.id, s]));
    const sites = JEJU_WEATHER_SITES.map(
      (site, i) => fetched[i] ?? held.get(site.id) ?? null,
    ).filter((s): s is WeatherSiteForecast => s !== null);

    if (sites.length === 0) {
      log.warn('Weather site outlook empty for every 제주 site (keeping last columns)');
      return null;
    }
    return sites;
  }

  /** One site's outlook, or null when it could not be fetched or was unusable. */
  private async fetchSite(site: WeatherSite, apiKey: string): Promise<WeatherSiteForecast | null> {
    try {
      const url = `https://api.openweathermap.org/data/2.5/forecast?${weatherQuery(site.coordinates, apiKey)}`;
      const res = await fetch(url);
      if (!res.ok) {
        log.warn('Weather site fetch returned non-OK', { site: site.id, status: res.status });
        return null;
      }
      const json = (await res.json()) as OwmForecastResponse;
      const days = bucketByLocalDate(json).slice(0, FORECAST_DAYS).map(toSiteDay);
      if (days.length === 0) {
        log.warn('Weather site had no usable entries', { site: site.id });
        return null;
      }
      return { id: site.id, city: json.city?.name ?? site.name, days };
    } catch (error) {
      log.warn('Weather site fetch failed', { site: site.id }, error);
      return null;
    }
  }

  /**
   * Compose, cache and emit. Split out of the outlook fetch because the outlook
   * and the site columns arrive separately and both have to land in ONE
   * `WeatherForecast` — the renderer sees a single object.
   */
  private publishForecast(days: WeatherDayForecast[], city: string): void {
    const forecast: WeatherForecast = {
      days,
      city,
      fetchedAt: new Date().toISOString(),
      ...(this.siteForecasts ? { sites: this.siteForecasts } : {}),
    };
    this.forecast = forecast;
    this.cache.upsert(
      FORECAST_CACHE_KEY,
      forecast as unknown as Record<string, unknown>,
      'weather',
    );
    this.emitForecast();
    log.info('Weather forecast updated', {
      days: days.length,
      sites: this.siteForecasts?.length ?? 0,
    });
  }

  private async refreshCurrent(query: string): Promise<void> {
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?${query}`);
      if (!res.ok) {
        log.warn('Weather fetch returned non-OK', { status: res.status });
        return;
      }
      const json = (await res.json()) as OwmResponse;
      const w = json.weather?.[0];
      const snapshot: WeatherSnapshot = {
        tempC: Math.round(json.main.temp),
        feelsLikeC: Math.round(json.main.feels_like),
        main: w?.main ?? '',
        description: w?.description ?? '',
        icon: w?.icon ?? '',
        humidity: json.main.humidity,
        windSpeed: json.wind?.speed ?? 0,
        city: json.name ?? '',
        fetchedAt: new Date().toISOString(),
      };
      this.current = snapshot;
      this.cache.upsert(CACHE_KEY, snapshot as unknown as Record<string, unknown>, 'weather');
      this.emit();
      log.info('Weather updated', { tempC: snapshot.tempC, main: snapshot.main });
    } catch (error) {
      log.warn('Weather fetch failed (keeping last snapshot)', error);
    }
  }

  /**
   * The KIOSK's own multi-day outlook — fetched, not published: `refresh` lands
   * it and the site columns in one object (see {@link publishForecast}).
   *
   * ★ Nothing currently DRAWS these days. The 제주 날씨 panel was their only
   * consumer and its 2026-09-09 redraw moved it onto `sites`, so this is now the
   * general-purpose outlook rather than one screen's data source. It is kept
   * because it is the only outlook the other seven venues have, and because a
   * cached row without it fails this service's own hydration check.
   */
  private async fetchOutlook(
    query: string,
  ): Promise<{ days: WeatherDayForecast[]; city: string } | null> {
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?${query}`);
      if (!res.ok) {
        log.warn('Weather forecast fetch returned non-OK', { status: res.status });
        return null;
      }
      const json = (await res.json()) as OwmForecastResponse;

      // 40 entries × 3h = 120h ahead, which straddles six local dates whenever
      // the fetch lands after 00:00. The 제주 panel draws seven rows; the seventh
      // is a date-only placeholder when the window does not reach it.
      const days: WeatherDayForecast[] = bucketByLocalDate(json)
        .slice(0, FORECAST_DAYS)
        .map((bucket) => {
          // A half-day with no readings (today, fetched after noon) borrows the
          // other half's glyph rather than leaving a hole in the row.
          const morning = bucket.morning ?? bucket.afternoon;
          const afternoon = bucket.afternoon ?? bucket.morning;
          return {
            date: bucket.date,
            minC: Math.round(bucket.minC),
            maxC: Math.round(bucket.maxC),
            morningIcon: morning?.icon ?? '',
            morningMain: morning?.main ?? '',
            afternoonIcon: afternoon?.icon ?? '',
            afternoonMain: afternoon?.main ?? '',
          };
        });

      if (days.length === 0) {
        log.warn('Weather forecast had no usable entries (keeping last outlook)');
        return null;
      }

      return { days, city: json.city?.name ?? '' };
    } catch (error) {
      log.warn('Weather forecast fetch failed (keeping last outlook)', error);
      return null;
    }
  }
}
