/**
 * Kiosk identity and layout configuration.
 *
 * Stored in electron-store (not SQLite). Set once per deployment machine.
 */

/**
 * Supported UI languages. All kiosks ship the 8-language selector
 * (ko/en/ja/zh + vi/th/ru/id). `zh_cn`/`zh_tw`/`es` are kept for back-compat
 * with previously-synced translation data.
 */
export type SupportedLanguage =
  | 'ko'
  | 'en'
  | 'ja'
  | 'vi'
  | 'zh'
  | 'zh_cn'
  | 'zh_tw'
  | 'th'
  | 'ru'
  | 'id'
  | 'es';

/**
 * Layout identifiers mapped to React layout components.
 *
 * A layout is a DESIGN FAMILY, not a deployment: W001/W002 share INSADONG, and
 * W006 (제주국제공항) / W007 (제주국제여객터미널) share JEJU_AIRPORT. Everything keyed
 * by layout — the content sheet, the localization column order and mascot, the
 * theme, the video map, the photo chrome — is therefore shared by both 제주
 * venues by construction. Per-venue differences belong in kioskLocations.ts or,
 * for home-grid rows, in buttonCatalog's SLOT_OVERRIDES.
 *
 * JEJU_HERITAGE (W008 세계자연유산본부) is the SAME 제주 design and screens
 * (layouts/index.ts points it at JejuLayout) but a separate layout id, because
 * the mascot tie-break over the shared Localization_Jeju tab runs the OTHER way:
 * a JEJU_AIRPORT machine keeps the 하영 rows, a JEJU_HERITAGE machine keeps 유산's
 * (see LocalizationSyncParser.VENUE_MASCOTS). Everything else keyed by layout —
 * sheet id, column order, video set, photo chrome — is duplicated 1:1 on purpose.
 */
/**
 * KADA (W202, Korea-ASEAN Digital Academy — Vietnam Chapter, Hanoi) is a
 * STANDALONE design family, not a variant of a Korean venue. It ships five
 * screens and nothing else: four flattened Figma pages plus the shared photo
 * (K-CULTURE CHALLENGE) workflow. It deliberately opts out of every CMS-driven
 * subsystem the domestic kiosks depend on — Google Sheets localization, the
 * buttons/banners/shops APIs, analytics — because the venue has no CMS rows and
 * a two-language (en/vi) audience. See layouts/kada/.
 */
export type KioskLayoutId =
  | 'INSADONG'
  | 'NAM_INSADONG'
  | 'OSAN'
  | 'HWASEONG'
  | 'JEJU_AIRPORT'
  | 'JEJU_HERITAGE'
  | 'KADA';

/** Well-known kiosk deployment IDs. */
export type KioskId = 'W001' | 'W002' | 'W003' | 'W004' | 'W005' | 'W006' | 'W007' | 'W008' | 'W202' | (string & {});

export interface KioskConfig {
  kioskId: KioskId;
  layout: KioskLayoutId;
  /** Per-machine witteria shop-API id (set in electron-store); optional. */
  shopApiKioskId?: number;
}

/** Theme tokens loaded from local JSON — mapped to CSS custom properties. */
export interface KioskTheme {
  id: string;
  name: string;
  colors: {
    primary: string;
    primaryHover: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    accent: string;
  };
  typography: {
    fontFamily: string;
    headingSize: string;
    bodySize: string;
    buttonSize: string;
  };
  spacing: {
    screenPadding: string;
    buttonGap: string;
  };
}

/** Cached content entry from Google Sheets sync (stored in SQLite local_cache). */
export interface CachedContent {
  key: string;
  data: Record<string, unknown>;
  updatedAt: string;
}

/** Kiosk screen identifiers used by layout navigation. */
export type KioskScreenId =
  // Shared
  | 'home'
  // Insadong (W001/W002) destinations — match the Figma home grid
  | 'ai_search' // 인사 모하지 (AI검색)
  | 'ai_result' // 인사 모하지 (AI검색) 코스 결과
  | 'ai_detail' // 인사 모하지 (AI검색) 상세
  | 'market' // 위드마켓
  | 'insarang' // 인사랑 (준비중) — W001/W002 home tile
  | 'events' // 인사동 이벤트
  | 'eat' // 인사 뭐먹지
  | 'shop' // 인사 뭐사지
  | 'museum' // 인사동미술관
  | 'taxfree' // TAX-FREE
  | 'about' // 여기는 인사동
  | 'hello' // 안녕 인사
  | 'help' // 도와줘 인사
  | 'map' // 인사동지도
  | 'exchange' // 환율
  | 'transport' // 교통안내
  | 'lodging' // 숙박안내
  | 'palace' // 고궁안내
  | 'language' // 언어선택
  | 'search' // 검색
  | 'detail' // 상세 (shared list-item detail)
  | 'kdrama' // K-DRAMA
  | 'restroom' // 화장실
  | 'donation' // 기부 (embedded donation web app, fullscreen webview)
  // Legacy / Nam Insadong (W003) — kept so KioskShell + NamInsadongLayout still compile
  | 'intro'
  | 'guide'
  | 'facilities'
  | 'food'
  | 'shopping'
  | 'culture'
  // Hwaseong rest stop (W005)
  | 'rest_info'    // 휴게소 안내
  | 'food_court'   // 푸드코트
  | 'convenience'  // 편의시설
  | 'tourism'      // 주변관광
  | 'parking'      // 주차안내
  | 'emergency'    // 긴급안내
  // 제주공항 (W006) — the three home tiles with no equivalent in another layout.
  // Everything else on the Jeju home reuses the shared ids above
  // (eat/shop/lodging/taxfree/about/hello/help/exchange/donation/…).
  // 지역화폐 gets its OWN id rather than reusing Osan's `museum` or Hwaseong's
  // `rest_info` overload — those exist only because those kiosks' CMS rows
  // happened to share a slot, and the alias makes every later reader guess.
  | 'rentcar'      // 렌트카 (간편 예약) — 제주공항 W006 only
  | 'tamnao'       // 탐나오 (제주공공플랫폼)
  | 'localpay'     // 지역화폐 (탐나는전)
  // 제주국제여객터미널 (W007) — the one home tile W006 does not have. It takes
  // 렌트카's grid slot (line 6 position 4), so the two are mutually exclusive:
  // exactly one of them is rendered per venue. See JejuHome's VENUE_TILE.
  // W008 세계자연유산본부 draws it too (its CMS grid is W007's, not W006's).
  | 'cruise'       // 크루즈 운항 → the ferry sailing board (JejuCruise)
  // Not a home tile — reached from the home 운항 정보 board's `더보기`.
  | 'flights'      // 운항정보 (출발/도착 전체 보기)
  // ── KADA (W202) ─────────────────────────────────────────────────────────
  // One screen per KADA partner, reached by tapping that partner's badge on the
  // home screen or its entry in the rail every partner page carries. Each is a
  // flattened full-bleed export — TWO of them, English and Vietnamese, since the
  // body copy is painted into the artwork (assets/kada/<partner>-<lang>.png).
  // See layouts/kada/kadaPages.ts.
  | 'kada_akcf'   // ASEAN-Korea Cooperation Fund
  | 'kada_nipa'   // National IT Industry Promotion Agency
  | 'kada_ptit'   // Posts and Telecommunications Institute of Technology
  | 'kada_sku'    // Seokyeong University
  | 'kada_wit';   // WIT GLOBAL
