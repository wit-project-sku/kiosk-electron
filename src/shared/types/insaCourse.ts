/**
 * 인사동 코스 추천 — `POST /api/insa/courses/recommend`.
 *
 * One call turns a set of 관심사 and a time slot into ONE walking route. There is
 * no per-tap plan and no multi-day schedule (that was 제주's picker), and no
 * party / transport: it is always on foot, from the kiosk's own position.
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
  /** Local time the route starts, `YYYY-MM-DDTHH:mm:ss` (no zone). */
  startAt: string;
}

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
  /** The shop's second category (`9-카페`) — what the stop was picked for. */
  secondCategory: string;
  /**
   * How the opening hours were known. `default` means a category-typical guess,
   * which the screen must NOT show as a clock time.
   */
  hoursMethod: string;
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
}
