import type {
  WeatherDayForecast,
  WeatherForecast,
  WeatherSnapshot,
} from '@shared/types/weather';
import { createLogger } from '@main/core/logger';
import { getKioskCoordinates } from '@shared/config/kioskLocations';
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
    const { lat, lon } = getKioskCoordinates(this.kiosk.getConfig().kioskId);
    const query = `lat=${lat}&lon=${lon}&units=metric&lang=en&appid=${apiKey}`;

    // The two calls are independent: a failing outlook must not drop the current
    // snapshot the home card reads, and vice versa.
    await Promise.all([this.refreshCurrent(query), this.refreshForecast(query)]);
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

  private async refreshForecast(query: string): Promise<void> {
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?${query}`);
      if (!res.ok) {
        log.warn('Weather forecast fetch returned non-OK', { status: res.status });
        return;
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
        return;
      }

      const forecast: WeatherForecast = {
        days,
        city: json.city?.name ?? '',
        fetchedAt: new Date().toISOString(),
      };
      this.forecast = forecast;
      this.cache.upsert(
        FORECAST_CACHE_KEY,
        forecast as unknown as Record<string, unknown>,
        'weather',
      );
      this.emitForecast();
      log.info('Weather forecast updated', { days: days.length });
    } catch (error) {
      log.warn('Weather forecast fetch failed (keeping last outlook)', error);
    }
  }
}
