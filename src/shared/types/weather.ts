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
