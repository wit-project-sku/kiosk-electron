import type { WeatherSnapshot } from '@shared/types/weather';
import { createLogger } from '@main/core/logger';
import type { LocalCacheService } from './LocalCacheService';

const log = createLogger('weather-service');

/** Insadong, Seoul (matches the provided OpenWeatherMap query). */
const LAT = 37.5744;
const LON = 126.9849;

/** Refetch interval. 30 min keeps us well within OpenWeatherMap's free tier. */
const REFRESH_MS = 30 * 60 * 1000;

/** local_cache key for offline-first persistence of the last snapshot. */
const CACHE_KEY = 'weather';

type WeatherListener = (snapshot: WeatherSnapshot) => void;

/** Subset of the OpenWeatherMap `/data/2.5/weather` response we consume. */
interface OwmResponse {
  name: string;
  main: { temp: number; feels_like: number; humidity: number };
  wind: { speed: number };
  weather: { main: string; description: string; icon: string }[];
}

/**
 * Fetches current weather from OpenWeatherMap, caches it locally, and refreshes
 * every 30 minutes. All network lives here in the main process; the renderer
 * only ever reads the cached snapshot via IPC. The API key is read from
 * `OPENWEATHER_API_KEY` (see `.env.example`).
 */
export class WeatherService {
  private current: WeatherSnapshot | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private warnedNoKey = false;
  private readonly listeners = new Set<WeatherListener>();

  constructor(private readonly cache: LocalCacheService) {}

  /** Hydrate from cache for an instant first paint, then begin polling. */
  start(): void {
    const cached = this.cache.get(CACHE_KEY);
    const data = cached?.data as Partial<WeatherSnapshot> | undefined;
    if (data && typeof data.tempC === 'number') {
      this.current = data as WeatherSnapshot;
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

  subscribe(listener: WeatherListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    if (!this.current) return;
    for (const listener of this.listeners) listener(this.current);
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

    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${LAT}&lon=${LON}&units=metric&lang=en&appid=${apiKey}`;

    try {
      const res = await fetch(url);
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
}
