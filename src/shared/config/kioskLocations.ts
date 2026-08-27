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
export type KioskLocationCode = 'W001' | 'W002' | 'W003' | 'W004' | 'W005' | 'W006' | 'W007' | 'W008';

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
 * composited with: '2'=인사, '3'=정이, '4'=휴, '5'=하영. ('GROUP'=인사+정이 exists
 * but no kiosk uses it.) Each location must send ITS OWN character; the server
 * defaults to '2' when the field is absent, which is right for exactly one
 * venue and wrong for every other.
 */
export type AiCompanionCode = '2' | '3' | '4' | '5';

export interface KioskLocation {
  code: KioskLocationCode;
  /** Human name of the physical location. */
  name: string;
  /** React layout family — W001/W002 = INSADONG, W003 = NAM_INSADONG (separable
   *  design), W006/W007 = JEJU_AIRPORT (one 제주 design, two venues). */
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
  /**
   * Degrees CLOCKWISE the raw camera frame must be turned to stand upright.
   *
   * The 제주 kiosks' cameras are MOUNTED SIDEWAYS (2026-08-24): the sensor
   * delivers a 16:9 landscape frame whose content is rotated, and turning it
   * 90° yields the true 9:16 portrait stream the second screen shows. The
   * Insadong/오색/화성 machines mount theirs upright, so this is per-venue —
   * NOT a fleet constant (it briefly was one, `PHOTO_CAMERA_ROTATION`, which
   * rotated every venue's feed; reverted 2026-08-26).
   *
   * ★ 제주 is back to 0 since the ZED 2i (2026-08-26). The turn still happens —
   * it is just done by the CAMERA now, set to rotate left 90° in its own
   * settings, which is free where doing it here costs a full-frame canvas
   * rotate on every captured photo. The camera then delivers its two eyes
   * STACKED rather than side by side, which the splitter recognises and cuts
   * along the other axis (`lib/stereoCamera.ts`, StereoLayout).
   *
   * This value and the camera's own setting are two halves of one decision:
   * set this to 0 only where the camera has actually been turned, or the
   * kiosk shows a sideways visitor. One value covers all three 제주 machines.
   *
   * One value drives BOTH consumers, which must never disagree:
   *   · the live preview  (JejuCameraGuide .feed)
   *   · the captured JPEG (useKioskCamera.capture) — the AR API must receive
   *     the upright photo, not the raw sideways frame
   * A camera mounted the other way round is 270; upright is 0.
   */
  cameraRotation: 0 | 90 | 180 | 270;
  /**
   * `kioskId` to send to the SHOP API (`/api/shops?kioskId=`) when it differs
   * from this kiosk's own W-code number.
   *
   * Normally the two are the same — W004's shops are at `?kioskId=4`. W006 was
   * the exception when its catalogue was filed under 7 (2026-08-12: `?kioskId=6`
   * returned `data: []`, `?kioskId=7` returned 310 rows).
   *
   * That has since been re-filed. Re-checked 2026-08-24: `?kioskId=6` now returns
   * the 310 rows, every one carrying `kioskId: 6`, and 7 and 8 answer with the
   * same rows — the whole 제주 fleet reads one catalogue. W006's override is
   * therefore redundant but still correct, so it stays rather than being changed
   * on a live fleet; W007 needs none. Do NOT copy the override onto a new 제주
   * kiosk without re-checking which number actually carries the rows.
   *
   * This is SHOP-ONLY. The per-kiosk endpoints (`/api/kiosks/{n}/banners`,
   * `/buttons`, `/subtitles`, stats, update-command) still key off the W-code
   * number — W006's banners live at 6 and 7 has none — so `KioskService.kioskNum()`
   * deliberately ignores this field. See ShopService.
   */
  shopApiKioskId?: number;
}

/** Insadong, Seoul — W001–W003 (북/남인사마당, 인사동쉼터). */
const INSADONG_COORDS: GeoCoordinates = { lat: 37.5744, lon: 126.9849 };
/** 오산시 오색시장 — W004. */
const OSAN_COORDS: GeoCoordinates = { lat: 37.1499, lon: 127.0773 };
/** 화성휴게소 (화성시) — W005. */
const HWASEONG_COORDS: GeoCoordinates = { lat: 37.1996, lon: 126.8312 };
/** 제주국제공항 (제주시 용담이동) — W006. */
const JEJU_AIRPORT_COORDS: GeoCoordinates = { lat: 33.5104, lon: 126.493 };
/** 제주국제여객터미널 (제주시 임항로) — W007. Its own coordinates, ~5km east of the
 *  airport: close enough that the weather usually agrees, far enough that reusing
 *  the airport's would be a guess rather than this kiosk's location. */
const JEJU_TERMINAL_COORDS: GeoCoordinates = { lat: 33.5237, lon: 126.5427 };
/** 세계자연유산본부 — W008. Coordinates are the 제주세계자연유산센터 (거문오름,
 *  제주시 조천읍 선교로 569-36), the venue's visitor building — inland and ~25km
 *  east of 제주시내, so its weather genuinely differs from the other two 제주
 *  kiosks'. Weather-grade precision; re-verify against the machine's actual
 *  site at provisioning if the kiosk lands elsewhere in the complex. */
const JEJU_HERITAGE_COORDS: GeoCoordinates = { lat: 33.4557, lon: 126.7126 };

const INSARANG_TILE: KioskLocationTile = { screen: 'insarang', label: '인사랑(준비중)', icon: 'insarang' };
const MARKET_TILE: KioskLocationTile = { screen: 'market', label: '위드마켓', icon: 'market' };

// 기부 is deployed on W003/W004/W005 — mirrors the `buttons` CMS, which carries a
// 기부 row for kiosks 3/4/5 (line 6 position 2) and has dropped their 지도 row, while
// W001/W002 still have 인사동 지도 and no 기부. As of 2026-07-31 화성휴게소 W005 also
// has a physical TL-3800 terminal, so hasCardTerminal now matches hasDonation on
// 3/4/5: all three drive card payment through the embedded loopback agent (the
// donation webview posts to 127.0.0.1:8080), not an online-only flow.
export const KIOSK_LOCATIONS: Record<KioskLocationCode, KioskLocation> = {
  W001: { code: 'W001', name: '북인사마당', layout: 'INSADONG', secondTile: INSARANG_TILE, hasCardTerminal: false, hasDonation: false, aiCompanion: '2', coordinates: INSADONG_COORDS, cameraRotation: 0 },
  W002: { code: 'W002', name: '인사동쉼터', layout: 'INSADONG', secondTile: INSARANG_TILE, hasCardTerminal: false, hasDonation: false, aiCompanion: '2', coordinates: INSADONG_COORDS, cameraRotation: 0 },
  W003: { code: 'W003', name: '남인사마당', layout: 'NAM_INSADONG', secondTile: MARKET_TILE, hasCardTerminal: true, hasDonation: true, aiCompanion: '2', coordinates: INSADONG_COORDS, cameraRotation: 0 },
  // 오색시장 also has a physical card-payment terminal (like 남인사마당 W003), so it
  // takes the payment result flow (위드마켓 webview + save QR, result image on Monitor 2).
  W004: { code: 'W004', name: '오산시 오색시장', layout: 'OSAN', secondTile: MARKET_TILE, hasCardTerminal: true, hasDonation: true, aiCompanion: '3', coordinates: OSAN_COORDS, cameraRotation: 0 },
  W005: { code: 'W005', name: '화성휴게소', layout: 'HWASEONG', secondTile: INSARANG_TILE, hasCardTerminal: true, hasDonation: true, aiCompanion: '4', coordinates: HWASEONG_COORDS, cameraRotation: 0 },
  // 제주공항 W006 — has a TL-3800 terminal and runs 기부, like W003–W005.
  // TODO(제주): `secondTile` is provisional — the home grid is redefined by the
  // Jeju Figma (it only matters for layouts that consume it).
  //
  // `aiCompanion` is now 하영('5'), the venue's own mascot: Digicon added the code
  // in the 2026-08-25 AR spec, closing the gap this line used to carry. Until
  // then it sent 인사('2'), so 같이찍기 photos composited the Insadong character
  // while the screen next to them said "사진촬영 (with '하영')" — the UI has always
  // promised 하영 (see Photo_SelectTogether and the two 하영 home tiles).
  W006: { code: 'W006', name: '제주공항', layout: 'JEJU_AIRPORT', secondTile: MARKET_TILE, hasCardTerminal: true, hasDonation: true, aiCompanion: '5', coordinates: JEJU_AIRPORT_COORDS, shopApiKioskId: 7, cameraRotation: 0 },
  // 제주국제여객터미널 W007 — the CMS name is `#W007-제주시=제주국제여객터미널`. It runs
  // the SAME design as 제주공항: one JEJU_AIRPORT layout, one Localization_Jeju tab,
  // the same 하영 mascot rows, the same 310-row 제주 shop catalogue.
  //
  // Verified against the live CMS on 2026-08-24, `/api/kiosks/7/buttons` (21 rows,
  // ids 150–170) is byte-for-byte 제주공항's grid with ONE row changed: line 6
  // position 4 is 크루즈 운항 where W006 has 렌트카. Everything else — 기부 (hence
  // hasDonation), 탐나오, 지역화폐, TAX-FREE, the two 하영 tiles — is identical.
  //
  // No `shopApiKioskId`: `/api/shops?kioskId=7` already answers with the 제주
  // catalogue (310 rows), so the plain W-code number is right here. W006 keeps its
  // override for the reason recorded on the `shopApiKioskId` field above.
  // `aiCompanion` is 하영('5'), exactly like W006 — same venue mascot, same
  // Localization_Jeju rows, and the two were always meant to move together.
  W007: { code: 'W007', name: '제주국제여객터미널', layout: 'JEJU_AIRPORT', secondTile: MARKET_TILE, hasCardTerminal: true, hasDonation: true, aiCompanion: '5', coordinates: JEJU_TERMINAL_COORDS, cameraRotation: 0 },
  // 세계자연유산본부 W008 — the CMS name is `#W008-제주시=세계자연유산본부` (the sheet's
  // 비고 column calls the venue 제주유산문화센터). Same 제주 design, but its OWN
  // JEJU_HERITAGE layout because its mascot is 유산, not 하영 — the shared
  // Localization_Jeju tab is disambiguated per layout (see
  // LocalizationSyncParser.VENUE_MASCOTS), so the two mascots cannot share one
  // layout id.
  //
  // Verified against the live CMS on 2026-08-24: `/api/kiosks/8/buttons` (21 rows,
  // ids 171–191) is byte-for-byte W007's grid — 크루즈 운항 included, NOT 렌트카 —
  // with the two mascot rows renamed: line 6 positions 2/3 are 안녕 '유산' /
  // 도와줘 '유산'. 기부 is seeded (id 186), hence hasDonation.
  //
  // No `shopApiKioskId`: `/api/shops?kioskId=8` answers with the same 310-row
  // 제주 catalogue (re-checked 2026-08-24), so the plain W-code number is right.
  // TODO(제주 W008): hasCardTerminal mirrors W006/W007 (the 기부 flow pays through
  // the loopback agent) — confirm the venue actually receives a TL-3800 at install.
  // TODO(제주 W008): `aiCompanion` still sends 인사('2'). W006/W007 moved to
  // 하영('5') when Digicon added that code (2026-08-25), but there is STILL no
  // 유산 code, and this venue's mascot is 유산 — so both options are wrong here.
  // '2' is kept deliberately rather than borrowing W006/W007's '5': this kiosk
  // has its own JEJU_HERITAGE layout precisely to keep 하영 off a 유산 machine
  // (LocalizationSyncParser.VENUE_MASCOTS rewrites every 하영 row to 유산), so
  // compositing 하영 would contradict the one rule this layout exists to enforce.
  // Revisit when Digicon ships a 유산 code.
  W008: { code: 'W008', name: '세계자연유산본부', layout: 'JEJU_HERITAGE', secondTile: MARKET_TILE, hasCardTerminal: true, hasDonation: true, aiCompanion: '2', coordinates: JEJU_HERITAGE_COORDS, cameraRotation: 0 },
};

/**
 * True for every 제주-design layout (JEJU_AIRPORT W006/W007, JEJU_HERITAGE W008).
 * The two layout ids exist only to split the mascot rows of one shared sheet —
 * design-family checks (photo chrome and friends) must treat them as one.
 */
export function isJejuLayout(layout: KioskLayoutId): boolean {
  return layout === 'JEJU_AIRPORT' || layout === 'JEJU_HERITAGE';
}

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

/**
 * Camera mount rotation for a kiosk — see {@link KioskLocation.cameraRotation}.
 * 0 (upright, the W001 fallback) until the display window's kioskId resolves,
 * which is long before any camera mode can be reached.
 */
export function getCameraRotation(kioskId: KioskId): 0 | 90 | 180 | 270 {
  return getKioskLocation(kioskId).cameraRotation;
}

/**
 * The shop API's `kioskId` for a kiosk, or `undefined` when it is just the
 * W-code number. Authored in {@link KIOSK_LOCATIONS} so a machine works from a
 * plain `provision-kiosk.ps1 W006` with no `-ShopId` — see
 * {@link KioskLocation.shopApiKioskId} for why this is shop-only.
 */
export function getShopApiKioskId(kioskId: KioskId): number | undefined {
  return getKioskLocation(kioskId).shopApiKioskId;
}
