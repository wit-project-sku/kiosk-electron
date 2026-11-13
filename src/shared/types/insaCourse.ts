/**
 * 인사동 · 오색시장 코스 추천 — `POST /api/courses/recommend` (지점 코스, by region).
 *
 * One call turns a set of 관심사 and a time slot into walking routes — since v2
 * TWO of them, a 실시간 코스 (scheduled from now, against opening hours) and a
 * 일반 코스 (clock-free, the same whenever it is asked). There is no per-tap
 * plan and no multi-day schedule (that was 제주's picker). 인사동 is always on
 * foot; 오색시장 takes a `transport` (WALK · BIKE · TRANSIT · CAR): legs within
 * 1 km are still walked, longer ones use the chosen mode (`moveMode` /
 * `moveMinutes` / `moveMeters` per stop, 오색 only).
 *
 * Endpoint: `POST /api/courses/recommend` with the venue's `region`; it answers
 * in the shape of the older `/api/insa/courses/recommend/v2`, which is still
 * asked (by kioskId) on a server without the 지점 route.
 *
 * Rules the API applies, so the screens never re-derive them:
 *  - `duration` is a slot, not minutes: `0-2`, `2-4`, `4-6`, `6+` hours. `6+` aims
 *    at 8 hours and never exceeds 10.
 *  - It closes at 22:00 unless a place stays open later.
 *  - A place is only used when open at arrival and for at least 30 minutes
 *    before closing. Restaurants only at lunch (11–14) and dinner (17–20); a
 *    course of 4+ hours contains exactly one meal.
 *  - Interests it could not place come back in `unmetInterests`.
 */

/** The four slots the API accepts, in the order the 체류 기간 chips show them. */
export type InsaDuration = '0-2' | '2-4' | '4-6' | '6+';

export const INSA_DURATIONS: readonly InsaDuration[] = ['0-2', '2-4', '4-6', '6+'];

export interface InsaCourseQuery {
  /**
   * 관심사 as the API matches them: the catalogue's own `aiCategoryKr`, number
   * prefix included (`2-화랑`, `9-카페`).
   */
  interests: string[];
  duration: InsaDuration;
  /** Group size, from the 방문 인원 chips (1 · 2 · 3 · 4 · 9 for 5~9 · 10 for 10+). */
  numberOfPeople: number;
  /** Local time the route starts, `YYYY-MM-DDTHH:mm:ss` (no zone). */
  startAt: string;
  /** 이동수단 — 오색시장 only (the server ignores it elsewhere). Omitted = WALK. */
  transport?: CourseTransport;
}

/** The 지점 코스 API's 이동수단 codes. */
export type CourseTransport = 'WALK' | 'BIKE' | 'TRANSIT' | 'CAR';

/**
 * One stop. The docs list only `shopId` + `stayMinutes`; the live endpoint also
 * schedules each stop, so those fields are carried when present. Name, photo and
 * address still come from the shop row the `shopId` points at.
 */
export interface InsaCourseSpot {
  shopId: number;
  /** Minutes spent here (`dwellMinutes` on the wire, `stayMinutes` in the docs). */
  stayMinutes: number;
  /** 1-based position in the route. */
  order: number;
  /** `HH:mm`, or '' when the API did not say. */
  arriveAt: string;
  leaveAt: string;
  /** Walking INTO this stop from the previous one (0 for the first). */
  walkMinutes: number;
  walkMeters: number;
  /**
   * The leg INTO this stop as actually travelled (오색 only; elsewhere the walk).
   * A leg ridden by bike / bus / car has walkMinutes 0 and its time here.
   */
  moveMode: CourseTransport;
  moveMinutes: number;
  moveMeters: number;
  /** The shop's second category (`9-카페`) — what the stop was picked for. */
  secondCategory: string;
  /**
   * How the opening hours were known. `default` means a category-typical guess,
   * which the screen must NOT show as a clock time.
   */
  hoursMethod: string;
  /**
   * 일반 코스 only: minutes since the start instead of a clock time. 0 when the
   * API gave none (the 실시간 코스 carries `arriveAt` / `leaveAt`).
   */
  arriveElapsedMinutes: number;
  leaveElapsedMinutes: number;
  /** The API's own name for the stop (일반 코스 rows carry one); '' when absent. */
  name: string;
  reservationRequired: boolean;
}

export interface InsaCourse {
  duration: InsaDuration;
  totalSpots: number;
  /** Stay + walking, start to finish. */
  totalMinutes: number;
  totalWalkMeters: number;
  /** `HH:mm`. */
  startAt: string;
  endAt: string;
  /** Interests the route could not include. */
  unmetInterests: string[];
  /** In visiting order. */
  spots: InsaCourseSpot[];
  /**
   * 실시간 코스 only. False when nothing is open for the asked time (night): the
   * route is empty and `unavailableReason` says why — NOT an error.
   */
  available: boolean;
  unavailableReason: string;
  /**
   * 일반 코스 only. True when it visits the same places in the same order as the
   * 실시간 코스, so a screen that shows one of them can drop the other.
   */
  sameAsRealtime: boolean;
}

/** The v2 answer: both routes for one request. */
export interface InsaCourseSet {
  duration: InsaDuration;
  numberOfPeople: number;
  realtime: InsaCourse;
  general: InsaCourse;
}
