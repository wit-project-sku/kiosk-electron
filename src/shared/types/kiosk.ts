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

/** Layout identifiers mapped to React layout components. */
export type KioskLayoutId = 'INSADONG' | 'NAM_INSADONG' | 'OSAN' | 'HWASEONG';

/** Well-known kiosk deployment IDs. */
export type KioskId = 'W001' | 'W002' | 'W003' | 'W005' | (string & {});

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
  | 'emergency';   // 긴급안내
