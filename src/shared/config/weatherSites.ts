/**
 * The three 제주 places the 날씨 panel draws a column for — Figma 6516:74521
 * (제주>홈-날씨), whose column heads read 제주시 · 서귀포시 · 성산.
 *
 * ── Why these are not kiosk coordinates ──────────────────────────────
 * Every other weather query in the app follows the machine (see
 * `KioskLocation.coordinates`): the home card's snapshot is the weather where
 * the visitor is standing. This list is the opposite — it is a REGIONAL outlook
 * for the island, drawn identically on all three 제주 kiosks, and none of the
 * three entries is any kiosk's own position. 제주공항 (W006) sits ~5km from the
 * 제주시 point below and 세계자연유산본부 (W008) ~25km from it, so feeding a
 * kiosk's own forecast into a column headed 제주시 would put a number under a
 * name that did not produce it.
 *
 * That is also why the panel leaves a column blank rather than falling back to
 * `WeatherForecast.days` — see the note on `WeatherForecast.sites`.
 *
 * ── Precision ────────────────────────────────────────────────────────
 * Weather-grade, like the kiosk coordinates: OpenWeatherMap resolves these to
 * its own grid, so being within a kilometre of the place the name means is
 * enough. The points are the two city halls and 성산읍 (the 성산일출봉 side of
 * the island), which is what the three names are conventionally forecast for on
 * KMA regional outlooks.
 */
import type { GeoCoordinates } from './kioskLocations';

/** Stable key for one column. Drawn labels live in the panel, not here. */
export type WeatherSiteId = 'jeju-si' | 'seogwipo-si' | 'seongsan';

export interface WeatherSite {
  id: WeatherSiteId;
  /** Korean name of the place, for logs. The drawn label is per-language. */
  name: string;
  coordinates: GeoCoordinates;
}

/**
 * In the order the frame draws them, left to right. The panel maps its columns
 * off this array by index, so re-ordering it re-orders the panel — which is the
 * intent; adding a fourth entry would need the panel's column geometry too.
 */
export const JEJU_WEATHER_SITES: readonly WeatherSite[] = [
  { id: 'jeju-si', name: '제주시', coordinates: { lat: 33.4996, lon: 126.5312 } },
  { id: 'seogwipo-si', name: '서귀포시', coordinates: { lat: 33.2541, lon: 126.5601 } },
  { id: 'seongsan', name: '성산', coordinates: { lat: 33.4589, lon: 126.937 } },
] as const;
