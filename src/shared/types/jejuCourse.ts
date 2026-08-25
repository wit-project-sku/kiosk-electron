/**
 * 제주 '제주' 뭐하지 (AI 검색) course recommendation —
 * `POST /api/jeju/courses/recommend`.
 *
 * 제주 only. The API answers for kiosk 6 (제주국제공항), 7 (제주항 여객터미널) and
 * 8 (세계자연유산본부) and 400s anything else; 인사동·오색·화성 do not use it at
 * all — they still assemble a course out of `/api/shops` in the renderer.
 *
 * 제주 is separate because the constraints are: the islands need a ferry, the
 * 5일장 only stands on its market day, and a day has to fit travel time, opening
 * hours, closing days and party capacity inside one time budget. The server
 * schedules 220 places that carry coordinates and hands the itinerary back.
 *
 * ── It is rule-based, not an LLM ──────────────────────────────────────
 * The same request gives the same course every time, which is what makes
 * `excludeShops` meaningful: re-recommending means naming the shops you already
 * got and asking for a different combination.
 *
 * Rules worth knowing, because the UI must not contradict them:
 *   · a day is cut at an 8-hour budget with no cap on the number of spots (the
 *     last day gets 5, for check-out and the trip home);
 *   · days = nights + 1, capped at 4 (the server clamps; `nights: 9` still
 *     answers 4 days). Each morning starts from the previous day's last spot;
 *   · `interests` are the shop's `aiCategoryKr` VERBATIM, prefix and all —
 *     "22-섬 여행", not "섬 여행". Three at most. A picked interest is
 *     guaranteed to appear in the result, or to come back in `unmetInterests`;
 *   · `party` drops places that cannot seat the group, `visitDate` drops closing
 *     days and non-market days for the 5일장.
 */

/** Course letter. The API 400s anything else ("코스 종류는 A·B·C 중 하나여야 합니다"). */
export type JejuCourseKey = 'A' | 'B' | 'C';

/**
 * 이동수단, as the API spells it — 1:1 with the questionnaire's four chips
 * (도보 / 자전거 / 대중교통 / 자동차). Anything else 400s.
 */
export type JejuTransport = 'WALK' | 'BIKE' | 'TRANSIT' | 'CAR';

/**
 * What the renderer asks for. `kioskId` is deliberately absent: the main
 * process fills it from KioskService, so no screen has to know its own number
 * and none can send the wrong one.
 */
export interface JejuCourseRecommendQuery {
  course: JejuCourseKey;
  transport: JejuTransport;
  /** Group size. The server drops venues that cannot take this many. */
  party: number;
  /** 숙박 박수. 0 = 당일치기. Days come back as nights + 1, capped at 4. */
  nights: number;
  /** Up to 3 `aiCategoryKr` values, prefix included. */
  interests: string[];
  /** `YYYY-MM-DD` — the visitor's own day, for 휴무 and 5일장. */
  visitDate: string;
  /** Shop NAMES from a previous result, to get a different combination. */
  excludeShops?: string[];
}

/** One stop on the itinerary. */
export interface JejuCourseSpot {
  /** Joins to `Shop.id` from `/api/shops` — every id resolves there. */
  shopId: number;
  /** 1-based position within the day. */
  order: number;
  /** Travel time from the previous stop (from the day's start, for order 1). */
  travelMinutes: number;
  /** Minutes past midnight — 540 = 09:00. */
  arriveMin: number;
  leaveMin: number;
  /** Time spent at the spot. `leaveMin - arriveMin`. */
  dwellMinutes: number;
  /** 1 = 쉬움 and up; see `courseDifficultyLabel`. */
  difficulty: number;
  /**
   * Display-ready 영업시간 ("09:00-18:00 (연중무휴)", "상시").
   *
   * ★ NULL means the server's hours for this shop are an ESTIMATE, and the
   * contract is to show no hours at all rather than a guess — not to fall back
   * to another field.
   */
  openTimeText: string | null;
  /** Set where the spot is anchored to another place; null otherwise. */
  viewAnchor: string | null;
}

/** One day of the itinerary. */
export interface JejuCourseDay {
  /** 1-based. */
  day: number;
  spotCount: number;
  /** The day's total, travel and dwell together. */
  minutes: number;
  difficulty: number;
  spots: JejuCourseSpot[];
}

/** A scheduled course. */
export interface JejuCourse {
  course: JejuCourseKey;
  days: number;
  totalSpots: number;
  totalMinutes: number;
  difficulty: number;
  /**
   * Interests the visitor picked that could not physically be fitted. Empty on
   * a course that honoured every pick.
   */
  unmetInterests: string[];
  schedule: JejuCourseDay[];
}
