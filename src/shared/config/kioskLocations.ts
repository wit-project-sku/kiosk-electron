import type { KioskId, KioskLayoutId, KioskScreenId, SupportedLanguage } from '../types/kiosk';

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
export type KioskLocationCode = 'W001' | 'W002' | 'W003' | 'W004';

export interface KioskLocationTile {
  screen: KioskScreenId;
  label: string;
  icon: string;
}

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
  /** Languages offered by this kiosk's selector — adapts per kioskId (no hardcoding). */
  languages: SupportedLanguage[];
}

/** W001/W002 base set (Figma 4개국어: 한국어/English/日本語/中國語); W003 adds more. */
const BASE_LANGUAGES: SupportedLanguage[] = ['ko', 'en', 'ja', 'zh'];
const W003_LANGUAGES: SupportedLanguage[] = ['ko', 'en', 'ja', 'zh', 'vi', 'th', 'es'];

const INSARANG_TILE: KioskLocationTile = { screen: 'insarang', label: '인사랑(준비중)', icon: 'insarang' };
const MARKET_TILE: KioskLocationTile = { screen: 'market', label: '위드마켓', icon: 'market' };

export const KIOSK_LOCATIONS: Record<KioskLocationCode, KioskLocation> = {
  W001: { code: 'W001', name: '북인사마당', layout: 'INSADONG', secondTile: INSARANG_TILE, hasCardTerminal: false, languages: BASE_LANGUAGES },
  W002: { code: 'W002', name: '인사동쉼터', layout: 'INSADONG', secondTile: INSARANG_TILE, hasCardTerminal: false, languages: BASE_LANGUAGES },
  W003: { code: 'W003', name: '남인사마당', layout: 'NAM_INSADONG', secondTile: MARKET_TILE, hasCardTerminal: true, languages: W003_LANGUAGES },
  // 오색시장 also has a physical card-payment terminal (like 남인사마당 W003), so it
  // takes the payment result flow (위드마켓 webview + save QR, result image on Monitor 2).
  W004: { code: 'W004', name: '오산시 오색시장', layout: 'OSAN', secondTile: MARKET_TILE, hasCardTerminal: true, languages: BASE_LANGUAGES },
};

/** Resolve a location by kiosk id, falling back to W001 (북인사마당). */
export function getKioskLocation(kioskId: KioskId): KioskLocation {
  return KIOSK_LOCATIONS[kioskId as KioskLocationCode] ?? KIOSK_LOCATIONS.W001;
}

/** React layout family for a kiosk — derived from kioskId. */
export function getKioskLayout(kioskId: KioskId): KioskLayoutId {
  return getKioskLocation(kioskId).layout;
}

/** Languages this kiosk's selector offers — derived from kioskId, never hardcoded in a layout. */
export function getKioskLanguages(kioskId: KioskId): SupportedLanguage[] {
  return getKioskLocation(kioskId).languages;
}
