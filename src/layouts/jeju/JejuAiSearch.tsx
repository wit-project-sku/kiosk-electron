/**
 * 제주 '제주' 뭐하지 (AI 검색) questionnaire — Figma nodes 6336:67302 (resting)
 * and 6289:54956 (with picks), the 2026-08-24 redesign of 6050:142613.
 *
 * Four filters (방문 인원 · 체류 기간 · 이동수단 · 즐길 거리) and a CTA that hands
 * the picked interests to the shared aiStore and moves to the result screen —
 * the same flow OsanAiSearch uses.
 *
 * The redesign left every coordinate alone and changed only how a plate looks:
 * see the header of JejuAiSearch.module.css.
 *
 * ── The course picker in front of it (Figma 7019:17890) ──────────────────
 * The page now opens on a landing rather than on the questions: one wide AI 맞춤
 * 추천 코스 card and four themed course cards. It is a STAGE of this screen, not
 * a screen of its own, so the customer display, analytics and every caller of
 * `navigate('ai_search')` are unchanged — the same way the ♿ layout already
 * splits the questionnaire into steps inside this component.
 *
 *   AI 맞춤 추천 코스 → the full questionnaire below → the course detail.
 *       The A/B/C chooser (JejuAiResult) that used to sit between them is
 *       dropped (2026-09-11); the course letter the API still needs now follows
 *       the visitor's own 즐길 거리 — see courseForInterests.
 *   any themed card   → the THEMED questionnaire (Figma 6336:67302) → that
 *       course's detail (7058:22277). The themed page is the same component
 *       with `themeKey` set: the region map on top, then 방문 인원 · 체류 기간 ·
 *       이동수단 and 코스 추천받기, and no 즐길 거리 — the theme already says what
 *       the day is for. Its CTA skips the A/B/C chooser: the theme IS the course.
 *       자연·유산 / 맛집·감성 / 가족·체험 are the result page's three courses
 *       (A / B / C); 쇼핑·로컬 borrows B and sends its shopping 즐길 거리 with it,
 *       since the API has no fourth letter — see SHOP_PRESET and COURSE_LETTERS.
 *
 * ★ The region pick is stored on aiStore and sent to /recommend as `region`
 *   (JEJU_CITY · EAST · WEST · SEOGWIPO). See jejuRegionMap.ts.
 *
 * 뒤로 follows the stages: questions → picker → home. A course detail returns
 * to the questions it came from, in the right variant (aiStore.resumeQuestions
 * + aiStore.entry / course).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useAiStore } from '@renderer/store/aiStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useShopStore } from '@renderer/store/shopStore';
import { useKioskStore } from '@renderer/store/kioskStore';
import { isOk } from '@shared/types/result';
import type { JejuPickerDay, JejuPickerPlan, JejuPickerQuery } from '@shared/types/jejuCourse';
import {
  interestCodes,
  minutesLabel,
  nightCount,
  partySize,
  nowMinutes,
  todayIso,
  transportCode,
} from '@renderer/lib/jejuCourse';
import { pick } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { sheetText, t } from '@renderer/lib/loc';
import { aiCatLabel } from '@renderer/lib/aiCategoryLabel';
import { AI_CATEGORIES_JEJU } from '@renderer/data/aiCategories-jeju.generated';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { COURSES } from './JejuAiResult';
import {
  DEFAULT_REGION,
  HALLASAN,
  ISLANDS,
  REGION_FILL,
  REGION_FILL_PICKED,
  REGION_MAP_SIZE,
  REGIONS,
  type JejuRegionId,
} from './jejuRegionMap';
import { JejuPageFrame } from './JejuPageFrame';
import styles from './JejuAiSearch.module.css';
import { belowModeBar, LOW_REACH_BANNER_HEIGHT, LOW_REACH_HERO_HEIGHT } from './lowReach';

interface Props {
  controller: KioskController;
}

/*
 * ── 커스텀 코스 picker — POST /api/jeju/courses/picker ──────────────────
 *
 * The 즐길 거리 grid is no longer "pick three". Every tap adds one real place —
 * the one the visitor can reach soonest that is open that date and for the
 * whole stay — and takes its travel, wait and stay out of a 09:00–21:00 day;
 * the answer says which tiles still fit, so the rest grey out. There is no cap:
 * the day is the cap. Tap order is the route. Rules: JejuPickerPlan.
 *
 * None of this copy is in Localization_Jeju yet, so it is authored in the eight
 * languages here, the way SECTION is.
 */

/**
 * The 즐길 거리 day tabs (Figma 7229:100741). Each tab IS a day the visitor
 * fills: a tap adds the tile to the day in view, and the same tile can be picked
 * on several days (2026-09-15). See `dayPicks` and `dayQueries`.
 */
const DAY_TAB: Partial<Record<Lang, (n: number) => string>> = {
  ko: (n) => `${n}일차`, en: (n) => `Day ${n}`, ja: (n) => `${n}日目`, zh: (n) => `第${n}天`,
  vi: (n) => `Ngày ${n}`, th: (n) => `วันที่ ${n}`, ru: (n) => `День ${n}`, id: (n) => `Hari ${n}`,
};
/** Localization_Jeju_v2's day tabs (1일차 … 4일차). A 5th day has no row and keeps DAY_TAB. */
const DAY_TAB_KEYS = ['1st_day', '2nd_day', '3rd_day', '4th_day'];
const dayTabLabel = (n: number, lang: Lang): string => {
  const authored = (DAY_TAB[lang] ?? DAY_TAB.ko)!(n);
  const key = DAY_TAB_KEYS[n - 1];
  return key ? sheetText(key, lang, { [lang]: authored }) : authored;
};

type Template = Partial<Record<Lang, (value: string) => string>>;
const fill = (template: Template, lang: Lang, value: string): string =>
  (template[lang] ?? template.en ?? template.ko)!(value);

/** The gauge on the tab row (Figma 7249:9687, "3시간 30분 소요") — time the
 *  day in view already takes, i.e. the filled part of the bar. */
const USED: Template = {
  ko: (t) => `${t} 소요`, en: (t) => `${t} planned`, ja: (t) => `所要 ${t}`, zh: (t) => `需时 ${t}`,
  vi: (t) => `Mất ${t}`, th: (t) => `ใช้เวลา ${t}`, ru: (t) => `Занято ${t}`, id: (t) => `Butuh ${t}`,
};

/** No tile fits the day any more and its time is (nearly) spent. */
const PLAN_FULL = {
  ko: '일정이 가득 찼어요', en: 'This day is full', ja: '予定がいっぱいです', zh: '行程已满',
  vi: 'Ngày này đã kín', th: 'วันนี้เต็มแล้ว', ru: 'День заполнен', id: 'Hari ini sudah penuh',
};

/** No tile fits but real time is left — the places ran out, not the day. */
const NO_MORE_PLACES = {
  ko: '더 갈 수 있는 곳이 없어요', en: 'No more places to add', ja: 'これ以上行ける場所がありません',
  zh: '没有更多可去的地方', vi: 'Không còn nơi để thêm', th: 'ไม่มีสถานที่ให้เพิ่มแล้ว',
  ru: 'Больше некуда добавить', id: 'Tidak ada tempat lagi',
};
const FULL_WITH_TIME_LEFT_MIN = 60;

/** Every day after the first starts at 09:00 (the picker's own day start). */
const DAY_START_MIN = 540;

/** `YYYY-MM-DD` plus `n` calendar days. UTC arithmetic on a date with no time, so no zone can shift it. */
const addDaysIso = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
};

/** "9-카페" → "카페": the API's category with its catalogue prefix dropped. */
const stripCatPrefix = (cat: string): string => cat.replace(/^\d+-/, '');

/** `days` with day `d`'s list replaced, growing the array when `d` is new. */
const withDay = (days: number[][], d: number, list: number[]): number[][] => {
  const next = days.slice();
  while (next.length <= d) next.push([]);
  next[d] = list;
  return next;
};

/**
 * The day plans as ONE trip, in the shape the course detail reads. Days keep
 * their own dates and minutes; a day with no stops stays empty (the detail leaves
 * it out) rather than repeating DAY 1 — the visitor chose each day.
 */
function mergeDayPlans(plans: JejuPickerPlan[], visitDate: string): JejuPickerPlan {
  const days: JejuPickerDay[] = plans.map((p, d) => ({ ...p.days[0]!, day: d + 1, repeat: null }));
  const sum = (f: (day: JejuPickerDay) => number): number => days.reduce((n, day) => n + f(day), 0);
  return {
    visitDate,
    dayCount: days.length,
    budgetMinutes: sum((day) => day.budgetMinutes),
    usedMinutes: sum((day) => day.usedMinutes),
    remainingMinutes: sum((day) => day.remainingMinutes),
    currentDay: 1,
    full: plans.every((p) => p.full),
    days,
    categories: [],
    dropped: [],
  };
}

/**
 * Chip copy comes from Localization_Jeju (Visitor_* / StayTime_* /
 * Transportation_*), exactly as OsanAiSearch reads its own sheet. The Korean
 * here is the fallback shown only when the key is missing from the table, and
 * it is ALSO what travels to the AI store — the course summary and the shop
 * matching downstream are keyed on Korean, so a localized chip must not change
 * what gets sent.
 */
const VISITORS = [
  { key: 'Visitor_1', label: '1명', width: 268 },
  { key: 'Visitor_2', label: '2명', width: 269 },
  { key: 'Visitor_3', label: '3명', width: 268 },
  { key: 'Visitor_4', label: '4명', width: 268 },
  { key: 'Visitor_5', label: '5 ~ 9명', width: 311 },
  { key: 'Visitor_6', label: '10명~', width: 290 },
];

/** 체류 기간 and 이동수단 — four equal 412px chips each. */
const STAY = [
  { key: 'StayTime_1', label: '당일치기' },
  { key: 'StayTime_2', label: '1박 2일' },
  { key: 'StayTime_3', label: '2박 3일' },
  // The sheet renamed this chip 3박 이상 → 3박 4일 (the API caps a trip at 4 days).
  { key: 'StayTime_4', label: '3박 4일' },
];
const TRANSPORT = [
  { key: 'Transportation_1', label: '도보' },
  { key: 'Transportation_2', label: '자전거' },
  { key: 'Transportation_3', label: '대중교통' },
  { key: 'Transportation_4', label: '자동차' },
];

/**
 * 이동수단 starts on 자동차 (the 4th chip), not the frame's first chip.
 *
 * On 도보 the picker only counts places within 2 km of the previous stop — the
 * kiosk, for the first tap — so a visitor who never touched this row opened the
 * 커스텀 코스 grid with most tiles already greyed "너무 멀어요" (21–24 of 30,
 * measured on stage for kiosks 6·7·8; by car 28 of 30 are open). Most visitors
 * to Jeju drive, and 자동차 is also what the course code has always assumed for
 * an unanswered 이동수단 (see transportCode). The themed questionnaire shares
 * this row, so it rests on the same chip.
 */
const DEFAULT_TRANSPORT = TRANSPORT.findIndex((t) => t.label === '자동차');

/**
 * Section headings.
 *
 * ★ NONE of these four keys is in Localization_Jeju — checked 2026-08-27:
 * VisitorCount, StayTime, JoyContent and the heading for 이동수단 are all
 * absent, so `s()` fell through to its authored string and every heading on this
 * page read KOREAN in all eight languages while the chips beneath them were
 * fully translated. (Only the CHIP rows exist — Visitor_*, StayTime_*,
 * Transportation_* — which is what made the gap easy to miss.)
 *
 * So the labels are authored here in all eight languages, the same way
 * NEXT_LABEL is. The sheet key stays on each one and still WINS when present:
 * add the row and the authored copy steps aside with no release.
 */
const SECTION = {
  visitors: {
    key: 'VisitorCount',
    label: {
      ko: '방문 인원', en: 'Group size', ja: '訪問人数', zh: '同行人数',
      vi: 'Số người', th: 'จำนวนผู้มา', ru: 'Количество гостей', id: 'Jumlah orang',
    },
  },
  stay: {
    key: 'StayTime',
    label: {
      ko: '체류 기간', en: 'Length of stay', ja: '滞在期間', zh: '停留时间',
      vi: 'Thời gian lưu trú', th: 'ระยะเวลาพำนัก', ru: 'Срок пребывания', id: 'Lama menginap',
    },
  },
  transport: {
    key: 'Transportation',
    label: {
      ko: '이동수단', en: 'Getting around', ja: '移動手段', zh: '交通方式',
      vi: 'Phương tiện di chuyển', th: 'การเดินทาง', ru: 'Транспорт', id: 'Transportasi',
    },
  },
  interests: {
    key: 'JoyContent',
    label: {
      ko: '즐길 거리', en: 'What to enjoy', ja: '楽しみ方', zh: '体验项目',
      vi: 'Hoạt động yêu thích', th: 'กิจกรรมที่สนใจ', ru: 'Что интересно', id: 'Aktivitas',
    },
  },
} as const satisfies Record<string, { key: string; label: Partial<Record<Lang, string>> }>;

/**
 * 즐길 거리 — 30 tiles in 5 rows × 6 columns, each carrying its own text colour.
 *
 * Colours are read per-tile from the Figma rather than derived from a palette
 * sequence (which is how Osan does it): here they group by theme — food #f59993,
 * 특산품 #ffa37e, 차/술 #82caa8, 체험 #a9a3d9, K-POP/사진 #6ea8eb, 자연 #6375bf,
 * 쇼핑 #c89b7b. `\n` marks the two-line labels drawn in the design.
 *
 * The LABELS now come from AICategory_Jeju via AI_CATEGORIES_JEJU (30 rows, all
 * 8 languages, in this exact order) — the same source OsanAiSearch reads. Only
 * the colours, the Figma's two-line Korean and the catalogue overrides stay
 * here, indexed 1:1 against that array.
 *
 * The catalogue match key is NOT the displayed label: JejuAiDetail matches the
 * shop's `aiCategoryKr` (prefix stripped), and the sheet does not always spell a
 * category the way the catalogue does. Verified 2026-08-13 against
 * `/api/shops?kioskId=7` (29 distinct categories over 310 rows):
 *   - the sheet writes 레저·'엑'티비티, the catalogue 레저·'액'티비티 (13 shops) —
 *     taking the sheet's spelling would silently empty that tile, so `cat` pins it;
 *   - the sheet's 제주 향토음식 and 오름·트래킹 now agree with the catalogue, so the
 *     overrides those two used to need are gone;
 *   - K-POP 체험 still has no rows at all, as before.
 */
interface Interest {
  color: string;
  /**
   * The Figma's exact Korean, when it differs from the sheet's. Two tiles are
   * drawn on two lines (`\n`) and the tile CSS is `white-space: pre`, so the
   * break has to be authored; the sheet stores every label on one line. Korean
   * uses this, every other language uses the sheet value.
   */
  ko?: string;
  /** Catalogue `aiCategoryKr` when the sheet spells it differently. */
  cat?: string;
}

/**
 * Per-tile colour / Korean line-break / catalogue override, positionally matched
 * to AI_CATEGORIES_JEJU. A row reordered in the sheet must be reordered here
 * too — the arrays are joined by index, which is what keeps the colour groups
 * (food → 특산품 → 차·술 → 체험 → K-POP·사진 → 자연 → 쇼핑) reading as bands.
 */
const INTERESTS: Interest[] = [
  { color: '#f59993' },                              // 흑돼지
  { color: '#f59993' },                              // 해산물·회
  { color: '#f59993' },                              // 갈치·고등어
  { color: '#f59993' },                              // 고기국수
  { color: '#f59993', ko: '제주\n향토음식' },
  { color: '#f59993' },                              // 한식

  /* Colours from Figma 7229:100741, which regrouped the grid (see TILE_ORDER):
     카페 · 제주특산품 · 차 · 술 are one purple band, the 체험 tiles one green. */
  { color: '#f59993' },                              // 한정식
  { color: '#f59993', ko: '뷔페' },                  // 호텔뷔페 — the frame's label
  { color: '#a9a3d9' },                              // 카페
  { color: '#a9a3d9' },                              // 제주특산품
  { color: '#a9a3d9' },                              // 전통차
  { color: '#a9a3d9' },                              // 막걸리

  { color: '#a9a3d9' },                              // 전통주
  { color: '#81caa8' },                              // 해녀 체험
  { color: '#81caa8' },                              // 감귤 체험
  { color: '#81caa8' },                              // 승마 체험
  { color: '#81caa8', ko: '레저·\n액티비티', cat: '레저·액티비티' },
  // Figma draws 바·펍·라운지 in this tile's slot; the sheet has no such category
  // yet, so the sheet's K-POP 체험 keeps the slot, in that row's purple.
  { color: '#a9a3d9' },                              // K-POP 체험

  { color: '#6ea8eb' },                              // 사진 촬영
  { color: '#6375bf' },                              // 자연명소
  { color: '#6375bf' },                              // 해변
  { color: '#6375bf' },                              // 섬 여행
  { color: '#6375bf' },                              // 오름·트래킹
  { color: '#6375bf' },                              // 역사유적지

  { color: '#c89b7b' },                              // 제주 기념품
  { color: '#c89b7b' },                              // 공예품
  { color: '#c89b7b' },                              // 전통시장
  { color: '#c89b7b', ko: '전시관·\n문화공간' },
  { color: '#c89b7b' },                              // 로컬샵
  { color: '#c89b7b' },                              // 기타
];

/**
 * The grid's DISPLAY order, as sheet indices — Figma 7229:100741's rows:
 *   흑돼지 … 한식 · 한정식 뷔페 + the 체험 tiles · 카페 특산품 차 술 (+ K-POP 체험 in
 *   the frame's 바·펍·라운지 slot) · 사진 + 자연 · 쇼핑.
 * INTERESTS and AI_CATEGORIES_JEJU stay in sheet order (they are joined by
 * index); only where each tile is drawn follows the frame.
 */
const TILE_ORDER: readonly number[] = [
  0, 1, 2, 3, 4, 5,
  6, 7, 13, 14, 15, 16,
  8, 9, 10, 11, 12, 17,
  18, 19, 20, 21, 22, 23,
  24, 25, 26, 27, 28, 29,
];

/** The catalogue category tile `i` matches — the override, else the sheet's ko. */
const interestCat = (i: number): string =>
  INTERESTS[i]?.cat ?? AI_CATEGORIES_JEJU[i]?.ko ?? '';

/** The tile for a stored (stripped) category — the inverse of interestCat. */
const tileIndexOf = (cat: string): number => INTERESTS.findIndex((_, i) => interestCat(i) === cat);

/** A chip's index from its stored Korean label, or `fallback` when there is none. */
const labelIndex = (list: readonly { label: string }[], label: string | undefined, fallback: number): number => {
  const i = label ? list.findIndex((item) => item.label === label) : -1;
  return i >= 0 ? i : fallback;
};

/**
 * Which of the API's three courses an AI 맞춤 request is sent as.
 *
 * The recommend API still requires a course letter (A · B · C — JejuCourseKey),
 * and the A/B/C chooser that used to let the visitor pick one is gone: 코스
 * 추천받기 now goes straight to the detail. Rather than sending every custom
 * course as 'A' (자연·유산), the letter follows the visitor's own 즐길 거리, by the
 * colour bands the grid is already drawn in:
 *   자연                              → nature (A · 자연·유산)
 *   food · 특산품 · 차·술 · 쇼핑       → food   (B · 맛집·감성 — its tags are
 *                                        #미식 #감성 #로컬, the same borrowing
 *                                        the 쇼핑·로컬 theme makes)
 *   체험 · K-POP·사진                  → family (C · 가족·체험)
 * The majority band wins; a tie goes to whichever of them was picked first (the
 * selection is a Set, which keeps pick order). The picks still travel as
 * `interests`, which the API guarantees to fit into the day whatever the letter.
 */
const COURSE_FOR_BAND: Record<string, 'nature' | 'food' | 'family'> = {
  '#6375bf': 'nature',
  '#f59993': 'food',
  '#a9a3d9': 'food', //   카페 · 특산품 · 차 · 술 (7229:100741's purple band)
  '#c89b7b': 'food',
  '#81caa8': 'family', // 체험 (its green band)
  '#6ea8eb': 'family',
};

const courseForInterests = (picked: number[]): 'nature' | 'food' | 'family' => {
  const keys = picked.map((i) => COURSE_FOR_BAND[INTERESTS[i]?.color ?? ''] ?? 'nature');
  const count = new Map<string, number>();
  for (const k of keys) count.set(k, (count.get(k) ?? 0) + 1);
  let best = keys[0] ?? 'nature';
  for (const k of keys) if ((count.get(k) ?? 0) > (count.get(best) ?? 0)) best = k;
  return best;
};

const COLS = 6;

/**
 * Row `top` for each block, in artboard px (see the CSS header comment) —
 * Figma 7229:100741, which closed the gap between blocks from 100 to 50 and put
 * the day tabs between the 즐길 거리 heading and its grid.
 */
const Y = {
  visitorsLabel: 699,
  visitorsRow: 835,
  stayLabel: 1078,
  stayRow: 1214,
  transportLabel: 1457,
  transportRow: 1593,
  interestsLabel: 1836,
} as const;

/**
 * The themed questionnaire's rows (Figma 6336:67302). The region map takes
 * 699…1515 and the frame keeps its 100 gap under it, so the three chip groups
 * start 916 lower than the AI 맞춤 page's and keep their own 429 pitch. No
 * 즐길 거리 row — `interestsLabel` is carried only to keep `y` one shape.
 */
const Y_THEME = {
  visitorsLabel: 1615,
  visitorsRow: 1751,
  stayLabel: 2044,
  stayRow: 2180,
  transportLabel: 2473,
  transportRow: 2609,
  interestsLabel: 0,
} as const;

/**
 * Low-reach coordinates — Figma 6336:67216 / 6326:81769 (step 1) and
 * 6336:99702 / 6326:81686 (step 2).
 *
 * The hero banner eats the top 1181px and the header runs to y1906, which
 * leaves about 1700px of reachable page — enough for THREE chip groups or the
 * 즐길 거리 grid, but not both. So the low-reach layout splits the questionnaire
 * into two steps; see `step`. Both steps start their content at y1906 and put
 * the CTA at y3432.
 *
 * Step 1 stacks [label 76 · gap 60 · row 193] = 329 with a 100 gap:
 *   1906 label  2042 row   ·   2335 label  2471 row   ·   2764 label  2900 row
 * ending at 3093, which is the 1187 the frame's 선택영역 box states.
 */
const Y_LOW = {
  visitorsLabel: 1906,
  visitorsRow: 2042,
  stayLabel: 2335,
  stayRow: 2471,
  transportLabel: 2764,
  transportRow: 2900,
  interestsLabel: 1906,
} as const;

/**
 * Day tabs, then the grid, each 60 under the block above: 1972 / 2133 on the
 * standard frame (measured on 7229:100741's render). ♿ has no frame with the
 * tabs yet, so its step 2 takes the same 60 · 101 · 60 under its own heading
 * (1906): tabs at 2042 — where the grid used to start — and the grid 161 lower.
 */
const TABS_TOP = 1972;
const TABS_TOP_LOW = 2042;
const GRID_TOP = 2133;
const GRID_TOP_LOW = 2203;
/** The gauge sits 31 down the 101-tall tab row (Figma 7249:9687). */
const GAUGE_OFFSET = 31;

const GRID_ROW_STEP = 244;

/**
 * CTA top: 3374 on the standard frame (CSS). ♿: the grid now ends at 3394, so
 * the CTA sits 50 under it at 3444 (it was 3432) and ends at 3622, clear of the
 * artboard's foot; step 1 uses the same top.
 */
const CTA_TOP_LOW = 3444;

/**
 * Step-1 CTA. Authored rather than fetched: Localization_Jeju has no row for it
 * (the low-reach split is new and the sheet only knows the single-page flow),
 * which is the same reason JejuAiDetail authors its 모바일에서 확인하기 label.
 */
const NEXT_LABEL = {
  ko: '다음으로',
  en: 'Next',
  ja: '次へ',
  zh: '下一步',
  vi: 'Tiếp theo',
  th: 'ถัดไป',
  ru: 'Далее',
  id: 'Berikutnya',
};

/**
 * The CTA once every question is answered — Figma 6289:54956's "코스 추천받기".
 *
 * Read from Localization_Jeju_v2's `SubmitButton` ("코스 추천받기"), the row the
 * sheet added for this button — NOT the mascot-worded AI_SubmitButton, which
 * the v2 tab retired. This table fills the languages the row leaves empty.
 */
const SUBMIT_LABEL = {
  ko: '코스 추천받기',
  en: 'Get course recommendations',
  ja: 'コースをおすすめしてもらう',
  zh: '获取路线推荐',
  vi: 'Nhận gợi ý lộ trình',
  th: 'รับเส้นทางแนะนำ',
  ru: 'Получить маршрут',
  id: 'Dapatkan rekomendasi rute',
};

/*
 * ── Course picker copy (Figma 7088:23517, redraw of 7019:17890) ──
 * Localization_Jeju_v2 carries this page's copy (Jeju_Todo_Subtitle1*,
 * My_Course_*, Recommended_Course_*), so the sheet is the source everywhere
 * below; these eight-language tables only fill the cells it leaves empty —
 * most of those rows are Korean-only so far.
 */
/** The landing's description — `Jeju_Todo_Subtitle1` ("코스를 선택해 주세요"). */
const PICK_SUBTITLE = {
  ko: '코스를 선택해주세요', en: 'Choose a course', ja: 'コースを選んでください', zh: '请选择路线',
  vi: 'Hãy chọn lộ trình', th: 'กรุณาเลือกเส้นทาง', ru: 'Выберите маршрут', id: 'Silakan pilih rute',
};

/**
 * The orange note — Bold, with the frame's leading asterisk since 7088:23517.
 *
 * It names where every course on this page STARTS, and that is this kiosk: the
 * course APIs (/recommend and /picker) measure DAY 1's first leg from the
 * requesting kiosk's own coordinates — verified on stage 2026-09-14, 8 of 8
 * first legs from kiosk 7 measure from the ferry terminal, none from the
 * airport. The frame's copy only ever said 제주 공항, which was false on W007
 * and W008, so the note is per kiosk. Keyed by kiosk id, not layout: W006 and
 * W007 share JEJU_AIRPORT but start from different places. An id not listed
 * keeps the frame's own airport copy.
 */
const PICK_NOTE_BY_KIOSK: Record<string, Partial<Record<Lang, string>>> = {
  // W006 제주공항 — the frame's copy.
  W006: {
    ko: '*모든 추천코스는 제주 공항을 기준으로 제작되었습니다.',
    en: '*All recommended courses start from Jeju Airport.',
    ja: '*すべてのおすすめコースは済州空港を起点に作成されています。',
    zh: '*所有推荐路线均以济州机场为起点制作。',
    vi: '*Tất cả lộ trình gợi ý đều lấy Sân bay Jeju làm điểm xuất phát.',
    th: '*เส้นทางแนะนำทั้งหมดจัดทำโดยใช้สนามบินเชจูเป็นจุดเริ่มต้น',
    ru: '*Все рекомендуемые маршруты составлены от аэропорта Чеджу.',
    id: '*Semua rute rekomendasi dibuat dengan Bandara Jeju sebagai titik awal.',
  },
  // W007 제주국제여객터미널. The Korean runs to two lines at 60px; the note has
  // room for them above the 커스텀 코스 heading (694 + 2 × 72 = 838 < 897).
  W007: {
    ko: '*모든 추천코스는 제주국제여객터미널을 기준으로 제작되었습니다.',
    en: '*All recommended courses start from Jeju International Ferry Terminal.',
    ja: '*すべてのおすすめコースは済州国際旅客ターミナルを起点に作成されています。',
    zh: '*所有推荐路线均以济州国际客运码头为起点制作。',
    vi: '*Tất cả lộ trình gợi ý đều lấy Bến tàu khách quốc tế Jeju làm điểm xuất phát.',
    th: '*เส้นทางแนะนำทั้งหมดจัดทำโดยใช้ท่าเรือโดยสารระหว่างประเทศเชจูเป็นจุดเริ่มต้น',
    ru: '*Все рекомендуемые маршруты составлены от международного пассажирского терминала Чеджу.',
    id: '*Semua rute rekomendasi dibuat dengan Terminal Penumpang Internasional Jeju sebagai titik awal.',
  },
  // W008 세계자연유산본부.
  W008: {
    ko: '*모든 추천코스는 세계자연유산본부를 기준으로 제작되었습니다.',
    en: '*All recommended courses start from the World Natural Heritage Center.',
    ja: '*すべてのおすすめコースは世界自然遺産本部を起点に作成されています。',
    zh: '*所有推荐路线均以世界自然遗产本部为起点制作。',
    vi: '*Tất cả lộ trình gợi ý đều lấy Trụ sở Di sản Thiên nhiên Thế giới làm điểm xuất phát.',
    th: '*เส้นทางแนะนำทั้งหมดจัดทำโดยใช้สำนักงานมรดกโลกทางธรรมชาติเป็นจุดเริ่มต้น',
    ru: '*Все рекомендуемые маршруты составлены от Центра всемирного природного наследия.',
    id: '*Semua rute rekomendasi dibuat dengan Kantor Warisan Alam Dunia sebagai titik awal.',
  },
};

/** This kiosk's note — the airport copy for any id the table does not list. */
const pickNoteFor = (kioskId: string): Partial<Record<Lang, string>> =>
  PICK_NOTE_BY_KIOSK[kioskId] ?? PICK_NOTE_BY_KIOSK.W006!;

/**
 * The sheet's row for this kiosk's note: Jeju_Todo_Subtitle1-1 (제주 공항) and
 * Jeju_Todo_Subtitle1-2 (제주항 여객터미널). The sheet marks 1-2 for the 유산 centre
 * too, but its copy names the ferry terminal while W008's courses start at
 * 세계자연유산본부 (see above), so W008 keeps its own authored note until the
 * sheet has a row that names it.
 */
const PICK_NOTE_KEY: Record<string, string> = {
  W006: 'Jeju_Todo_Subtitle1-1',
  W007: 'Jeju_Todo_Subtitle1-2',
};

/** The orange note, with the frame's leading asterisk the sheet's copy omits. */
const pickNoteText = (kioskId: string, lang: Lang): string => {
  const authored = pickNoteFor(kioskId);
  const key = PICK_NOTE_KEY[kioskId] ?? (PICK_NOTE_BY_KIOSK[kioskId] ? undefined : PICK_NOTE_KEY.W006);
  const text = key ? sheetText(key, lang, authored) : pick(authored, lang);
  return text.startsWith('*') ? text : `*${text}`;
};

/**
 * The 커스텀 코스 card (7088:23517 renamed it from AI 맞춤 추천 코스). Its title
 * also heads the section above it ("I 커스텀 코스"). The course DETAIL keeps
 * its own name for this route — see AI_COURSE_NAME in JejuAiDetail.
 */
const AI_CARD = {
  sub: {
    ko: '원하는 대로 골라 만드는', en: 'Built the way you want', ja: '好きなように選んで作る',
    zh: '按你的想法挑选定制', vi: 'Tự chọn theo ý bạn', th: 'เลือกสร้างได้ตามใจ',
    ru: 'Собирайте как хотите', id: 'Pilih dan susun sesukamu',
  },
  title: {
    ko: '커스텀 코스', en: 'Custom Course', ja: 'カスタムコース', zh: '定制路线',
    vi: 'Lộ trình tùy chỉnh', th: 'เส้นทางแบบกำหนดเอง', ru: 'Свой маршрут', id: 'Rute Kustom',
  },
  desc: {
    ko: '취향·동행·일정까지 원하는\n내가 원하는 여행 코스를 만들어 보세요.',
    en: 'Taste, company and schedule —\nbuild the trip you want.',
    ja: '好み・同行者・日程まで\n自分だけの旅行コースを作ってみましょう。',
    zh: '从喜好、同行到行程\n打造你想要的旅行路线。',
    vi: 'Từ sở thích, bạn đồng hành đến lịch trình\nhãy tạo lộ trình bạn muốn.',
    th: 'ทั้งรสนิยม ผู้ร่วมทาง และตารางเวลา\nสร้างเส้นทางท่องเที่ยวที่คุณต้องการ',
    ru: 'Вкусы, компания и график —\nсоберите поездку по-своему.',
    id: 'Selera, teman, hingga jadwal\nbuat rute perjalanan impianmu.',
  },
};

/** The second section heading, "I 추천코스" (7088:23517). */
const RECOMMENDED_HEAD = {
  ko: '추천코스', en: 'Recommended', ja: 'おすすめコース', zh: '推荐路线',
  vi: 'Lộ trình gợi ý', th: 'เส้นทางแนะนำ', ru: 'Рекомендуемые', id: 'Rute Rekomendasi',
};

/** The one themed card with no course behind it — see SHOP_PRESET. */
const SHOP_COURSE = {
  subtitle: {
    ko: '지역의 매력을 발견하는', en: 'Discovering local charm', ja: '地域の魅力を発見する',
    zh: '发现当地魅力', vi: 'Khám phá nét quyến rũ địa phương', th: 'ค้นพบเสน่ห์ท้องถิ่น',
    ru: 'Открывая местный колорит', id: 'Menemukan pesona lokal',
  },
  title: {
    ko: '쇼핑·로컬 체험 코스', en: 'Shopping & Local', ja: 'ショッピング・ローカル体験コース',
    zh: '购物·当地体验路线', vi: 'Mua sắm & Trải nghiệm địa phương', th: 'เส้นทางช้อปปิ้งและท้องถิ่น',
    ru: 'Шопинг и местный колорит', id: 'Belanja & Pengalaman Lokal',
  },
};

/**
 * 즐길 거리 the 쇼핑·로컬 card presets, by the sheet's Korean name rather than by
 * index so a re-ordered AICategory_Jeju cannot silently swap them. Replace the
 * whole card's action with a course the moment the API grows a 'D'.
 */
const SHOP_PRESET = ['제주 기념품', '전통시장', '로컬샵'];

/** SHOP_PRESET as the catalogue's own category values — what the API matches. */
const shopPresetCats = (): string[] =>
  SHOP_PRESET.map((ko) => AI_CATEGORIES_JEJU.findIndex((c) => c.ko === ko))
    .filter((i) => i >= 0)
    .map(interestCat);

/** The Korean course title for a theme key — the analytics label navigate() records. */
const themeTitleKo = (key: string): string =>
  COURSES.find((c) => c.key === key)?.titleKo ?? SHOP_COURSE.title.ko;

/**
 * The four cards, in the frame's reading order — 7088:23517 swapped row 2, so
 * 쇼핑·로컬 now sits left of 가족·체험. Inside each 780×482 card the frame places
 * the illustration AND the text block by hand, so both boxes are per-card: the
 * text follows its own art (x367 · 416 · 393 · 396, y116 · 126 · 116 · 121), and
 * `text.width` is the room to the plate's edge. The art is the result page's
 * own course illustrations (the same scenes at ~3× the size) plus the 쇼핑·로컬
 * stall, re-exported from this frame.
 */
const THEMES = [
  {
    key: 'nature', icon: 'course-nature',
    art: { left: 43.33, top: 137.49, width: 279.28, height: 207.13 },
    text: { left: 367.12, top: 116, width: 396 },
  },
  {
    key: 'food', icon: 'course-food',
    /* Not the frame's node box (23.07/170.54, 333.95×150.72): the frame zooms
       this drawing 3.2% inside that box, so it is fitted to the render's ink —
       x27…351, y181…309 — instead. */
    art: { left: 12.62, top: 168.14, width: 344.65, height: 155.55 },
    text: { left: 416, top: 126, width: 348 },
  },
  {
    key: 'shop', icon: 'course-shop',
    art: { left: 87.47, top: 114, width: 276.81, height: 277 },
    text: { left: 393.09, top: 116, width: 370 },
  },
  {
    key: 'family', icon: 'course-family',
    art: { left: 26, top: 106, width: 333, height: 270 },
    text: { left: 396, top: 121, width: 368 },
  },
] as const;

/** Each card's Localization_Jeju_v2 row, `Recommended_Course_{n}_subtitle/_title` —
 *  numbered in the frame's reading order, 쇼핑·로컬 included. */
const THEME_SHEET_NO: Record<string, number> = { nature: 1, food: 2, shop: 3, family: 4 };

/** Sheet copy may carry its line break as a literal "\n"; draw it as one. */
const sheetLines = (text: string): string => text.replace(/\\n/g, '\n');

export function JejuAiSearch({ controller }: Props): JSX.Element {
  const setAiInterests = useAiStore((s) => s.setInterests);
  const setAiAnswers = useAiStore((s) => s.setAnswers);
  const setCourse = useAiStore((s) => s.setCourse);
  const setEntry = useAiStore((s) => s.setEntry);
  const setResumeQuestions = useAiStore((s) => s.setResumeQuestions);
  const setRegion = useAiStore((s) => s.setRegion);
  const setPickerPlan = useAiStore((s) => s.setPickerPlan);
  /**
   * What the visitor had answered, when this mount is a return from the course
   * detail (aiStore.resumeQuestions) — read once, before the effect below
   * clears the flag. Null on a fresh entry.
   */
  const [resume] = useState(() => {
    const ai = useAiStore.getState();
    return ai.resumeQuestions ? ai : null;
  });

  /**
   * 'pick' is the landing (Figma 7088:23517), 'questions' the questionnaire.
   * Coming back from a course detail resumes on the questions it came from;
   * every other arrival — home — lands on the picker.
   */
  const [stage, setStage] = useState<'pick' | 'questions'>(() =>
    useAiStore.getState().resumeQuestions ? 'questions' : 'pick',
  );

  /* Tell the customer display which stage is up: the picker is the tile's own
     AISearch clip, the questionnaire is 재생조건 "뭐하지 -> 관심사 선택"
     (AISearch-2). Both stages live on the one `ai_search` screen, so navigate()
     alone could only ever report the first. */
  useEffect(() => {
    void window.api.kiosk.setScreen(stage === 'questions' ? 'ai_questions' : 'ai_search');
  }, [stage]);
  /**
   * Set when the questionnaire is the THEMED one (Figma 6336:67302): the theme's
   * course key. null is the full AI 맞춤 questionnaire. A resume from a themed
   * detail reopens the same theme; every fresh entry starts from the picker.
   */
  const [themeKey, setThemeKey] = useState<string | null>(() => {
    const ai = useAiStore.getState();
    return ai.resumeQuestions && ai.entry === 'theme' ? ai.course : null;
  });
  /** The region picked on the map. The frame's resting state has 동부 · 성산. */
  const [region, setRegionPick] = useState<JejuRegionId>(() => {
    const ai = useAiStore.getState();
    return ai.resumeQuestions && ai.region ? (ai.region as JejuRegionId) : DEFAULT_REGION;
  });
  // One-shot: consumed as soon as it has chosen the stage above.
  useEffect(() => {
    setResumeQuestions(false);
  }, [setResumeQuestions]);
  const lang = useLanguageStore((s) => s.currentLanguage);
  /** Which kiosk this is — the landing note names it as every course's start. */
  const kioskId = useKioskStore((s) => s.config.kioskId);

  /** Sheet string, falling back to the authored copy when the key is absent. */
  const s = (key: string | null, authored: string): string => {
    if (!key) return authored;
    const value = t(key, lang);
    return value === key ? authored : value;
  };

  /** A section heading: the sheet's row if it has one, else our own translation. */
  const heading = (sec: (typeof SECTION)[keyof typeof SECTION]): string =>
    s(sec.key, pick(sec.label, lang));

  /** Tile label: Korean keeps the Figma's two-line form, others use the sheet. */
  const tileLabel = (i: number): string => {
    const meta = INTERESTS[i];
    if (lang === 'ko' && meta?.ko) return meta.ko;
    const cat = AI_CATEGORIES_JEJU[i];
    return cat ? aiCatLabel(cat, lang) : (meta?.ko ?? '');
  };

  /* A fresh entry starts on the resting answers — 2명 (as in the design),
     당일치기, 자동차 (see DEFAULT_TRANSPORT) — and NO tile picked: with a time
     budget, a pre-picked tile would already have spent part of the day. A
     return from the detail reopens exactly what the visitor left: the picker
     replays the taps, so resetting the chips under them would silently drop
     some. */
  const [visitors, setVisitors] = useState(() => labelIndex(VISITORS, resume?.visitors, 1));
  const [stay, setStay] = useState(() => labelIndex(STAY, resume?.stay, 0));
  const [transport, setTransport] = useState(() => labelIndex(TRANSPORT, resume?.transport, DEFAULT_TRANSPORT));
  /**
   * 즐길 거리 per DAY: dayPicks[d] is DAY d+1's tiles in tap order — the order is
   * that day's route. Each day is its own list, so one tile can be picked on
   * several days. A return from the detail reopens the days the visitor built.
   */
  const [dayPicks, setDayPicks] = useState<number[][]>(() => {
    if (resume?.entry !== 'custom') return [];
    const fromPlan = resume.pickerPlan?.days.map((day) =>
      day.stops.map((stop) => tileIndexOf(stripCatPrefix(stop.aiCategory))).filter((i) => i >= 0),
    );
    return fromPlan && fromPlan.some((list) => list.length > 0)
      ? fromPlan
      : [resume.interests.map(tileIndexOf).filter((i) => i >= 0)];
  });
  /** Days in the stay — one tab each (min(nights + 1, 4), the picker's own rule). */
  const dayCount = Math.min(nightCount(STAY[stay]!.label) + 1, 4);

  const lowReach = useAccessibilityStore((s) => s.lowReach);
  /** Low-reach only: 1 = the three chip groups, 2 = 즐길 거리. See Y_LOW. */
  const [step, setStep] = useState<1 | 2>(1);
  const y = themeKey ? Y_THEME : lowReach ? Y_LOW : Y;
  // Standard shows everything at once; low-reach shows one step at a time. A
  // themed page is all chips and no 즐길 거리, in either layout — it rides the
  // frame's body shift in ♿ instead of the two-step split.
  const showChips = !!themeKey || !lowReach || step === 1;
  const showInterests = !themeKey && (!lowReach || step === 2);

  /* Step 1 advances; every other case submits. The three chip groups are
     single-select and always hold a value, so only the 즐길 거리 step can be
     empty — which is the grey CTA both "nothing picked" frames draw. */
  const onFirstStep = !themeKey && lowReach && step === 1;
  // The themed page has nothing that can be left empty.
  const ctaDisabled = !themeKey && !onFirstStep && dayPicks.slice(0, dayCount).every((list) => list.length === 0);

  /* ── The picker: one call per tap, and per changed chip ── */
  const shops = useShopStore((s) => s.shops);
  /**
   * Each tile's category as the API matches it — prefix and all ("9-카페"),
   * recovered from the catalogue (see interestCodes). A tile no shop carries
   * (K-POP 체험) keeps its bare label and comes back NO_PLACES, which is true.
   */
  const tileCodes = useMemo(() => interestCodes(INTERESTS.map((_, i) => interestCat(i)), shops), [shops]);
  /** DAY 1's date, fixed for the visit so two calls either side of midnight cannot disagree. */
  const [visitDate] = useState(todayIso);
  /**
   * When DAY 1 starts — the clock as the page opened, fixed for the visit like
   * visitDate: a clock read per tap would shift the plan between a tile's
   * preview and its tap. A visitor at 13:00 gets 13:00–21:00 for DAY 1.
   */
  const [startMin] = useState(nowMinutes);
  /** The picker only serves the 커스텀 코스 questions — never the landing or a themed page. */
  const pickerOn = stage === 'questions' && !themeKey && shops.length > 0;
  /** The day tab in view (1-based) — the day a tap edits. */
  const [viewDay, setViewDay] = useState(1);
  /** A shorter stay pulls a later tab back to the last day. */
  const activeDay = Math.min(viewDay, dayCount);
  /**
   * One picker request per DAY. The API plans a whole trip from one list, lets
   * a category in once per trip and decides each tap's day itself — so to let a
   * visitor fill 2일차 on purpose, and pick 흑돼지 on two days, each day is asked
   * as its own 당일치기 on its own date: DAY 1 from the time the page opened,
   * later days from 09:00. What that gives up against one trip call: a later day
   * starts from the kiosk rather than from the previous day's last stop, and a
   * category picked on two days can land on the same place.
   */
  const dayQueries: JejuPickerQuery[] = useMemo(
    () =>
      Array.from({ length: dayCount }, (_, d) => ({
        transport: transportCode(TRANSPORT[transport]!.label),
        party: partySize(VISITORS[visitors]!.label),
        nights: 0,
        visitDate: addDaysIso(visitDate, d),
        startMin: d === 0 ? startMin : DAY_START_MIN,
        picks: (dayPicks[d] ?? []).map((i) => tileCodes[i]!),
        categories: tileCodes,
      })),
    [dayCount, transport, visitors, visitDate, startMin, dayPicks, tileCodes],
  );
  const dayKeys = useMemo(() => dayQueries.map((q) => JSON.stringify(q)), [dayQueries]);
  /** Each day's newest answer and the request it answers — drawn until the next one lands. */
  const [dayAnswers, setDayAnswers] = useState<({ key: string; plan: JejuPickerPlan } | undefined)[]>([]);
  /** The request last sent for each day; an older answer arriving late is ignored. */
  const requested = useRef<string[]>([]);
  /**
   * The last call failed (offline, timeout, API error). The tiles then stay
   * tappable with no gauge rather than locking the visitor out, and the detail
   * falls back to /recommend — see submit.
   */
  const [pickerDown, setPickerDown] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (!pickerOn) return;
    dayQueries.forEach((q, d) => {
      const key = dayKeys[d]!;
      if (requested.current[d] === key) return;
      requested.current[d] = key;
      void window.api.jejuCourse.picker(q).then((res) => {
        if (requested.current[d] !== key) return;
        if (!isOk(res)) {
          setPickerDown(true);
          return;
        }
        setPickerDown(false);
        setDayAnswers((prev) => {
          const next = prev.slice();
          next[d] = { key, plan: res.value };
          return next;
        });
      });
    });
  }, [pickerOn, dayQueries, dayKeys]);

  /** What the day in view draws from: its newest answer, unless the picker is down. */
  const plan = pickerDown ? null : (dayAnswers[activeDay - 1]?.plan ?? null);
  const optionByCat = useMemo(
    () => new Map((plan?.categories ?? []).map((o) => [o.aiCategory, o])),
    [plan],
  );
  /** The day in view's stops in route order — what the order badges count. */
  const dayStops = plan?.days[0]?.stops ?? [];

  /**
   * A change of 이동수단 / 인원 / 기간 replays each day's taps, and some may no
   * longer fit their day. They leave that day's list, so the tiles show what the
   * plan really holds.
   */
  useEffect(() => {
    dayAnswers.forEach((answer, d) => {
      if (!answer || answer.key !== dayKeys[d] || answer.plan.dropped.length === 0) return;
      const gone = answer.plan.dropped.map((x) => tileCodes.indexOf(x.aiCategory)).filter((i) => i >= 0);
      if (gone.length === 0) return;
      setDayPicks((prev) => withDay(prev, d, (prev[d] ?? []).filter((i) => !gone.includes(i))));
    });
  }, [dayAnswers, dayKeys, tileCodes]);

  /**
   * Tap, on the day in view: a tile already picked THAT day comes out; otherwise,
   * with an answer on screen, only a tile it calls OK goes in — a greyed tile does
   * nothing. The same tile on another day is left alone either way.
   */
  const toggleInterest = (i: number): void => {
    const d = activeDay - 1;
    if ((dayPicks[d] ?? []).includes(i)) {
      setDayPicks((prev) => withDay(prev, d, (prev[d] ?? []).filter((x) => x !== i)));
      return;
    }
    if (plan && optionByCat.get(tileCodes[i]!)?.status !== 'OK') return;
    setDayPicks((prev) => withDay(prev, d, [...(prev[d] ?? []), i]));
  };

  /** The gauge: how much of the day in view is spent, as a bar and as time. */
  const gauge = useMemo(() => {
    const day = plan?.days[0];
    if (!plan || !day) return null;
    const percent =
      day.budgetMinutes > 0 ? Math.min(100, Math.round((day.usedMinutes / day.budgetMinutes) * 100)) : 100;
    if (plan.full) {
      return { percent, text: pick(day.remainingMinutes >= FULL_WITH_TIME_LEFT_MIN ? NO_MORE_PLACES : PLAN_FULL, lang) };
    }
    return { percent, text: fill(USED, lang as Lang, minutesLabel(day.usedMinutes, lang as Lang)) };
  }, [plan, lang]);

  const submit = async (): Promise<void> => {
    if (submitting.current) return;
    submitting.current = true;
    if (themeKey) {
      setPickerPlan(null);
      /* A themed course goes straight to its detail (Figma 7058:22277) — there
         is no A/B/C chooser, the theme IS the course. It asked no 즐길 거리,
         except that 쇼핑·로컬 borrows course B and has to send its shopping
         categories with it (see SHOP_PRESET / COURSE_LETTERS). */
      setAiInterests(themeKey === 'shop' ? shopPresetCats() : []);
      setAiAnswers({
        visitors: VISITORS[visitors]!.label,
        stay: STAY[stay]!.label,
        transport: TRANSPORT[transport]!.label,
      });
      setRegion(region);
      setEntry('theme');
      setCourse(themeKey);
      controller.navigate('ai_detail', themeTitleKo(themeKey));
      submitting.current = false;
      return;
    }
    /* The detail draws the days the visitor watched fill up. A day whose newest
       tap is still unanswered is asked once more rather than handed over one tap
       behind. With the picker down, or any day unanswered, the plan stays null
       and the detail falls back to /recommend with every pick, as before. */
    const plans =
      pickerOn && !pickerDown
        ? await Promise.all(
            dayQueries.map(async (q, d) => {
              const answer = dayAnswers[d];
              if (answer && answer.key === dayKeys[d]) return answer.plan;
              const res = await window.api.jejuCourse.picker(q);
              return isOk(res) ? res.value : null;
            }),
          )
        : [];
    const finalPlan =
      plans.length === dayCount && plans.every((p): p is JejuPickerPlan => p !== null)
        ? mergeDayPlans(plans, visitDate)
        : null;
    // What the plan actually holds, day by day in route order — a tap that no
    // longer fit is not in it, and must not reach the detail's 선택보기 either.
    const placed = [
      ...new Set(
        finalPlan
          ? finalPlan.days.flatMap((d) => d.stops.map((stop) => tileCodes.indexOf(stop.aiCategory))).filter((i) => i >= 0)
          : dayPicks.slice(0, dayCount).flat(),
      ),
    ];
    setPickerPlan(finalPlan);
    setAiInterests(placed.map(interestCat));
    // The course detail's summary bar shows 이동수단, so every answer travels on
    // rather than only the interests. These stay KOREAN regardless of the UI
    // language — downstream matching is on the catalogue's Korean values.
    setAiAnswers({
      visitors: VISITORS[visitors]!.label,
      stay: STAY[stay]!.label,
      transport: TRANSPORT[transport]!.label,
    });
    setEntry('custom');
    /* Straight to the course detail — the A/B/C chooser (JejuAiResult) is no
       longer part of the AI 맞춤 route. The course letter only still matters on
       the /recommend fallback; it follows the picks — see courseForInterests. */
    setCourse(courseForInterests(placed));
    controller.navigate('ai_detail', 'AI 맞춤 추천 코스');
    submitting.current = false;
  };

  /** Step 1 advances to 즐길 거리; every other case submits. */
  const onCta = onFirstStep
    ? (): void => setStep(2)
    : (): void => {
        void submit();
      };

  /**
   * On the low-reach 즐길 거리 step, 뒤로 means "back to the questions", not
   * "leave the page" — the split is an artefact of the accessible layout, so
   * stepping out of it one screen at a time is what a visitor expects. Drives
   * BOTH back affordances (the header arrow and the left rail's), since
   * JejuPageFrame feeds this one callback to each.
   *
   * Otherwise the questionnaire steps back to the course picker in front of it,
   * and only the picker leaves the page (the frame's own default: home).
   */
  const onBack =
    lowReach && step === 2
      ? (): void => setStep(1)
      : (): void => {
          setStep(1);
          setStage('pick');
        };

  const rows = Array.from({ length: Math.ceil(TILE_ORDER.length / COLS) }, (_, r) =>
    TILE_ORDER.slice(r * COLS, r * COLS + COLS),
  );

  /** AI 맞춤 추천 코스 — into the full questionnaire, as the page used to open. */
  const openCustom = (): void => {
    setEntry('custom');
    setThemeKey(null);
    setStep(1);
    // A new plan: nothing tapped, nothing answered, nothing to announce.
    setDayPicks([]);
    setDayAnswers([]);
    requested.current = [];
    setViewDay(1);
    setStage('questions');
  };

  /**
   * A themed card — into the THEMED questionnaire (Figma 6336:67302), fresh:
   * the frame's resting answers and region, never the previous visitor's
   * (aiStore is not reset between visitors, and this component's own state
   * survives a trip back to the picker).
   */
  const openTheme = (key: string): void => {
    setThemeKey(key);
    setRegionPick(DEFAULT_REGION);
    setVisitors(1);
    setStay(0);
    setTransport(DEFAULT_TRANSPORT);
    setStep(1);
    setStage('questions');
  };

  if (stage === 'pick') {
    const aiArt = jejuIconUrl('ai-course-custom');
    const bigArrow = jejuIconUrl('arrow-course-90');
    /* Korean titles break after the first word, as the frame draws them; the
       other languages wrap inside the card's own text box. */
    const cardTitle = (title: string): string => (lang === 'ko' ? title.replace(' ', '\n') : title);
    return (
      /* Bar + promo in ♿, the same shape the result page it leads to uses:
         the 573 promo sits flush under the bar and the header and body both drop
         by bar + 573. The body then ends at 2778 + 719 = 3497, inside the
         artboard. No low-reach frame exists for this stage yet. */
      <JejuPageFrame
        controller={controller}
        title="'제주' 뭐하지 (AI 검색)"
        subtitle={sheetText('Jeju_Todo_Subtitle1', lang, PICK_SUBTITLE)}
        bannerFallback="banner-detail"
        lowReachModeBar
        lowReachBarBanner
        lowReachShift={belowModeBar(LOW_REACH_BANNER_HEIGHT)}
        lowReachBodyShift={belowModeBar(LOW_REACH_BANNER_HEIGHT)}
      >
        <div className={styles.root}>
          <p className={styles.pickNote}>{pickNoteText(kioskId, lang)}</p>

          <p className={`${styles.sectionHead} ${styles.headCustom}`}>
            I {sheetText('My_Course_title', lang, AI_CARD.title)}
          </p>

          <button type="button" className={styles.bigCard} onClick={openCustom}>
            {aiArt && <img src={aiArt} alt="" className={styles.bigArt} draggable={false} />}
            <span className={styles.bigText}>
              <span className={styles.bigSub}>{sheetText('My_Course_desc1', lang, AI_CARD.sub)}</span>
              <span className={styles.bigTitle}>{sheetText('My_Course_title', lang, AI_CARD.title)}</span>
              <span className={styles.bigDesc}>{sheetLines(sheetText('My_Course_desc2', lang, AI_CARD.desc))}</span>
            </span>
            {bigArrow && <img src={bigArrow} alt="" className={styles.bigArrow} draggable={false} />}
          </button>

          <p className={`${styles.sectionHead} ${styles.headRecommended}`}>
            I {sheetText('Recommended_Course_title', lang, RECOMMENDED_HEAD)}
          </p>

          <div className={styles.courseGrid}>
            {THEMES.map((theme) => {
              const course = COURSES.find((c) => c.key === theme.key);
              const no = THEME_SHEET_NO[theme.key];
              const sub = sheetText(`Recommended_Course_${no}_subtitle`, lang, course?.subtitle ?? SHOP_COURSE.subtitle);
              const title = sheetText(`Recommended_Course_${no}_title`, lang, course?.title ?? SHOP_COURSE.title);
              const art = jejuIconUrl(theme.icon);
              return (
                <button
                  key={theme.key}
                  type="button"
                  className={styles.courseCard}
                  onClick={() => openTheme(theme.key)}
                >
                  {art && (
                    <img
                      src={art}
                      alt=""
                      className={styles.courseArt}
                      style={theme.art}
                      draggable={false}
                    />
                  )}
                  <span
                    className={lang === 'ko' ? styles.courseText : `${styles.courseText} ${styles.courseTextWrap}`}
                    style={theme.text}
                  >
                    <span className={styles.courseSub}>{sub}</span>
                    <span className={styles.courseTitle}>{cardTitle(title)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </JejuPageFrame>
    );
  }

  return (
    /* The mode-bar revision (6336:67216 et al.) drops the 959-tall hero flush
       under the bar and lands the header flush under THAT — the frame's
       y113–1072 against its 113 bar, now both derived from lowReach.ts. Body
       stays self-positioned (Y_LOW / CTA_TOP_LOW are unchanged in the
       revision). */
    <JejuPageFrame
      controller={controller}
      title="'제주' 뭐하지 (AI 검색)"
      onBack={onBack}
      /* The themed page (6336:67302) keeps the promo at its foot, and in ♿ takes
         the bar + promo shape the landing uses, riding the body shift — its
         CTA then ends at 3080 + 719 = 3799, inside the artboard. The AI 맞춤
         page keeps its own hero layout and self-positioned Y_LOW. */
      {...(themeKey
        ? {
            bannerFallback: 'banner-detail',
            lowReachModeBar: true,
            lowReachBarBanner: true,
            lowReachShift: belowModeBar(LOW_REACH_BANNER_HEIGHT),
            lowReachBodyShift: belowModeBar(LOW_REACH_BANNER_HEIGHT),
          }
        : {
            showBanner: false,
            lowReachHero: 'banner-ai-hero',
            lowReachModeBar: true,
            lowReachShift: belowModeBar(LOW_REACH_HERO_HEIGHT),
          })}
    >
      <div className={styles.root}>
        {themeKey && (
          /* ── 지역 — the region map (Figma 7088:24139) ──
             Each region is its own <path>, so a tap lands on the painted shape
             rather than an overlapping box. 한라산, the islets and the labels sit
             on top with pointer events off, so they never swallow a tap. */
          <div className={styles.regionMap}>
            <svg
              viewBox={`0 0 ${REGION_MAP_SIZE.width} ${REGION_MAP_SIZE.height}`}
              role="radiogroup"
              aria-label="지역"
            >
              {REGIONS.map((r) => (
                <path
                  key={r.id}
                  className={styles.region}
                  d={r.d}
                  transform={`translate(${r.x} ${r.y})`}
                  fill={region === r.id ? REGION_FILL_PICKED : REGION_FILL}
                  role="radio"
                  aria-checked={region === r.id}
                  aria-label={pick(r.label, lang)}
                  onClick={() => setRegionPick(r.id)}
                />
              ))}
              {ISLANDS.map((isle, i) => (
                <path
                  key={i}
                  d={isle.d}
                  fill={isle.fill}
                  transform={`translate(${isle.x} ${isle.y})`}
                  pointerEvents="none"
                />
              ))}
              <g transform={`translate(${HALLASAN.x} ${HALLASAN.y})`} pointerEvents="none">
                {HALLASAN.paths.map((p, i) => (
                  <path key={i} d={p.d} fill={p.fill} />
                ))}
              </g>
            </svg>
            {REGIONS.map((r) => (
              <p key={r.id} className={styles.regionLabel} style={{ left: r.labelX, top: r.labelY }}>
                {pick(r.label, lang)}
              </p>
            ))}
          </div>
        )}

        {showChips && (
          <>
        {/* ── 방문 인원 ── */}
        <div className={styles.label} style={{ top: y.visitorsLabel }}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>{heading(SECTION.visitors)}</p>
        </div>
        <div className={styles.row} style={{ top: y.visitorsRow }}>
          {VISITORS.map((v, i) => (
            <button
              key={v.key}
              type="button"
              style={{ width: v.width }}
              className={`${styles.chip} ${visitors === i ? styles.chipSelected : ''}`}
              onClick={() => setVisitors(i)}
            >
              {s(v.key, v.label)}
            </button>
          ))}
        </div>

        {/* ── 체류 기간 ── */}
        <div className={styles.label} style={{ top: y.stayLabel }}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>{heading(SECTION.stay)}</p>
        </div>
        <div className={styles.row} style={{ top: y.stayRow }}>
          {STAY.map((item, i) => (
            <button
              key={item.key}
              type="button"
              style={{ width: 412 }}
              className={`${styles.chip} ${stay === i ? styles.chipSelected : ''}`}
              onClick={() => setStay(i)}
            >
              {s(item.key, item.label)}
            </button>
          ))}
        </div>

        {/* ── 이동수단 ── */}
        <div className={styles.label} style={{ top: y.transportLabel }}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>{heading(SECTION.transport)}</p>
        </div>
        <div className={styles.row} style={{ top: y.transportRow }}>
          {TRANSPORT.map((item, i) => (
            <button
              key={item.key}
              type="button"
              style={{ width: 412 }}
              className={`${styles.chip} ${transport === i ? styles.chipSelected : ''}`}
              onClick={() => setTransport(i)}
            >
              {s(item.key, item.label)}
            </button>
          ))}
        </div>
          </>
        )}

        {showInterests && (
          <>
        {/* ── 즐길 거리 ── */}
        <div className={styles.label} style={{ top: y.interestsLabel }}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>{heading(SECTION.interests)}</p>
        </div>
        {/* ── Day tabs + gauge (Figma 7229:100741: day-tabs 7249:9656, gauge 7249:9687) ──
            One tab per day of the stay, badged with the places that day holds.
            The tab in view is the day the tiles edit; the gauge is its time. */}
        <div
          className={styles.dayTabs}
          style={{ top: lowReach ? TABS_TOP_LOW : TABS_TOP }}
          role="tablist"
          aria-label={heading(SECTION.interests)}
        >
          {Array.from({ length: dayCount }, (_, d) => d + 1).map((day) => {
            const answer = dayAnswers[day - 1];
            // The plan's count once it has answered for the day's taps, else the taps.
            const fresh = !pickerDown && !!answer && answer.key === dayKeys[day - 1];
            const count = fresh ? (answer.plan.days[0]?.stops.length ?? 0) : (dayPicks[day - 1]?.length ?? 0);
            const active = day === activeDay;
            return (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={active}
                className={active ? `${styles.dayTab} ${styles.dayTabActive}` : styles.dayTab}
                onClick={() => setViewDay(day)}
              >
                <span>{dayTabLabel(day, lang as Lang)}</span>
                {count > 0 && <span className={styles.dayBadge}>{count}</span>}
              </button>
            );
          })}
        </div>
        {gauge && (
          <div
            className={styles.dayGauge}
            style={{ top: (lowReach ? TABS_TOP_LOW : TABS_TOP) + GAUGE_OFFSET }}
            role="status"
            aria-live="polite"
          >
            <span className={styles.gaugeTrack}>
              <span className={styles.gaugeFill} style={{ width: `${gauge.percent}%` }} />
            </span>
            <span className={styles.gaugeText}>{gauge.text}</span>
          </div>
        )}
        <div className={styles.grid} style={{ top: lowReach ? GRID_TOP_LOW : GRID_TOP }}>
          {rows.map((row, r) => (
            <div key={r} className={styles.gridRow} style={{ top: r * GRID_ROW_STEP }}>
              {row.map((i) => {
                const item = INTERESTS[i]!;
                const code = tileCodes[i]!;
                const option = optionByCat.get(code);
                const todays = dayPicks[activeDay - 1] ?? [];
                // Picked for the day in view (the same tile may be picked on other days too).
                const selected = todays.includes(i);
                // Greyed: the day's picker has answered and this tile does not fit that day.
                const off = !selected && !!plan && option?.status !== 'OK';
                // Its place in the day's route — the plan's once answered, else the tap order.
                const stopIndex = dayStops.findIndex((stop) => stop.aiCategory === code);
                const order = selected ? (stopIndex >= 0 ? stopIndex + 1 : todays.indexOf(i) + 1) : 0;
                // "+1시간" — what a tap would add to the day (Figma 7249:9693).
                const cost =
                  !selected && !off && option?.status === 'OK' && option.costMinutes !== null
                    ? `+${minutesLabel(option.costMinutes, lang as Lang)}`
                    : null;
                return (
                  <button
                    key={interestCat(i) || i}
                    type="button"
                    // Korean keeps the Figma's `white-space: pre` sizing; the other
                    // seven languages are longer than the 268px tile (e.g. ru
                    // "Опирающийся на опыт"), so they wrap instead of overflowing.
                    className={[
                      styles.tile,
                      selected ? styles.tileSelected : '',
                      off ? styles.tileOff : '',
                      lang === 'ko' ? '' : styles.tileWrap,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    // The resting palette is per-tile, so it has to be inline —
                    // but a picked tile is white on the brand plate and an off
                    // tile is grey, and an inline colour would outrank both.
                    // Dropping the style lets the class win without !important.
                    style={selected || off ? undefined : { color: item.color }}
                    disabled={off}
                    onClick={() => toggleInterest(i)}
                  >
                    {order > 0 && <span className={styles.tileOrder}>{order}</span>}
                    <span className={styles.tileLabel}>{tileLabel(i)}</span>
                    {cost && <span className={styles.tileCaption}>{cost}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
          </>
        )}

        <button
          type="button"
          className={[styles.cta, ctaDisabled ? styles.ctaDisabled : '', themeKey ? styles.ctaTheme : '']
            .filter(Boolean)
            .join(' ')}
          style={lowReach && !themeKey ? { top: CTA_TOP_LOW } : undefined}
          disabled={ctaDisabled}
          onClick={onCta}
        >
          {/* Figma 6289:54956's "코스 추천받기" — see SUBMIT_LABEL for why this no
              longer reads the sheet's mascot-worded AI_SubmitButton. The ♿
              step-1 "다음으로" is unchanged. */}
          {onFirstStep ? pick(NEXT_LABEL, lang as Lang) : sheetText('SubmitButton', lang as Lang, SUBMIT_LABEL)}
        </button>
      </div>
    </JejuPageFrame>
  );
}
