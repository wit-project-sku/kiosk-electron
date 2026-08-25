import type { Shop } from '@shared/types/shop';
import type { JejuCourseKey, JejuTransport } from '@shared/types/jejuCourse';
import { stripPrefix } from '@renderer/lib/shops';

/**
 * Turns the 제주 questionnaire's answers into what
 * `POST /api/jeju/courses/recommend` expects.
 *
 * The questionnaire stores KOREAN labels on aiStore (that is deliberate — the
 * downstream matching is on the catalogue's Korean values, so a language switch
 * must not change what travels). The API wants codes and numbers, so the
 * translation happens here rather than in the screen.
 */

/**
 * Course key → course letter.
 *
 * The three cards on JejuAiResult are keyed `nature` / `food` / `family` and
 * labelled A코스 / B코스 / C코스 in the design; the API takes the letter. Same
 * pairing as COURSE_META in JejuAiDetail — keep the two in step.
 */
const COURSE_LETTERS: Record<string, JejuCourseKey> = {
  nature: 'A',
  food: 'B',
  family: 'C',
};

export const courseLetter = (courseKey: string): JejuCourseKey =>
  COURSE_LETTERS[courseKey] ?? 'A';

/**
 * 이동수단 chip → the API's code. The four chips are 1:1 with the four codes
 * the API accepts; anything else it answers 400 for.
 */
const TRANSPORTS: Record<string, JejuTransport> = {
  '도보': 'WALK',
  '자전거': 'BIKE',
  '대중교통': 'TRANSIT',
  '자동차': 'CAR',
};

/** Unanswered falls to CAR, which is what the summary bar has always defaulted to. */
export const transportCode = (label: string): JejuTransport => TRANSPORTS[label] ?? 'CAR';

/**
 * 방문 인원 chip → a party size.
 *
 * Two chips are RANGES (5 ~ 9명, 10명~) and the API wants one number, which it
 * uses to drop venues that cannot seat the group. The top of the range is sent,
 * so a party of nine is never routed to somewhere that seats five; the open
 * "10명~" has no top, so its own floor is the only honest number for it.
 */
const PARTY: Record<string, number> = {
  '1명': 1,
  '2명': 2,
  '3명': 3,
  '4명': 4,
  '5 ~ 9명': 9,
  '10명~': 10,
};

export const partySize = (label: string): number => PARTY[label] ?? 2;

/** 체류 기간 chip → 박수. `days` comes back as this + 1, capped at 4 by the server. */
const NIGHTS: Record<string, number> = {
  '당일치기': 0,
  '1박 2일': 1,
  '2박 3일': 2,
  '3박 이상': 3,
};

export const nightCount = (label: string): number => NIGHTS[label] ?? 0;

/**
 * 즐길 거리 picks → the `aiCategoryKr` values the API matches on.
 *
 * ★ The API matches the category VERBATIM, prefix included ("22-섬 여행"), while
 * the questionnaire stores the stripped label ("섬 여행") because that is what
 * the tiles and the catalogue-side matching use. The prefix is recovered from
 * the shop catalogue the kiosk already holds — the same rows the server is
 * scheduling — rather than re-derived from the tile's position, so a category
 * renumbered in the admin web cannot silently stop matching.
 *
 * A pick that no shop carries keeps its bare label. That is not a failure: the
 * only such tile today is K-POP 체험, which has no rows at all, and sending it
 * unprefixed gets it back in `unmetInterests` — which is exactly the truth.
 */
export function interestCodes(interests: string[], shops: Shop[]): string[] {
  const byStripped = new Map<string, string>();
  for (const shop of shops) {
    const raw = shop.aiCategoryKr?.trim();
    if (!raw) continue;
    const key = stripPrefix(raw);
    if (key && !byStripped.has(key)) byStripped.set(key, raw);
  }
  return interests.map((i) => byStripped.get(i) ?? i);
}

/** Today, as the API's `visitDate` — local date, never UTC. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * 난이도 as a word.
 *
 * The API grades 1 upward; the design's own vocabulary is 쉬움 / 보통, and
 * 어려움 continues it. `0` is the normalizer's "no grade given" and yields an
 * empty string so the row can be left off rather than labelled wrongly.
 */
const DIFFICULTY = ['', '쉬움', '보통', '어려움'];

export const difficultyLabel = (level: number): string =>
  DIFFICULTY[level] ?? DIFFICULTY[DIFFICULTY.length - 1]!;

/**
 * Minutes as Korean duration text — 30 → "30분", 60 → "1시간",
 * 150 → "2시간 30분". Used for both the course total and each spot's stay.
 */
export function minutesLabel(total: number): string {
  const mins = Math.max(0, Math.round(total));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}
