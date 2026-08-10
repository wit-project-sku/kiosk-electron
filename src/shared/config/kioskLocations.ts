import type { KioskId, KioskLayoutId, KioskScreenId } from '../types/kiosk';

/**
 * Per-location kiosk configuration.
 *
 * The three deployments share ONE visual design (the Insadong theme) — they are
 * NOT separate themes. Only two things differ by location, taken from the Figma
 * frames `#W001=북인사마당 + #W002=인사동쉼터` (홈-01) vs `#W003=남인사마당 (카드단말기 있음)` (홈-02):
 *   1. the 2nd home-grid tile — 인사랑(준비중) for W001/W002, 위드마켓 for W003;
 *   2. W003 has a card-payment terminal.
 *
 * Selected at runtime from the persisted `kioskId` — the single source of truth
 * is electron-store (see KioskConfigStore), set per machine via provision-kiosk.ps1.
 * There is NO env override; one build serves every location.
 */
export type KioskLocationCode = 'W001' | 'W002' | 'W003' | 'W004' | 'W005' | 'W006';

export interface KioskLocationTile {
  screen: KioskScreenId;
  label: string;
  icon: string;
}

/** Weather query coordinates (OpenWeatherMap lat/lon) for a deployment. */
export interface GeoCoordinates {
  lat: number;
  lon: number;
}

/**
 * Digicon `together_with` code — the mascot a 같이찍기 (together) photo is
 * composited with: '2'=인사, '3'=정이, '4'=휴. ('GROUP'=인사+정이 exists but no
 * kiosk uses it.) Each location must send ITS OWN character; there is no server
 * default that gets this right.
 */
export type AiCompanionCode = '2' | '3' | '4';

export interface KioskLocation {
  code: KioskLocationCode;
  /** Human name of the physical location. */
  name: string;
  /** React layout family — W001/W002 = INSADONG, W003 = NAM_INSADONG (separable design). */
  layout: KioskLayoutId;
  /** The 2nd home-grid tile (the only home difference between locations). */
  secondTile: KioskLocationTile;
  /** Has a physical card-payment terminal (남인사마당 W003, 오색시장 W004). */
  hasCardTerminal: boolean;
  /**
   * Whether this kiosk runs the 기부 (donation) web app — it takes the 지도 tile's
   * grid slot, so the two are mutually exclusive.
   *
   * This is the AUTHORED default, used only until the buttons API is cached
   * (cold start / offline). The live CMS is the real authority: see
   * useHasDonationTile, which prefers a 기부 row in the API response. Keep this
   * in sync with the CMS so a first boot with no network still looks right.
   */
  hasDonation: boolean;
  /** Mascot for 같이찍기 photos at this location — see {@link AiCompanionCode}.
   *  Applies to BOTH the kiosk's own photo flow and donation-initiated captures.
   *  (Note the donation app's own CHROME is deliberately identical everywhere —
   *  see WEB_EMBED_URLS.donation. This is the photo character, not the palette.) */
  aiCompanion: AiCompanionCode;
  /** Weather coordinates for this physical location (OpenWeatherMap query). */
  coordinates: GeoCoordinates;
}

/** Insadong, Seoul — W001–W003 (북/남인사마당, 인사동쉼터). */
const INSADONG_COORDS: GeoCoordinates = { lat: 37.5744, lon: 126.9849 };
/** 오산시 오색시장 — W004. */
const OSAN_COORDS: GeoCoordinates = { lat: 37.1499, lon: 127.0773 };
/** 화성휴게소 (화성시) — W005. */
const HWASEONG_COORDS: GeoCoordinates = { lat: 37.1996, lon: 126.8312 };
/** 제주국제공항 (제주시 용담이동) — W006. */
const JEJU_AIRPORT_COORDS: GeoCoordinates = { lat: 33.5104, lon: 126.493 };

const INSARANG_TILE: KioskLocationTile = { screen: 'insarang', label: '인사랑(준비중)', icon: 'insarang' };
const MARKET_TILE: KioskLocationTile = { screen: 'market', label: '위드마켓', icon: 'market' };

// 기부 is deployed on W003/W004/W005 — mirrors the `buttons` CMS, which carries a
// 기부 row for kiosks 3/4/5 (line 6 position 2) and has dropped their 지도 row, while
// W001/W002 still have 인사동 지도 and no 기부. As of 2026-07-31 화성휴게소 W005 also
// has a physical TL-3800 terminal, so hasCardTerminal now matches hasDonation on
// 3/4/5: all three drive card payment through the embedded loopback agent (the
// donation webview posts to 127.0.0.1:8080), not an online-only flow.
export const KIOSK_LOCATIONS: Record<KioskLocationCode, KioskLocation> = {
  W001: { code: 'W001', name: '북인사마당', layout: 'INSADONG', secondTile: INSARANG_TILE, hasCardTerminal: false, hasDonation: false, aiCompanion: '2', coordinates: INSADONG_COORDS },
  W002: { code: 'W002', name: '인사동쉼터', layout: 'INSADONG', secondTile: INSARANG_TILE, hasCardTerminal: false, hasDonation: false, aiCompanion: '2', coordinates: INSADONG_COORDS },
  W003: { code: 'W003', name: '남인사마당', layout: 'NAM_INSADONG', secondTile: MARKET_TILE, hasCardTerminal: true, hasDonation: true, aiCompanion: '2', coordinates: INSADONG_COORDS },
  // 오색시장 also has a physical card-payment terminal (like 남인사마당 W003), so it
  // takes the payment result flow (위드마켓 webview + save QR, result image on Monitor 2).
  W004: { code: 'W004', name: '오산시 오색시장', layout: 'OSAN', secondTile: MARKET_TILE, hasCardTerminal: true, hasDonation: true, aiCompanion: '3', coordinates: OSAN_COORDS },
  W005: { code: 'W005', name: '화성휴게소', layout: 'HWASEONG', secondTile: INSARANG_TILE, hasCardTerminal: true, hasDonation: true, aiCompanion: '4', coordinates: HWASEONG_COORDS },
  // 제주공항 W006 — has a TL-3800 terminal and runs 기부, like W003–W005.
  // TODO(제주): `secondTile` and `aiCompanion` are provisional. The home grid is
  // redefined by the Jeju Figma (secondTile only matters for layouts that consume
  // it), and `aiCompanion` currently sends 인사('2') because Digicon has no 제주
  // mascot code yet — set it once the 같이찍기 character is decided, or 제주 photos
  // will composite the Insadong character.
  W006: { code: 'W006', name: '제주공항', layout: 'JEJU_AIRPORT', secondTile: MARKET_TILE, hasCardTerminal: true, hasDonation: true, aiCompanion: '2', coordinates: JEJU_AIRPORT_COORDS },
};

/** Resolve a location by kiosk id, falling back to W001 (북인사마당). */
export function getKioskLocation(kioskId: KioskId): KioskLocation {
  return KIOSK_LOCATIONS[kioskId as KioskLocationCode] ?? KIOSK_LOCATIONS.W001;
}

/** React layout family for a kiosk — derived from kioskId. */
export function getKioskLayout(kioskId: KioskId): KioskLayoutId {
  return getKioskLocation(kioskId).layout;
}

/** Weather coordinates for a kiosk — derived from kioskId (falls back to Insadong). */
export function getKioskCoordinates(kioskId: KioskId): GeoCoordinates {
  return getKioskLocation(kioskId).coordinates;
}
