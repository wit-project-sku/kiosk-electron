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

/*
 * ── 커스텀 코스 picker — `POST /api/jeju/courses/picker` ──────────────────
 *
 * A different feature from /recommend: called on EVERY 즐길 거리 tap, it adds
 * exactly one real place per tapped tile — the one the visitor can reach
 * soonest (travel + any wait for it to open) that is open that date and for the
 * whole stay — and takes its time out of a 09:00–21:00 day. It answers with the
 * whole plan AND the state of every tile, so the screen can grey out what no
 * longer fits. No course letter, no meal rules; tap order is the route.
 *
 * Stateless: every call sends all the taps so far. Same input, same answer.
 * Rules in full: jeju-course-lab/spec/picker.md.
 */

/**
 * A tile's state for the next tap.
 *   OK           — fits; `costMinutes` is what the tap will add, on `day`.
 *   PICKED       — already tapped (tapping again removes it).
 *   DAY_OFF      — every reachable place is shut all day on that date (휴무
 *                  요일, or not a market day). Checked again once the trip moves
 *                  on to the next day.
 *   CLOSED       — open that date, but shut by the time the visitor gets there.
 *   NO_TIME      — would run past 21:00, today and on a fresh next day.
 *   OUT_OF_RANGE — nothing within one leg of the last stop (도보 2 km …).
 *   NO_PLACES    — none left: none exist, too big a party, or all used.
 */
export type JejuPickerStatus = 'OK' | 'PICKED' | 'DAY_OFF' | 'CLOSED' | 'NO_TIME' | 'OUT_OF_RANGE' | 'NO_PLACES';

/** What the renderer asks for. `kioskId` is filled by the main process, as for /recommend. */
export interface JejuPickerQuery {
  transport: JejuTransport;
  party: number;
  /** 0 = 당일치기. Days = min(nights + 1, 4), each 09:00 → 21:00. */
  nights: number;
  /** `YYYY-MM-DD` of DAY 1 — closed weekdays and 5일장 dates are checked per day. */
  visitDate: string;
  /** Every tile tapped so far, whole trip, tap order — `aiCategoryKr` with its prefix. */
  picks: string[];
  /** The tiles on screen, so each gets a row back (a tile with no places reads NO_PLACES). */
  categories?: string[];
}

/** One stop the picker placed. Times are minutes past midnight (540 = 09:00). */
export interface JejuPickerStop {
  order: number;
  aiCategory: string;
  shopId: number;
  travelMinutes: number;
  travelKm: number;
  /** Arrived before it opened, so waited this long. */
  waitMinutes: number;
  dwellMinutes: number;
  arriveMin: number;
  leaveMin: number;
  /** travel + wait + dwell — what this tap took off its day. */
  costMinutes: number;
  viewAnchor: string | null;
}

export interface JejuPickerDay {
  day: number;
  date: string;
  startMin: number;
  endMin: number;
  budgetMinutes: number;
  usedMinutes: number;
  /** Left on this day. A day the trip has moved past is closed — nothing can use it. */
  remainingMinutes: number;
  stops: JejuPickerStop[];
}

/** One row per tile. */
export interface JejuPickerOption {
  aiCategory: string;
  /** Can be tapped to ADD it. A PICKED tile is not enabled but stays tappable to remove. */
  enabled: boolean;
  status: JejuPickerStatus;
  /** OK: what a tap would add (wait included). PICKED: what it took. Else null. */
  costMinutes: number | null;
  shopId: number | null;
  /** OK: the day a tap lands on. PICKED: the day it went to. Else null. */
  day: number | null;
  /** OK / PICKED: arrival time there. Else null. */
  arriveMin: number | null;
}

/** The whole plan, as of the taps sent. */
export interface JejuPickerPlan {
  visitDate: string;
  dayCount: number;
  budgetMinutes: number;
  usedMinutes: number;
  /** What a further tap can still use: the current day's leftover plus every later day. */
  remainingMinutes: number;
  /** The day the next tap lands on first. */
  currentDay: number;
  /** No tile can be tapped. With a lot of `remainingMinutes` left, places ran out, not time. */
  full: boolean;
  days: JejuPickerDay[];
  categories: JejuPickerOption[];
  /** Taps that no longer fit after a change of 이동수단 / 인원 / 기간. */
  dropped: { aiCategory: string; reason: string }[];
}
