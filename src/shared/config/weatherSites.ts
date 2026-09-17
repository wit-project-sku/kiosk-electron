/**
 * The places a 날씨 panel draws a column for — one list per venue family.
 *
 *   제주   Figma 6516:74521 (제주>홈-날씨): 제주시 · 서귀포시 · 성산
 *   인사동  the same panel on the Insadong home: 종로구 · 중구 · 강남구
 *
 * ── Why these are not kiosk coordinates ──────────────────────────────
 * Every other weather query in the app follows the machine (see
 * `KioskLocation.coordinates`): the home card's snapshot is the weather where
 * the visitor is standing. These lists are the opposite — a REGIONAL outlook,
 * drawn identically on every kiosk of the family, and none of the entries is
 * any kiosk's own position. 제주공항 (W006) sits ~5km from the 제주시 point below
 * and 세계자연유산본부 (W008) ~25km from it, so feeding a kiosk's own forecast
 * into a column headed 제주시 would put a number under a name that did not
 * produce it.
 *
 * That is also why the panel leaves a column blank rather than falling back to
 * `WeatherForecast.days` — see the note on `WeatherForecast.sites`.
 *
 * ── Precision ────────────────────────────────────────────────────────
 * Weather-grade, like the kiosk coordinates: OpenWeatherMap resolves these to
 * its own grid, so being within a kilometre of the place the name means is
 * enough. 제주: the two city halls and 성산읍. 인사동: the three 구청 (district
 * offices) — 종로구 for 인사동 itself, 중구 for 명동/남산, 강남구 south of the river.
 */
import type { GeoCoordinates } from './kioskLocations';

/** Stable key for one 제주 column. Drawn labels live in the panel, not here. */
export type WeatherSiteId = 'jeju-si' | 'seogwipo-si' | 'seongsan';

/** Stable key for one 인사동 column. */
export type InsadongWeatherSiteId = 'jongno-gu' | 'jung-gu' | 'gangnam-gu';

/** Stable key for one 오색시장 (오산) or 화성휴게소 column — city halls nearby. */
export type GyeonggiWeatherSiteId = 'osan-si' | 'hwaseong-si' | 'pyeongtaek-si' | 'suwon-si';

export interface WeatherSite<Id extends string = WeatherSiteId> {
  id: Id;
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

const OSAN_SI: WeatherSite<GyeonggiWeatherSiteId> = { id: 'osan-si', name: '오산시', coordinates: { lat: 37.1498, lon: 127.0772 } };
const HWASEONG_SI: WeatherSite<GyeonggiWeatherSiteId> = { id: 'hwaseong-si', name: '화성시', coordinates: { lat: 37.1995, lon: 126.8315 } };
const PYEONGTAEK_SI: WeatherSite<GyeonggiWeatherSiteId> = { id: 'pyeongtaek-si', name: '평택시', coordinates: { lat: 36.9921, lon: 127.1129 } };
const SUWON_SI: WeatherSite<GyeonggiWeatherSiteId> = { id: 'suwon-si', name: '수원시', coordinates: { lat: 37.2636, lon: 127.0286 } };

/** The 오색시장 (오산) home panel's three columns, left to right — the kiosk's own
 *  city first, then its two neighbours. */
export const OSAN_WEATHER_SITES: readonly WeatherSite<GyeonggiWeatherSiteId>[] = [OSAN_SI, HWASEONG_SI, PYEONGTAEK_SI];

/** The 화성휴게소 home panel's three columns, left to right. */
export const HWASEONG_WEATHER_SITES: readonly WeatherSite<GyeonggiWeatherSiteId>[] = [HWASEONG_SI, OSAN_SI, SUWON_SI];

/** The Insadong home panel's three columns, left to right. */
export const INSADONG_WEATHER_SITES: readonly WeatherSite<InsadongWeatherSiteId>[] = [
  { id: 'jongno-gu', name: '종로구', coordinates: { lat: 37.5735, lon: 126.9788 } },
  { id: 'jung-gu', name: '중구', coordinates: { lat: 37.564, lon: 126.9975 } },
  { id: 'gangnam-gu', name: '강남구', coordinates: { lat: 37.5172, lon: 127.0473 } },
] as const;
