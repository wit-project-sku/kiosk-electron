/**
 * Current weather snapshot, sourced from OpenWeatherMap in the main process and
 * cached locally. Never fetched from the renderer (network stays in main).
 */
export interface WeatherSnapshot {
  /** Temperature in °C (rounded). */
  tempC: number;
  /** "Feels like" temperature in °C (rounded). */
  feelsLikeC: number;
  /** Short condition group, e.g. "Clouds". */
  main: string;
  /** Human description, e.g. "broken clouds". */
  description: string;
  /** OpenWeatherMap icon code, e.g. "04d". */
  icon: string;
  /** Relative humidity (%). */
  humidity: number;
  /** Wind speed (m/s). */
  windSpeed: number;
  /** Resolved city name. */
  city: string;
  /** ISO timestamp of when this snapshot was fetched. */
  fetchedAt: string;
}

/**
 * One day of the multi-day outlook, as drawn by the 제주 weather panel: a
 * morning glyph, an afternoon glyph and the day's low/high.
 */
export interface WeatherDayForecast {
  /** Local calendar date at the kiosk, `YYYY-MM-DD`. */
  date: string;
  /** Lowest temperature forecast for the day in °C (rounded). */
  minC: number;
  /** Highest temperature forecast for the day in °C (rounded). */
  maxC: number;
  /** OpenWeatherMap icon code standing in for 00:00–11:59, e.g. "10d". */
  morningIcon: string;
  /** Condition group behind {@link morningIcon}, e.g. "Rain" (glyph fallback). */
  morningMain: string;
  /** OpenWeatherMap icon code standing in for 12:00–23:59. */
  afternoonIcon: string;
  /** Condition group behind {@link afternoonIcon}. */
  afternoonMain: string;
}

/**
 * Multi-day outlook derived from OpenWeatherMap's 5-day/3-hour endpoint, cached
 * next to the current snapshot. Like {@link WeatherSnapshot} it is fetched only
 * in the main process; the renderer reads the cached value over IPC.
 */
export interface WeatherForecast {
  /** Today first, then each following local date — at most six from the API. */
  days: WeatherDayForecast[];
  /** Resolved city name. */
  city: string;
  /** ISO timestamp of when this outlook was fetched. */
  fetchedAt: string;
}
