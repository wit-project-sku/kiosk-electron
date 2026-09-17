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
 * One named place's numbers for one day, as drawn by ONE column of the 제주
 * 날씨 panel: a single glyph and that place's low/high.
 *
 * One glyph, not the two {@link WeatherDayForecast} carries: the panel's columns
 * are PLACES now rather than halves of the day, so each cell has room for a
 * single reading. See `toSiteDay` in WeatherService for which reading that is.
 */
export interface WeatherSiteDay {
  /** Local calendar date at the site, `YYYY-MM-DD`. */
  date: string;
  /** Lowest temperature forecast for the day in °C (rounded). */
  minC: number;
  /** Highest temperature forecast for the day in °C (rounded). */
  maxC: number;
  /** OpenWeatherMap icon code for the day, e.g. "10d". */
  icon: string;
  /** Condition group behind {@link icon}, e.g. "Rain" (glyph fallback). */
  main: string;
}

/**
 * One column of the 제주 날씨 panel — a named place and its outlook.
 *
 * The place is identified by {@link id} and NOT by a name: the drawn label is in
 * the visitor's language and lives with the panel's other authored strings (see
 * SITE_LABELS in JejuWeatherPanel), while `city` is only ever OpenWeatherMap's
 * own answer, kept for logs.
 */
export interface WeatherSiteForecast {
  /** Stable key from `JEJU_WEATHER_SITES` — e.g. `'jeju-si'`. */
  id: string;
  /** OpenWeatherMap's resolved city name. Diagnostic; never drawn. */
  city: string;
  /** Today first, then each following local date — same window as `days`. */
  days: WeatherSiteDay[];
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
  /**
   * Per-place outlook for the 제주 날씨 panel's 제주시 / 서귀포시 / 성산
   * columns (Figma 6516:74521), in `JEJU_WEATHER_SITES` order.
   *
   * ★ OPTIONAL, and legitimately absent in three cases — a non-제주 kiosk (no
   * other layout draws this panel, so nothing fetches them), a cache row written
   * before this field existed, and a refresh where every site failed. The panel
   * draws its columns empty rather than borrowing {@link days}: those are the
   * KIOSK's own coordinates, which are none of the three places the column
   * headers name.
   */
  sites?: WeatherSiteForecast[];
}
