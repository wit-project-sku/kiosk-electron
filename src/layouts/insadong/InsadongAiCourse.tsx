import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { InsaCourse, InsaDuration } from '@shared/types/insaCourse';
import type { Shop } from '@shared/types/shop';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useAiStore } from '@renderer/store/aiStore';
import { useShopStore } from '@renderer/store/shopStore';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { useLang, pick as pickLang } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { tExact } from '@renderer/lib/loc';
import { isOk } from '@shared/types/result';
import { clockLabel, minutesLabel, nowMinutes, partySize } from '@renderer/lib/jejuCourse';
import { shopSecondCategory, stripPrefix } from '@renderer/lib/shops';
import { useFitText } from '@layouts/components/fitText';
import { InsadongHeader } from './InsadongHeader';
import { InsadongLeftNav } from './InsadongLeftNav';
import styles from './InsadongAiCourse.module.css';

/**
 * '인사' 뭐하지 — the AI course entry (Figma page `인사동 리뉴얼`).
 *
 *   · 7519:74937  landing  — 커스텀 코스 card + four 추천코스 cards
 *   · 7519:76902  builder  — 방문 인원 / 체류 기간 + CTA (no 이동수단: the route is on foot)
 *   · 7519:74960  builder  — the same two plus 즐길 거리, taller, no banner
 *
 * Landing and builder are ONE screen with a step, the way 제주 does it
 * (JejuAiSearch), so 뒤로 from the builder returns to the cards without a
 * route change and the answers survive the trip.
 *
 * The course engine is 인사동's own: `POST /api/insa/courses/recommend` (see
 * InsaCourseService). One call turns the picked 관심사 and a time slot
 * (`0-2` · `2-4` · `4-6` · `6+` hours) into ONE walking route from this kiosk;
 * there is no per-tap plan, no multi-day schedule and no 이동수단; the party
 * size travels as `numberOfPeople`. 관심사 are the shop catalogue's
 * `secondCategoryKr` strings with their number prefix (`2-화랑`, `9-카페`) — the
 * API rejects anything else, including the 30 AI categories of the old picker.
 */

/*
 * ── Copy ──────────────────────────────────────────────────────────────────
 * Every string on this page resolves through {@link s}: the Localization_Insa
 * row for THIS language first, then the authored table for the same language,
 * then Korean. That order is what makes a partly-filled sheet safe — a plain
 * Korean fallback answered 한국어 to an English visitor and looked like the
 * language switch was broken, which is exactly what it was.
 *
 * The KEYS are the renewal vocabulary Localization_Jeju already uses for the
 * identical screens (Visitor_*, StayTime_*, Transportation_*, Things_to_enjoy,
 * SubmitButton, 1st_day…, My_Course_*, Recommended_Course_*), because that is
 * what the operator fills in when these rows reach the 인사 tab. Several of
 * them are absent from Localization_Insa today; each one steps aside for the
 * sheet the moment its row lands, with no release.
 *
 * Deliberately NOT read (the 인사 tab has the row, but it says something else):
 *   · `StayTime`  — "체류 시간 / How long are you planning to be here", a whole
 *                   question where this frame draws a 체류 기간 label.
 *   · `JoyContent`— "즐길 거리 (3개를 선택해주세요!)"; the renewal builder lets a
 *                   visitor pick as many as the day fits, so the count is wrong.
 *   · `AI_SubmitButton` — "인사에게 추천받기"; the frame says 코스 추천받기.
 */

type L8 = Partial<Record<Lang, string>>;

/**
 * Sheet row for this language → authored copy for this language → Korean.
 * Extra keys are tried in order, so a row the operator files under either the
 * renewal name or the 인사 tab's older name is picked up either way.
 */
const s = (key: string, lang: Lang, authored: L8, ...also: string[]): string => {
  const exact = tExact(key, lang);
  if (exact) return exact;
  for (const alt of also) {
    const legacy = tExact(alt, lang);
    if (legacy) return legacy;
  }
  return authored[lang] ?? authored.ko ?? '';
};

/** Sheet copy may carry its line break as a literal "\n"; draw it as one. */
const sheetLines = (text: string): string => text.replace(/\\n/g, '\n');

interface Chip {
  /** The canonical KOREAN value — what travels to the API and the AI store. */
  ko: string;
  key: string;
  label: L8;
  width?: number;
}

/**
 * 방문 인원 chips — Figma widths, and the label the API matches on.
 *
 * ⚠ Localization_Insa's `Visitor_5` / `Visitor_6` read 5명 / 6명, the OLD AI
 * search's six-chip row. This frame's last two chips are 5 ~ 9명 and 10명~, so
 * those two rows need their values updated on the 인사 tab; until then the
 * sheet wins and shows the narrower wording. The other four already agree.
 */
const PARTY_CHIPS: Chip[] = [
  { ko: '1명', key: 'Visitor_1', width: 268, label: { ko: '1명', en: '1 person', ja: '1人', zh: '1人', vi: '1 người', th: '1 คน', ru: '1 человек', id: '1 orang' } },
  { ko: '2명', key: 'Visitor_2', width: 269, label: { ko: '2명', en: '2 people', ja: '2人', zh: '2人', vi: '2 người', th: '2 คน', ru: '2 человека', id: '2 orang' } },
  { ko: '3명', key: 'Visitor_3', width: 268, label: { ko: '3명', en: '3 people', ja: '3人', zh: '3人', vi: '3 người', th: '3 คน', ru: '3 человека', id: '3 orang' } },
  { ko: '4명', key: 'Visitor_4', width: 268, label: { ko: '4명', en: '4 people', ja: '4人', zh: '4人', vi: '4 người', th: '4 คน', ru: '4 человека', id: '4 orang' } },
  { ko: '5 ~ 9명', key: 'Visitor_5', width: 311, label: { ko: '5 ~ 9명', en: '5~9 pax', ja: '5~9人', zh: '5~9人', vi: '5~9 người', th: '5~9 คน', ru: '5~9 чел.', id: '5~9 orang' } },
  { ko: '10명~', key: 'Visitor_6', width: 290, label: { ko: '10명~', en: '10+ pax', ja: '10人~', zh: '10人~', vi: '10 người~', th: '10 คน~', ru: '10+ чел.', id: '10 orang~' } },
];

/**
 * 체류 기간 chips (7519:75132) — the four slots the API takes. `ko` holds the
 * SLOT CODE (what travels to the API and lives in the store), the label is what
 * the chip shows.
 */
const DURATION_CHIPS: Chip[] = [
  { ko: '0-2', key: 'StayTime_02', label: { ko: '0 ~ 2시간', en: '0 ~ 2 hours', ja: '0〜2時間', zh: '0~2小时', vi: '0 ~ 2 giờ', th: '0 ~ 2 ชั่วโมง', ru: '0 ~ 2 часа', id: '0 ~ 2 jam' } },
  { ko: '2-4', key: 'StayTime_24', label: { ko: '2 ~ 4시간', en: '2 ~ 4 hours', ja: '2〜4時間', zh: '2~4小时', vi: '2 ~ 4 giờ', th: '2 ~ 4 ชั่วโมง', ru: '2 ~ 4 часа', id: '2 ~ 4 jam' } },
  { ko: '4-6', key: 'StayTime_46', label: { ko: '4 ~ 6시간', en: '4 ~ 6 hours', ja: '4〜6時間', zh: '4~6小时', vi: '4 ~ 6 giờ', th: '4 ~ 6 ชั่วโมง', ru: '4 ~ 6 часов', id: '4 ~ 6 jam' } },
  { ko: '6+', key: 'StayTime_66', label: { ko: '6시간 ~', en: '6 hours ~', ja: '6時間〜', zh: '6小时以上', vi: 'Từ 6 giờ', th: '6 ชั่วโมงขึ้นไป', ru: 'От 6 часов', id: '6 jam ke atas' } },
];

/** The only way the route goes. Shown in the result's summary bar, never asked. */
const WALK_CHIP: Chip = {
  ko: '도보', key: 'Transportation_1',
  label: { ko: '도보', en: 'Walking', ja: '徒歩', zh: '步行', vi: 'Đi bộ', th: 'เดิน', ru: 'Пешком', id: 'Jalan kaki' },
};

/** Section headings (7519:75120 · 75132 · 75145 · 75160). */
const SECTION = {
  visitors: {
    key: 'Visitor_Title', also: ['VisitorCount'],
    label: { ko: '방문 인원', en: 'Group size', ja: '訪問人数', zh: '同行人数', vi: 'Số người', th: 'จำนวนผู้มา', ru: 'Количество гостей', id: 'Jumlah orang' } as L8,
  },
  stay: {
    key: 'StayTime_Title', also: [],
    label: { ko: '체류 기간', en: 'Length of stay', ja: '滞在期間', zh: '停留时间', vi: 'Thời gian lưu trú', th: 'ระยะเวลาพำนัก', ru: 'Срок пребывания', id: 'Lama menginap' } as L8,
  },
  interests: {
    key: 'Things_to_enjoy', also: [],
    label: { ko: '즐길 거리', en: 'What to enjoy', ja: '楽しみ方', zh: '体验项目', vi: 'Hoạt động yêu thích', th: 'กิจกรรมที่สนใจ', ru: 'Что интересно', id: 'Aktivitas' } as L8,
  },
};

/** Localization_Insa's day tabs, once the rows land (1일차 … 4일차). */
const DAY_TAB_KEYS = ['1st_day', '2nd_day', '3rd_day', '4th_day'];
const DAY_TAB: Partial<Record<Lang, (n: number) => string>> = {
  ko: (n) => `${n}일차`, en: (n) => `Day ${n}`, ja: (n) => `${n}日目`, zh: (n) => `第${n}天`,
  vi: (n) => `Ngày ${n}`, th: (n) => `วันที่ ${n}`, ru: (n) => `День ${n}`, id: (n) => `Hari ${n}`,
};
/** A 5th day has no sheet row and keeps the authored pattern. */
const dayTabLabel = (n: number, lang: Lang): string => {
  const authored = (DAY_TAB[lang] ?? DAY_TAB.ko)!(n);
  const key = DAY_TAB_KEYS[n - 1];
  return key ? s(key, lang, { [lang]: authored } as L8) : authored;
};

/** The gauge on the day-tab row (7519:75170, "3시간 30분 소요"). */
const USED: Partial<Record<Lang, (t: string) => string>> = {
  ko: (t) => `${t} 소요`, en: (t) => `${t} planned`, ja: (t) => `所要 ${t}`, zh: (t) => `需时 ${t}`,
  vi: (t) => `Mất ${t}`, th: (t) => `ใช้เวลา ${t}`, ru: (t) => `Занято ${t}`, id: (t) => `Butuh ${t}`,
};

/** The orange note over the builder — the slice of the day courses fit inside. */
const HOURS_NOTE: Partial<Record<Lang, (from: string, to: string) => string>> = {
  ko: (f, t) => `*“${f}”부터 ${t}까지 이용 가능한 코스를 추천해드립니다.`,
  en: (f, t) => `*We recommend courses you can enjoy from “${f}” to ${t}.`,
  ja: (f, t) => `*「${f}」から${t}まで利用できるコースをおすすめします。`,
  zh: (f, t) => `*为您推荐“${f}”至${t}期间可游玩的路线。`,
  vi: (f, t) => `*Chúng tôi gợi ý các lộ trình có thể đi từ “${f}” đến ${t}.`,
  th: (f, t) => `*เราแนะนำเส้นทางที่เที่ยวได้ตั้งแต่ “${f}” ถึง ${t}`,
  ru: (f, t) => `*Рекомендуем маршруты, доступные с «${f}» до ${t}.`,
  id: (f, t) => `*Kami merekomendasikan rute yang bisa dinikmati dari “${f}” hingga ${t}.`,
};

/** 7519:74985 — where every course on this page starts, i.e. THIS kiosk. */
const START_NOTE: Partial<Record<Lang, (place: string) => string>> = {
  ko: (p) => `*모든 추천코스는 ${p}을 기준으로 제작되었습니다.`,
  en: (p) => `*All recommended courses start from ${p}.`,
  ja: (p) => `*すべてのおすすめコースは${p}を起点に作成されています。`,
  zh: (p) => `*所有推荐路线均以${p}为起点制作。`,
  vi: (p) => `*Tất cả lộ trình gợi ý đều lấy ${p} làm điểm xuất phát.`,
  th: (p) => `*เส้นทางแนะนำทั้งหมดเริ่มต้นจาก ${p}`,
  ru: (p) => `*Все рекомендованные маршруты начинаются от «${p}».`,
  id: (p) => `*Semua rute rekomendasi berangkat dari ${p}.`,
};

const CUSTOM_SECTION: L8 = {
  ko: '커스텀 코스', en: 'Custom course', ja: 'カスタムコース', zh: '自定义路线',
  vi: 'Lộ trình tuỳ chỉnh', th: 'เส้นทางที่กำหนดเอง', ru: 'Свой маршрут', id: 'Rute kustom',
};

const RECOMMENDED_SECTION: L8 = {
  ko: '추천코스', en: 'Recommended Course', ja: 'おすすめコース', zh: '推荐路线',
  vi: 'Lộ trình gợi ý', th: 'เส้นทางแนะนำ', ru: 'Рекомендованный маршрут', id: 'Rute rekomendasi',
};

const MY_COURSE_TITLE: L8 = {
  ko: '나만의 코스', en: 'My own course', ja: '自分だけのコース', zh: '专属路线',
  vi: 'Lộ trình của riêng tôi', th: 'เส้นทางของฉัน', ru: 'Мой маршрут', id: 'Rute saya sendiri',
};
const MY_COURSE_SUB: L8 = {
  ko: '원하는 대로 골라 만드는', en: 'Pick and choose as you like', ja: '思いのままに選んで作る',
  zh: '随心所欲挑选制作', vi: 'Chọn và tạo theo ý bạn', th: 'เลือกสร้างได้ตามใจ',
  ru: 'Выбирайте как хотите', id: 'Pilih dan susun sesukamu',
};
const MY_COURSE_BODY: L8 = {
  ko: '취향·동행·일정까지 원하는\n내가 원하는 여행 코스를 만들어 보세요.',
  en: 'Build the trip you want — your tastes,\nyour companions, your schedule.',
  ja: '好み・同行者・日程まで、\n自分だけの旅コースを作ってみましょう。',
  zh: '从喜好、同伴到行程，\n打造属于你的旅行路线。',
  vi: 'Từ sở thích, bạn đồng hành đến lịch trình —\nhãy tạo lộ trình bạn muốn.',
  th: 'ตั้งแต่ความชอบ เพื่อนร่วมทาง ไปจนถึงตารางเวลา\nมาสร้างเส้นทางของคุณกัน',
  ru: 'Вкусы, компания, расписание —\nсоздайте свой маршрут.',
  id: 'Dari selera, teman jalan, hingga jadwal —\nbuat rute perjalananmu sendiri.',
};

const SUBMIT_LABEL: L8 = {
  ko: '코스 추천받기', en: 'Get course recommendations', ja: 'コースをおすすめしてもらう',
  zh: '获取路线推荐', vi: 'Nhận gợi ý lộ trình', th: 'รับเส้นทางแนะนำ',
  ru: 'Получить маршрут', id: 'Dapatkan rekomendasi rute',
};

/**
 * One aiStore answer (stored KOREAN) → the label to show, in this language.
 *
 * The store keeps every answer in Korean because the API and the shop matching
 * downstream are keyed on it; the result page has to translate it back before
 * drawing it, and it must land on the SAME string the chip showed. So both go
 * through the chip tables above rather than through a second copy of them.
 */
export const localizeInsaAiPick = (ko: string, lang: Lang): string => {
  const chip = [...PARTY_CHIPS, ...DURATION_CHIPS, WALK_CHIP].find((c) => c.ko === ko);
  return chip ? s(chip.key, lang, chip.label) : ko;
};

export { dayTabLabel as insaDayTabLabel };

/** The day-reset button draws only a glyph (7519:75178); this names it. */
const RESET_LABEL: L8 = {
  ko: '선택 초기화', en: 'Clear picks', ja: '選択をリセット', zh: '重置选择',
  vi: 'Chọn lại từ đầu', th: 'ล้างการเลือก', ru: 'Сбросить выбор', id: 'Atur ulang pilihan',
};

/**
 * The four 추천코스 cards (7519:75003 … 75038), in frame order.
 *
 * Every inner offset is hand-placed in Figma, so each card carries its own —
 * there is no shared inner grid to derive them from.
 *
 * NOTE: these cards have NO chevron. Figma's generated code lists an arrow node
 * on each (7519:75012 / 75017 / 75028 / 75040), but they render empty — only the
 * 커스텀 코스 card (7519:74999) actually draws one.
 */
interface ThemeCard {
  /**
   * Course key handed to the result page — `nature` / `food` / `shop` /
   * `family`, the same vocabulary 제주 uses. NOT a letter: `courseLetter` maps
   * these to the A/B/C the API accepts, and 쇼핑·로컬 has no letter of its own
   * (see COURSE_LETTERS in lib/jejuCourse).
   */
  key: string;
  icon: string;
  /**
   * Its row number in `Recommended_Course_{n}_title` / `_subtitle`, numbered in
   * the frame's reading order — the same numbering Localization_Jeju uses for
   * the identical four cards.
   */
  no: number;
  sub: L8;
  /** Title per language; `\n` is the break the frame draws. */
  title: L8;
  /** left / top of the card inside the 1678 block. */
  x: number;
  y: number;
  art: { x: number; y: number; w: number; h: number };
  text: { x: number; y: number; w: number };
}

const THEME_CARDS: ThemeCard[] = [
  {
    key: 'nature', icon: 'course-nature', no: 1,
    sub: {
      ko: '자연과 유산을 따라 걷는', en: 'Walking nature & heritage', ja: '自然と遺産を巡る',
      zh: '漫步自然与遗产', vi: 'Dạo bước cùng thiên nhiên & di sản', th: 'เดินชมธรรมชาติและมรดก',
      ru: 'Прогулка по природе и наследию', id: 'Menyusuri alam & warisan',
    },
    title: {
      ko: '자연·유산\n탐방 코스', en: 'Nature &\nHeritage Course', ja: '自然・遺産\n探訪コース',
      zh: '自然·遗产\n探访路线', vi: 'Tuyến khám phá\nthiên nhiên & di sản', th: 'เส้นทางธรรมชาติ\nและมรดก',
      ru: 'Природа и\nнаследие', id: 'Rute alam &\nwarisan',
    },
    x: 0, y: 1052,
    art: { x: 43.33, y: 137.49, w: 279.28, h: 207.129 },
    text: { x: 367.12, y: 116, w: 396.24 },
  },
  {
    key: 'food', icon: 'course-food', no: 2,
    sub: {
      ko: '미식과 감성을 즐기는', en: 'Good food, good mood', ja: 'グルメと感性を楽しむ',
      zh: '享受美食与氛围', vi: 'Thưởng thức ẩm thực & cảm xúc', th: 'อร่อยและได้ฟีล',
      ru: 'Еда и настроение', id: 'Menikmati kuliner & suasana',
    },
    title: {
      ko: '맛집·감성\n코스', en: 'Gourmet &\nVibe Course', ja: 'グルメ・感性\nコース',
      zh: '美食·感性\n路线', vi: 'Tuyến ẩm thực\n& cảm xúc', th: 'เส้นทางของอร่อย\nและบรรยากาศ',
      ru: 'Еда и\nатмосфера', id: 'Rute kuliner\n& suasana',
    },
    x: 898, y: 1052,
    art: { x: 23.07, y: 170.54, w: 333.946, h: 150.719 },
    text: { x: 416, y: 126, w: 343.2 },
  },
  {
    key: 'shop', icon: 'course-shopping', no: 3,
    sub: {
      ko: '지역의 매력을 발견하는', en: 'Discover local charm', ja: '街の魅力を見つける',
      zh: '发现在地魅力', vi: 'Khám phá nét duyên địa phương', th: 'ค้นพบเสน่ห์ท้องถิ่น',
      ru: 'Открыть местный колорит', id: 'Menemukan pesona lokal',
    },
    title: {
      ko: '쇼핑·로컬\n체험 코스', en: 'Shopping &\nLocal Course', ja: 'ショッピング・\nローカル体験コース',
      zh: '购物·当地\n体验路线', vi: 'Tuyến mua sắm\n& trải nghiệm địa phương', th: 'เส้นทางช้อปปิ้ง\nและท้องถิ่น',
      ru: 'Шопинг и\nместный колорит', id: 'Rute belanja &\npengalaman lokal',
    },
    x: 0, y: 1596,
    art: { x: 87.47, y: 114, w: 276.807, h: 277 },
    text: { x: 393.09, y: 116, w: 386.913 },
  },
  {
    key: 'family', icon: 'course-family', no: 4,
    sub: {
      ko: '아이와 함께 즐기는', en: 'Fun with the kids', ja: '子どもと一緒に楽しむ',
      zh: '和孩子一起享受', vi: 'Vui cùng trẻ nhỏ', th: 'สนุกกับเด็ก ๆ',
      ru: 'Вместе с детьми', id: 'Seru bersama anak',
    },
    title: {
      ko: '가족·체험\n코스', en: 'Family &\nActivity Course', ja: '家族・体験\nコース',
      zh: '家庭·体验\n路线', vi: 'Tuyến gia đình\n& trải nghiệm', th: 'เส้นทางครอบครัว\nและกิจกรรม',
      ru: 'Семья и\nвпечатления', id: 'Rute keluarga\n& aktivitas',
    },
    x: 898, y: 1596,
    art: { x: 26, y: 106, w: 333, h: 270 },
    text: { x: 396, y: 121, w: 331 },
  },
];

/**
 * 즐길 거리 each 추천코스 card presets, by the catalogue's second-category NAME
 * (prefix stripped) — resolved to the prefixed code the API wants from the shop
 * rows this kiosk holds, so a renumbered category cannot silently stop matching.
 * A name the catalogue does not carry is skipped rather than sent.
 */
const THEME_PICKS: Record<string, string[]> = {
  nature: ['고미술', '역사유적지', '전시관', '필방'],
  food: ['한식', '한정식', '전통차', '카페'],
  shop: ['공예품', '수제도장', '기념품', '한복'],
  family: ['전시관', '분식', '기념품', '수제도장'],
};

/** The notice quotes the live closing bound (the API closes at 22:00 unless a place stays open). */
const DAY_END_MIN = 21 * 60;

/**
 * Which shop bases are 즐길 거리 — 도와줘 (편의점 · 병원 · 은행 …) and 숙박 are not
 * places to walk to, and the API answers 404 for them. Listed in tile order, each
 * with its label colour (Figma 7519:74960: food pink, 미술관 blue, shopping brown).
 */
const JOY_BASES: { base: string; color: string }[] = [
  { base: '인사 뭐먹지', color: '#f59993' },
  { base: '인사동 미술관', color: '#6375bf' },
  { base: '인사 뭐사지', color: '#c89b7b' },
];

interface JoyTile {
  /** `N-name`, exactly as the API matches it. */
  code: string;
  color: string;
  /** A shop of this category, for its localized name. */
  shop: Shop;
}

/** `YYYY-MM-DDTHH:mm:ss` in the kiosk's own clock — the API's `startAt`. */
const localIso = (d: Date): string => {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

interface Props {
  controller: KioskController;
  debug?: boolean;
}

export function InsadongAiCourse({ controller }: Props): JSX.Element {
  const { navigate, kioskId } = controller;
  const lang = useLang();
  const long = lang !== 'ko';
  const goHome = (): void => navigate('home', 'Back');

  const setResumeQuestions = useAiStore((s) => s.setResumeQuestions);
  /**
   * The whole store as it stood when 뒤로 was pressed on the result — read ONCE,
   * before the effect below clears the flag.
   *
   * Resuming has to put the visitor back on the questions they actually filled
   * in, which means BOTH halves: the right step (a 추천코스 came through the
   * short builder, a 커스텀 through the long one) and the answers themselves.
   * Landing them on an empty builder would make 뒤로 worse than useless — and
   * on the themed route `themeKey` would be null, so the CTA would no-op.
   * Null on a fresh entry from home, which always opens the landing.
   */
  const [resumed] = useState(() => {
    const ai = useAiStore.getState();
    return ai.resumeQuestions ? ai : null;
  });
  const [step, setStep] = useState<'landing' | 'custom' | 'theme'>(
    !resumed ? 'landing' : resumed.entry === 'theme' ? 'theme' : 'custom',
  );
  // One-shot: consumed as soon as it has chosen the step above.
  useEffect(() => {
    setResumeQuestions(false);
  }, [setResumeQuestions]);
  /** Course key for the 추천코스 card that opened the short builder. */
  const [themeKey, setThemeKey] = useState<string | null>(
    resumed?.entry === 'theme' ? resumed.course || null : null,
  );
  /* Answers are held as the canonical value the API takes; the chips show the
     localized text over it. 방문 인원 travels as `numberOfPeople`. */
  const [party, setParty] = useState(resumed?.visitors || '2명');
  const [duration, setDuration] = useState<InsaDuration>(
    (resumed?.stay as InsaDuration | undefined) || '2-4',
  );
  /* 즐길 거리 in tap order, as the API's `N-name` codes. */
  const [picks, setPicks] = useState<string[]>(() => resumed?.interests ?? []);
  const [busy, setBusy] = useState(false);

  const shops = useShopStore((s) => s.shops);
  const setAnswers = useAiStore((s) => s.setAnswers);
  const setInterests = useAiStore((s) => s.setInterests);
  const setCourse = useAiStore((s) => s.setCourse);
  const setEntry = useAiStore((s) => s.setEntry);
  const setInsaCourse = useAiStore((s) => s.setInsaCourse);

  const partyRef = useRef<HTMLDivElement>(null);
  const stayRef = useRef<HTMLDivElement>(null);
  const joyRef = useRef<HTMLDivElement>(null);
  const landingRef = useRef<HTMLDivElement>(null);

  /* The clock when the page opened, for the notice only; every request carries
     the clock at the moment it is sent. */
  const startMin = useRef(nowMinutes()).current;

  /**
   * The tiles: every second category the catalogue carries under a place-to-go
   * base, in base order and then by number. Read from the catalogue rather than
   * from a fixed list because the API matches the catalogue's own strings.
   */
  const tiles: JoyTile[] = useMemo(() => {
    const seen = new Map<string, JoyTile & { rank: number }>();
    for (const shop of shops) {
      const code = shop.secondCategoryKr?.trim();
      const rank = JOY_BASES.findIndex((b) => b.base === shop.baseCategoryKr);
      if (!code || rank < 0 || seen.has(code)) continue;
      seen.set(code, { code, shop, color: JOY_BASES[rank]!.color, rank });
    }
    const num = (c: string): number => Number.parseInt(c, 10) || 0;
    return [...seen.values()].sort((x, y) => x.rank - y.rank || num(x.code) - num(y.code));
  }, [shops]);
  const codeByName = useMemo(() => new Map(tiles.map((t) => [stripPrefix(t.code), t.code])), [tiles]);

  /* Tell the customer display which stage is up — the landing is the tile's own
     AISearch clip, the builder is 재생조건 "뭐하지 -> 관심사 선택". */
  useEffect(() => {
    void window.api.kiosk.setScreen(step === 'landing' ? 'ai_search' : 'ai_questions');
  }, [step]);

  /**
   * A live total under the tiles ("3시간 30분 소요"): the route for the taps so
   * far, asked a moment after the last one. A failure or a stale answer simply
   * leaves the total blank — the CTA still works.
   */
  const [preview, setPreview] = useState<{ key: string; course: InsaCourse } | null>(null);
  const previewSeq = useRef(0);
  const previewKey = `${duration}|${party}|${picks.join(',')}`;
  useEffect(() => {
    if (step !== 'custom' || picks.length === 0) {
      setPreview(null);
      return;
    }
    const seq = ++previewSeq.current;
    const timer = setTimeout(() => {
      void window.api.insaCourse
        .recommend({
          interests: picks,
          duration,
          numberOfPeople: partySize(party),
          startAt: localIso(new Date()),
        })
        .then((res) => {
          if (previewSeq.current !== seq) return;
          setPreview(isOk(res) ? { key: previewKey, course: res.value } : null);
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [step, picks, duration, party, previewKey]);

  const toggle = (code: string): void =>
    setPicks((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  /** Ask for the route and hand it to the result page; a failure leaves it empty there. */
  const go = async (interests: string[]): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setAnswers({ visitors: party, stay: duration, transport: '' });
    setInterests(interests);
    const res = await window.api.insaCourse.recommend({
      interests,
      duration,
      numberOfPeople: partySize(party),
      startAt: localIso(new Date()),
    });
    setInsaCourse(isOk(res) ? res.value : null);
    setBusy(false);
    navigate('ai_result', 'AI 추천');
  };

  const submit = (): Promise<void> => {
    setEntry('custom');
    setCourse('');
    return go(picks);
  };

  /* A 추천코스 card opens the short builder (7519:76902): the same two
     questions, no 즐길 거리, then the banner. The result comes from the CTA. */
  const openTheme = (card: ThemeCard): void => {
    setThemeKey(card.key);
    setEntry('theme');
    setStep('theme');
  };

  const submitTheme = (): Promise<void> => {
    if (!themeKey) return Promise.resolve();
    setCourse(themeKey);
    setEntry('theme');
    const codes = (THEME_PICKS[themeKey] ?? [])
      .map((name) => codeByName.get(name))
      .filter((c): c is string => !!c);
    return go(codes);
  };

  const total = preview && preview.key === previewKey ? preview.course.totalMinutes : null;

  useFitText(landingRef, styles.themeTitleLong, long, 0.62, `${lang}|theme`);
  useFitText(partyRef, styles.pillLong, long, 0.55, `${lang}|party`);
  useFitText(stayRef, styles.pillLong, long, 0.55, `${lang}|stay`);
  useFitText(joyRef, styles.joyChipTextLong, long, 0.6, `${lang}|${tiles.length}`);

  const arrow = iconUrl('course-arrow');
  const banner = iconUrl('banner-kioskmall');
  /* The header resolves its own copy from the sheet: `screenTitle` maps this id
     to MainButton_AI, which Localization_Insa carries in all eight languages,
     and the description to SubHeader_AISearch. Passing a pre-localized string
     instead would hand screenTitle something it cannot look up. */
  const title = '‘인사’ 뭐하지 (AI 검색)';

  const chipRow = (
    ref: React.RefObject<HTMLDivElement | null>,
    chips: Chip[],
    value: string,
    onPick: (ko: string) => void,
    fallbackWidth: number,
  ): JSX.Element => (
    <div ref={ref} className={styles.pillRow}>
      {chips.map((c) => (
        <button
          key={c.ko}
          type="button"
          style={{ width: `${c.width ?? fallbackWidth}px` }}
          className={`${styles.pill} ${long ? styles.pillLong : ''} ${value === c.ko ? styles.pillOn : ''}`}
          onClick={() => onPick(c.ko)}
        >
          {s(c.key, lang, c.label)}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader
        title={title}
        /* SubHeader_AISearch left the sheet; this page's line is Insa_Todo_Subtitle1
           ("코스를 선택해 주세요"). Passed here rather than mapped in TITLE_KEYS
           because that id is shared with the result and detail pages. */
        subtitle={tExact('Insa_Todo_Subtitle1', lang)}
        onHome={goHome}
        onBack={step === 'landing' ? goHome : () => setStep('landing')}
      />

      {step === 'landing' ? (
        <div ref={landingRef} className={styles.landing}>
          {/* 7519:74985. The frame reads "제주 공항" — Jeju copy left in an 인사동
              frame — so the origin is this kiosk's own name instead. */}
          <p className={`${styles.landingNotice} ${long ? styles.landingNoticeLong : ''}`}>
            {(START_NOTE[lang] ?? START_NOTE.ko)!(getKioskLocation(kioskId).name)}
          </p>

          <div className={`${styles.label} ${styles.landingLabelCustom}`}>
            <span className={styles.bar} />
            {s('My_Course_Section', lang, CUSTOM_SECTION)}
          </div>

          <button type="button" className={styles.customCard} onClick={() => { setEntry('custom'); setStep('custom'); }}>
            <span className={styles.customLeft}>
              {iconUrl('course-ai') && (
                <img className={styles.customArt} src={iconUrl('course-ai')} alt="" draggable={false} />
              )}
              <span className={styles.customCopy}>
                <span className={styles.eyebrow}>{s('My_Course_desc1', lang, MY_COURSE_SUB)}</span>
                <span className={`${styles.customTitle} ${long ? styles.customTitleLong : ''}`}>
                  {s('My_Course_title', lang, MY_COURSE_TITLE)}
                </span>
                <span className={styles.customBody}>
                  {sheetLines(s('My_Course_desc2', lang, MY_COURSE_BODY))
                    .split('\n')
                    .map((l, i) => (
                      <span key={i} style={{ display: 'block' }}>{l}</span>
                    ))}
                </span>
              </span>
            </span>
            {arrow && <img className={styles.customArrow} src={arrow} alt="" draggable={false} />}
          </button>

          <div className={`${styles.label} ${styles.landingLabelTheme}`}>
            <span className={styles.bar} />
            {s('Recommended_Course_title', lang, RECOMMENDED_SECTION)}
          </div>

          {THEME_CARDS.map((card) => (
            <button
              key={card.key}
              type="button"
              className={styles.themeCard}
              style={{ left: `${card.x}px`, top: `${card.y}px` }}
              onClick={() => openTheme(card)}
            >
              {iconUrl(card.icon) && (
                <img
                  className={styles.themeArt}
                  src={iconUrl(card.icon)}
                  alt=""
                  draggable={false}
                  style={{
                    ['--art-x' as string]: `${card.art.x}px`,
                    ['--art-y' as string]: `${card.art.y}px`,
                    ['--art-w' as string]: `${card.art.w}px`,
                    ['--art-h' as string]: `${card.art.h}px`,
                  }}
                />
              )}
              <span
                className={styles.themeCopy}
                style={{
                  ['--tx' as string]: `${card.text.x}px`,
                  ['--ty' as string]: `${card.text.y}px`,
                  ['--tw' as string]: `${card.text.w}px`,
                }}
              >
                <span className={styles.eyebrow}>
                  {s(`Recommended_Course_${card.no}_subtitle`, lang, card.sub)}
                </span>
                <span className={`${styles.themeTitle} ${long ? styles.themeTitleLong : ''}`}>
                  {sheetLines(s(`Recommended_Course_${card.no}_title`, lang, card.title))
                    .split('\n')
                    .map((l, i) => (
                      <span key={i} style={{ display: 'block' }}>{l}</span>
                    ))}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className={`${styles.builder} ${step === 'custom' ? styles.builderFull : ''}`}>
          {step === 'custom' && (
          <p className={`${styles.builderNotice} ${long ? styles.builderNoticeLong : ''}`}>
            {(HOURS_NOTE[lang] ?? HOURS_NOTE.ko)!(
              clockLabel(Math.max(startMin, 9 * 60)),
              clockLabel(DAY_END_MIN),
            )}
          </p>
          )}

          <section className={`${styles.section} ${styles.sectionParty}`}>
            <div className={styles.label}>
              <span className={styles.bar} />
              {s(SECTION.visitors.key, lang, SECTION.visitors.label, ...SECTION.visitors.also)}
            </div>
            {chipRow(partyRef, PARTY_CHIPS, party, setParty, 268)}
          </section>

          <section className={`${styles.section} ${styles.sectionStay}`}>
            <div className={styles.label}>
              <span className={styles.bar} />
              {s(SECTION.stay.key, lang, SECTION.stay.label, ...SECTION.stay.also)}
            </div>
            {chipRow(stayRef, DURATION_CHIPS, duration, (v) => setDuration(v as InsaDuration), 412)}
          </section>

          {step === 'custom' && (
          <section className={styles.sectionJoy}>
              <div className={styles.label}>
                <span className={styles.bar} />
                {s(SECTION.interests.key, lang, SECTION.interests.label, ...SECTION.interests.also)}
              </div>

              <div className={styles.joyBar}>
                {/* 7519:75162 — the chosen 체류 기간 with how many 즐길 거리 are picked. */}
                <span className={`${styles.dayTab} ${styles.dayTabOn}`}>
                  {(() => {
                    const chip = DURATION_CHIPS.find((c) => c.ko === duration) ?? DURATION_CHIPS[1]!;
                    return s(chip.key, lang, chip.label);
                  })()}
                  {picks.length > 0 && <span className={styles.dayCount}>{picks.length}</span>}
                </span>
                {/* 7519:75178 — clears the picks. */}
                <button
                  type="button"
                  className={styles.refreshBtn}
                  onClick={() => setPicks([])}
                  aria-label={pickLang(RESET_LABEL, lang)}
                >
                  <svg viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M84 16v24H60" />
                    <path d="M12 80V56h24" />
                    <path d="M22 40a28 28 0 0 1 46-10l16 10M74 56a28 28 0 0 1-46 10L12 56" />
                  </svg>
                </button>
                {total != null && (
                  <span className={styles.joyTotal}>{(USED[lang] ?? USED.ko)!(minutesLabel(total, lang))}</span>
                )}
              </div>

              <div ref={joyRef} className={styles.joyGrid}>
                {tiles.map((t) => {
                  const order = picks.indexOf(t.code) + 1;
                  const picked = order > 0;
                  return (
                    <button
                      key={t.code}
                      type="button"
                      className={`${styles.joyChip} ${picked ? styles.joyChipOn : ''}`}
                      style={{ color: picked ? '#ffffff' : t.color }}
                      onClick={() => toggle(t.code)}
                    >
                      {picked && <span className={styles.joyChipBadge}>{order}</span>}
                      <span className={`${styles.joyChipText} ${long ? styles.joyChipTextLong : ''}`}>
                        {shopSecondCategory(t.shop, lang) || stripPrefix(t.code)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <button type="button" className={styles.cta} disabled={busy} onClick={step === 'custom' ? submit : submitTheme}>
            {s('SubmitButton', lang, SUBMIT_LABEL)}
          </button>
        </div>
      )}

      <InsadongLeftNav onHome={goHome} onBack={step === 'landing' ? goHome : () => setStep('landing')} />

      {/* The tall builder runs to y3675, so only the landing and the short
          builder carry the promo — same rule as JejuPageFrame's showBanner. */}
      {banner && step !== 'custom' && (
        <button
          type="button"
          className={styles.banner}
          onClick={() => navigate('search', '검색')}
          aria-label={pickLang({ ko: '상점 검색', en: 'Search shops' }, lang)}
        >
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </>
  );
}
