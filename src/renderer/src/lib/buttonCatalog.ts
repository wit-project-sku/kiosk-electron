import type { KioskId } from '@shared/types/kiosk';

/**
 * A logical kiosk button mapped to its row in the `buttons` DB table.
 *
 * Analytics events carry `id` (the `buttons.id` primary key) so click/dwell data
 * joins straight back to the row — plus `position`/`buttonName` for readability.
 * The renderer never touches the DB at runtime; the mapping is baked from the
 * `buttons` table (see BUTTON_IDS below).
 */
export interface KioskButtonRef {
  /** Stable logical key — a screen id or a photo sub-action. */
  key: string;
  /** `buttons.id` primary key for this kiosk + position, or null if unknown. */
  id: number | null;
  /** 1-based slot matching `buttons.position` in the DB. */
  position: number;
  /** DB `button_name`, e.g. "#W001_아이콘04". */
  buttonName: string;
  /** DB `button_type` — the Korean label, e.g. "화장실" (W001/W002 Insadong wording). */
  buttonType: string;
}

interface Slot {
  position: number;
  /** DB `button_type` label for this button (W001/W002 Insadong wording). */
  type: string;
  /**
   * The part after the kioskId prefix in `button_name`. Defaults to the Figma
   * icon convention `아이콘NN` (zero-padded position); the photo/weather slots
   * use bespoke names taken straight from the DB.
   */
  suffix?: string;
  /**
   * This button's `buttons.id` is NOT in the BUTTON_IDS mirror below and must be
   * resolved from the live API by `type` instead. Set for rows whose id differs
   * per API environment, where any hardcoded value would be wrong somewhere —
   * see `donation`.
   */
  dynamicId?: true;
}

/**
 * Every interactive kiosk button keyed to its slot in the `buttons` table.
 *
 * Positions are identical across all deployments (W001–W005); only the row id
 * and the kioskId prefix differ. Most buttons are 1:1 with a destination screen;
 * the photo sub-actions and weather widget are explicit non-screen keys.
 *
 * Position 5 is location-specific: 인사랑(준비중) on W001/W002, 위드마켓 on W003 —
 * both resolve to the same DB slot, just via different screen ids.
 */
const SLOTS: Record<string, Slot> = {
  home: { position: 1, type: '홈' },
  search: { position: 2, type: '검색' },
  language: { position: 3, type: '언어선택' },
  ai_search: { position: 4, type: '인사 모하지(AI 검색)' },
  insarang: { position: 5, type: '인사랑(준비중)' }, // W001/W002
  market: { position: 5, type: '위드 마켓' }, // W003
  events: { position: 6, type: '인사동 이벤트' },
  eat: { position: 7, type: '인사 뭐먹지' },
  shop: { position: 8, type: '인사 뭐사지?' },
  museum: { position: 9, type: '인사동 미술관' },
  taxfree: { position: 10, type: 'TaxFree' },
  about: { position: 11, type: '여기는 인사동' },
  hello: { position: 12, type: '안녕 인사' },
  help: { position: 13, type: '도와줘 인사' },
  // Slot 14 is the 지도 slot, and 기부 takes it over on the kiosks that run the
  // donation app (W003/W004/W005) — the two are mutually exclusive, so exactly
  // one of `map`/`parking`/`donation` is rendered per kiosk. See hasDonation in
  // kioskLocations and useHasDonationTile for who gets which.
  map: { position: 14, type: '인사동 지도' }, // W001/W002
  //
  // 기부 is NOT slot 14's DB row — it is its own row, and its id differs per API
  // environment (production 126/127/128 vs stage 128/129/130 for W003/W004/W005).
  // Note prod id 128 is W005's 기부 while stage id 128 is W003's, so ANY hardcoded
  // id is actively wrong in one environment: dynamicId forces resolution by
  // `type` off the live response instead. Keep `type` exactly matching the CMS's
  // button_type — it is the only join key.
  donation: { position: 14, type: '기부', suffix: '기부', dynamicId: true },
  exchange: { position: 15, type: '환율' },
  transport: { position: 16, type: '교통안내' },
  lodging: { position: 17, type: '숙박안내' },
  palace: { position: 18, type: '고궁안내' },
  kdrama: { position: 19, type: 'K-DRAMA' },
  photo: { position: 20, type: '사진촬영', suffix: '아이콘20' },
  restroom: { position: 21, type: '화장실' },
  weather: { position: 22, type: '날씨', suffix: '메인D' },
  photo_solo: { position: 23, type: '혼자찍기', suffix: '혼자찍기' },
  photo_together: { position: 24, type: '같이찍기', suffix: '같이찍기' },
};

/**
 * `buttons.id` primary keys, indexed by kioskId → position. Mirrors the DB
 * exactly (the id is NOT derivable from position — e.g. W001 홈/position 1 = 96).
 * Keep in sync if the `buttons` table is reseeded.
 */
const BUTTON_IDS: Record<string, Record<number, number>> = {
  // W001 (북인사마당)
  W001: { 1: 96, 2: 97, 3: 98, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8, 12: 9, 13: 10, 14: 11, 15: 12, 16: 13, 17: 14, 18: 15, 19: 16, 20: 91, 21: 17, 22: 111, 23: 116, 24: 117 },
  // W002 (인사동쉼터)
  W002: { 1: 99, 2: 100, 3: 101, 4: 18, 5: 19, 6: 20, 7: 21, 8: 22, 9: 23, 10: 24, 11: 25, 12: 26, 13: 27, 14: 28, 15: 29, 16: 30, 17: 31, 18: 32, 19: 33, 20: 92, 21: 34, 22: 112, 23: 118, 24: 119 },
  // W003 (남인사마당)
  W003: { 1: 102, 2: 103, 3: 104, 4: 35, 5: 36, 6: 37, 7: 38, 8: 39, 9: 40, 10: 41, 11: 42, 12: 43, 13: 44, 14: 45, 15: 46, 16: 47, 17: 48, 18: 49, 19: 50, 20: 93, 21: 51, 22: 113, 23: 120, 24: 121 },
  // W004 (오산 오색시장)
  W004: { 1: 105, 2: 106, 3: 107, 4: 52, 5: 53, 6: 54, 7: 55, 8: 56, 9: 57, 10: 58, 11: 59, 12: 60, 13: 61, 14: 62, 15: 63, 16: 64, 17: 65, 18: 66, 19: 67, 20: 94, 21: 68, 22: 114, 23: 122, 24: 123 },
  // W005 (화성휴게소)
  W005: { 1: 108, 2: 109, 3: 110, 4: 69, 5: 70, 6: 71, 7: 72, 8: 73, 9: 74, 10: 75, 11: 76, 12: 77, 13: 78, 14: 79, 15: 80, 16: 81, 17: 82, 18: 83, 19: 84, 20: 95, 21: 85, 22: 115, 23: 124, 24: 125 },
  // W006 (제주공항) — still deliberately absent even though kiosk_id 6 is now
  // seeded (ids 129–149 in production). Those ids are verified for PRODUCTION
  // only, and the 기부 case proved ids diverge between prod and stage; a mirror
  // that is right in one environment and wrong in the other is worse than none.
  // W006 resolves every id off the live response by `buttonType` instead — see
  // SLOT_OVERRIDES.W006 — which is correct in both. The only thing given up is
  // the cold-start fallback: a 제주 kiosk that has never reached the API logs
  // clicks with `id: null` until its first sync.
};

/**
 * Per-kiosk slot overrides where a deployment's home grid order (and labels)
 * differ from the Insadong base SLOTS.
 *
 * W004 (오산 오색시장) reuses the same screen keys but reorders several screens —
 * 뭐사지(물품)/K Culture/시장화폐/스마트관광 sit at positions 9/17/18/19, where
 * Insadong has 미술관/숙박/고궁/K-DRAMA. Labels also switch 인사→정이/오색시장.
 * Mirrors the `buttons` table for kiosk_id 4 exactly.
 */
const SLOT_OVERRIDES: Partial<Record<KioskId, Record<string, Slot>>> = {
  W004: {
    home: { position: 1, type: '홈' },
    search: { position: 2, type: '검색' },
    language: { position: 3, type: '언어선택' },
    ai_search: { position: 4, type: '정이 모하지(AI 검색)' },
    market: { position: 5, type: '위드 마켓(준비중)' },
    events: { position: 6, type: '오산시 이벤트' },
    eat: { position: 7, type: '정이 뭐먹지' },
    shop: { position: 8, type: '정이 뭐사지?(식품)' },
    lodging: { position: 9, type: '정이 뭐사지?(물품)' },
    // CMS buttons.button_type for this slot (not a UI label — home hardcodes TAX-FREE).
    taxfree: { position: 10, type: '텍스프리등록' },
    about: { position: 11, type: '여기는 오색시장' },
    hello: { position: 12, type: '안녕 정이' },
    help: { position: 13, type: '도와줘 정이' },
    map: { position: 14, type: '오색시장 지도' },
    exchange: { position: 15, type: '환율' },
    transport: { position: 16, type: '교통안내' },
    kdrama: { position: 17, type: 'K Culture(준비중)' },
    museum: { position: 18, type: '시장화폐' }, // OsanLocalpay (지역화폐)
    palace: { position: 19, type: '스마트관광(준비중)' },
    photo: { position: 20, type: '사진촬영', suffix: '아이콘20' },
    restroom: { position: 21, type: '화장실' },
    weather: { position: 22, type: '날씨', suffix: '메인D' },
    photo_solo: { position: 23, type: '혼자찍기', suffix: '혼자찍기' },
    photo_together: { position: 24, type: '같이찍기', suffix: '같이찍기' },
  },
  // W005 (화성휴게소) — rest-stop wording (휴/화성휴게소) and a reordered grid: the
  // wide top tile is 도로 교통상황(4), 전국휴게소(5)/전국 시장(9) replace the AI
  // search & 미술관 slots, and 지역화폐(18) is the only active 준비중-row tile.
  // The disabled 준비중 tiles (16/17/19) never navigate, so they need no key here.
  // Mirrors the `buttons` table for kiosk_id 5 exactly.
  W005: {
    home: { position: 1, type: '홈' },
    search: { position: 2, type: '검색' },
    language: { position: 3, type: '언어선택' },
    transport: { position: 4, type: '전국도로 교통상황' }, // wide traffic tile (its.go.kr)
    convenience: { position: 5, type: '전국휴게소(준비중)' }, // 전국휴게소 list
    events: { position: 6, type: '화성시 이벤트' },
    food_court: { position: 7, type: '휴 뭐먹지' },
    shop: { position: 8, type: '휴 뭐사지?' },
    market: { position: 9, type: '전국 시장(준비중)' }, // 전국시장 — disabled, no navigation
    taxfree: { position: 10, type: '텍스프리' },
    tourism: { position: 11, type: '화성휴게소' }, // HwaseongRestStop
    hello: { position: 12, type: '안녕 휴' },
    help: { position: 13, type: '도와줘 휴' },
    parking: { position: 14, type: '화성휴게소 지도' }, // HwaseongMap
    exchange: { position: 15, type: '환율' },
    rest_info: { position: 18, type: '지역화폐' }, // HwaseongLocalpay (지역화폐)
    photo: { position: 20, type: '사진촬영', suffix: '아이콘20' },
    restroom: { position: 21, type: '화장실' },
    weather: { position: 22, type: '날씨', suffix: '메인D' },
    photo_solo: { position: 23, type: '혼자찍기', suffix: '혼자찍기' },
    photo_together: { position: 24, type: '같이찍기', suffix: '같이찍기' },
  },
  // ── W006 제주공항 ──
  // Transcribed from the live response on 2026-08-13, when kiosk_id 6 was seeded
  // (21 rows, ids 129–149 in production). Every `type` is byte-for-byte the CMS's
  // `button_type`: the response carries NO `buttonName`, so buttonType is the ONLY
  // join key and a single wrong character silently drops the row back to `id: null`.
  // The apostrophes are ASCII U+0027, not the curly U+2018/2019 the Figma uses —
  // verified by dumping the codepoints, since the two are indistinguishable on screen.
  //
  // `position` here is the CMS reading order (line 3→8, left to right), because the
  // 제주 rows expose line/position rather than the flat 1–24 slot the older kiosks
  // carry. It is analytics metadata only — W006 has no BUTTON_IDS mirror, so nothing
  // looks an id up by position.
  //
  // Not in the CMS, so they stay id-less: K-DRAMA and 운항정보 (both on the 제주 home,
  // neither seeded), and photo_solo/photo_together. `프로모션` (id 147) is the
  // opposite case — a seeded row with no 제주 screen behind it yet.
  W006: {
    home: { position: 1, type: '홈' },
    search: { position: 2, type: '검색' },
    language: { position: 3, type: '언어선택' },
    ai_search: { position: 4, type: "'제주' 뭐하지(AI검색)" },
    market: { position: 5, type: '위드마켓' },
    events: { position: 6, type: '제주도 이벤트' },
    eat: { position: 7, type: "'제주' 뭐먹지" },
    shop: { position: 8, type: "'제주' 뭐사지" },
    lodging: { position: 9, type: '숙박안내' },
    taxfree: { position: 10, type: 'TAX-FREE' },
    about: { position: 11, type: '여기는 제주도' },
    hello: { position: 12, type: "안녕 '하영'" },
    help: { position: 13, type: "도와줘 '하영'" },
    rentcar: { position: 14, type: '렌트카' },
    exchange: { position: 15, type: '환율' },
    // Same reason as the base 기부 slot: the id differs per API environment, so it
    // must come off the live response by type rather than any static mirror.
    donation: { position: 16, type: '기부', suffix: '기부', dynamicId: true },
    tamnao: { position: 17, type: '탐나오' },
    localpay: { position: 18, type: '지역화폐' },
    photo: { position: 20, type: '사진촬영', suffix: '아이콘20' },
    restroom: { position: 21, type: '화장실' },
  },
};

/**
 * Resolve a button's DB identity for analytics. Returns `null` for keys with no
 * DB slot so callers can still log the click with just a label. `id` is `null`
 * when the kiosk/position pair isn't in the `buttons` table.
 */
export function resolveButton(kioskId: KioskId, key: string): KioskButtonRef | null {
  const slot = SLOT_OVERRIDES[kioskId]?.[key] ?? SLOTS[key];
  if (!slot) return null;
  const suffix = slot.suffix ?? `아이콘${String(slot.position).padStart(2, '0')}`;
  // dynamicId rows have no entry in the mirror — their id comes from the live API
  // (useResolveButton matches by buttonType). Reading BUTTON_IDS[position] here
  // would hand back the id of whichever button really owns that slot.
  const id = slot.dynamicId ? null : BUTTON_IDS[kioskId]?.[slot.position] ?? null;
  return { key, id, position: slot.position, buttonName: `#${kioskId}_${suffix}`, buttonType: slot.type };
}

/**
 * DB `buttons.id` for a kiosk + flat slot position (1–24), or null if unknown.
 * Mirrors {@link resolveButton}'s id lookup for callers that key by a raw slot
 * rather than a screen id — e.g. Hwaseong's shared `rest_info` tiles (slots
 * 16/17/18). Used to join the id-keyed layout response to a home tile.
 */
export function buttonIdForSlot(kioskId: KioskId, slot: number): number | null {
  return BUTTON_IDS[kioskId]?.[slot] ?? null;
}
