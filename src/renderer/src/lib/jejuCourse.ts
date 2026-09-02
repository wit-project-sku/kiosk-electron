import type { Shop } from '@shared/types/shop';
import type { JejuCourseKey, JejuTransport } from '@shared/types/jejuCourse';
import { stripPrefix } from '@renderer/lib/shops';
import { pick, type Lang } from '@renderer/lib/i18n';

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

/** Rail letter → the header subtitle, e.g. A코스 / Course A. */
const COURSE_RAIL: Record<string, Partial<Record<Lang, string>>> = {
  A: {
    ko: 'A코스', en: 'Course A', ja: 'Aコース', zh: 'A路线',
    vi: 'Lộ trình A', th: 'คอร์ส A', ru: 'Маршрут A', id: 'Rute A',
  },
  B: {
    ko: 'B코스', en: 'Course B', ja: 'Bコース', zh: 'B路线',
    vi: 'Lộ trình B', th: 'คอร์ส B', ru: 'Маршрут B', id: 'Rute B',
  },
  C: {
    ko: 'C코스', en: 'Course C', ja: 'Cコース', zh: 'C路线',
    vi: 'Lộ trình C', th: 'คอร์ส C', ru: 'Маршрут C', id: 'Rute C',
  },
};

const DAY_PART: Partial<Record<Lang, (day: number) => string>> = {
  ko: (d) => `${d}일차`,
  en: (d) => `Day ${d}`,
  ja: (d) => `${d}日目`,
  zh: (d) => `第${d}天`,
  vi: (d) => `Ngày ${d}`,
  th: (d) => `วันที่ ${d}`,
  ru: (d) => `День ${d}`,
  id: (d) => `Hari ${d}`,
};

/** Header subtitle on the course detail and AI spot detail — "A코스 - 1일차". */
export function jejuCourseDayTitle(letter: string, day: number, lang: Lang): string {
  const rail = pick(COURSE_RAIL[letter] ?? { ko: `${letter}코스` }, lang);
  const fmt = DAY_PART[lang] ?? DAY_PART.en ?? DAY_PART.ko;
  const dayPart = fmt ? fmt(day) : `${day}`;
  return `${rail} - ${dayPart}`;
}

const ABOUT_PREFIX: Partial<Record<Lang, string>> = {
  ko: '약 ',
  en: 'Approx. ',
  ja: '約',
  zh: '约 ',
  vi: 'Khoảng ',
  th: 'ประมาณ ',
  ru: 'Около ',
  id: 'Sekitar ',
};

/**
 * Minutes as duration text — 30 → "30분" / "30 min", 60 → "1시간" / "1 hr".
 * Used for both the course total and each spot's stay.
 */
export function minutesLabel(total: number, lang: Lang = 'ko'): string {
  const mins = Math.max(0, Math.round(total));
  const h = Math.floor(mins / 60);
  const m = mins % 60;

  if (lang === 'ko') {
    if (h === 0) return `${m}분`;
    if (m === 0) return `${h}시간`;
    return `${h}시간 ${m}분`;
  }

  if (h === 0) {
    return pick(
      {
        en: `${m} min`, ja: `${m}分`, zh: `${m} 分钟`, vi: `${m} phút`,
        th: `${m} นาที`, ru: `${m} мин`, id: `${m} menit`,
      },
      lang,
    );
  }
  if (m === 0) {
    return pick(
      {
        en: `${h} hr`, ja: `${h}時間`, zh: `${h} 小时`, vi: `${h} giờ`,
        th: `${h} ชม.`, ru: `${h} ч`, id: `${h} jam`,
      },
      lang,
    );
  }
  return pick(
    {
      en: `${h} hr ${m} min`, ja: `${h}時間${m}分`, zh: `${h} 小时 ${m} 分钟`,
      vi: `${h} giờ ${m} phút`, th: `${h} ชม. ${m} นาที`, ru: `${h} ч ${m} мин`,
      id: `${h} jam ${m} menit`,
    },
    lang,
  );
}

/** "약 30분" / "Approx. 30 min" — summary-bar totals from the API. */
export function aboutMinutesLabel(total: number, lang: Lang): string {
  if (lang === 'ko') return `약 ${minutesLabel(total, lang)}`;
  const prefix = pick(ABOUT_PREFIX, lang);
  return `${prefix}${minutesLabel(total, lang)}`;
}
