import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { InsaCourseSet, InsaDuration } from '@shared/types/insaCourse';
import type { Shop } from '@shared/types/shop';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { iconUrl as insaIconUrl } from '@renderer/assets/icons/insadong';
import { useAiStore } from '@renderer/store/aiStore';
import { useShopStore } from '@renderer/store/shopStore';
import { useLang, pick } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { isOk } from '@shared/types/result';
import { sheetText } from '@renderer/lib/loc';
import { clockLabel, minutesLabel, nowMinutes, partySize } from '@renderer/lib/jejuCourse';
import { shopSecondCategory, stripPrefix } from '@renderer/lib/shops';
import { useFitText } from '@layouts/components/fitText';
import { OsanHeader } from './OsanHeader';
import { OsanLeftNav } from './OsanLeftNav';
import { OsanPageBg } from './OsanPageBg';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import styles from './OsanAiCourse.module.css';

/**
 * '정이' 뭐하지 — the 오산 AI course entry.
 *
 *   · 7812:110430  오산>코스선택       landing — 커스텀 코스 card + four 추천코스 cards
 *   · 7812:110570  오산>코스카테고리-01 builder — 방문 인원 / 체류 기간 / 즐길 거리 + CTA
 *
 * Both frames are the 인사동 renewal's (InsadongAiCourse) in 오색시장 navy, so this
 * is the same screen: landing and builder are ONE screen with a step, a 추천코스
 * card opens the short builder (no 즐길 거리), and 뒤로 from the result resumes
 * the answers the visitor gave.
 *
 * The course comes from the 지점 코스 API, `POST /api/courses/recommend` with
 * `region: OSAEK`, through window.api.insaCourse (InsaCourseService adds the
 * region; the server starts the route at this kiosk). 관심사 are the 오색시장 catalogue's own `secondCategoryKr` codes
 * (`2-한식`, `4-의류`). Nothing is computed on the kiosk: when the API answers
 * nothing, the result page shows its empty state.
 *
 * ── Copy ──────────────────────────────────────────────────────────────────
 * Localization_Osaek is the source of truth wherever it has a row (JEONGI_Todo_*,
 * Visitor_*, StayTime_*, JoyContent, Recommended_Course_*, My_Course_*,
 * SubmitButton) — read through `sheet()`, with the copy authored here as the
 * per-language fallback. Only the chip LABELS come from the sheet; the values
 * stored and sent to the API (`Chip.ko`) are unchanged. HOURS_NOTE stays
 * authored: its sheet row (JEONGI_Todo_Subtitle1-2) bakes 21:00 into the
 * sentence and has no slot for the start time outside Korean.
 */

type L8 = Partial<Record<Lang, string>>;

const txt = (lang: Lang, authored: L8): string => pick(authored, lang) ?? '';

/** Localization_Osaek cell for this language (authored copy as the fallback). A
 *  literal two-character "\\n" typed into a cell becomes a real line break. */
const sheet = (key: string, lang: Lang, authored?: L8): string =>
  sheetText(key, lang, authored).replace(/\\n/g, '\n');

/** A sheet title, keeping the frame's authored line break when the sheet says
 *  the same words (the sheet carries none); different wording wraps naturally. */
const sheetTitle = (key: string, lang: Lang, authored: L8): string => {
  const value = sheet(key, lang, authored);
  const mine = pick(authored, lang) ?? '';
  const bare = (x: string): string => x.replace(/\s+/g, '');
  return mine.includes('\n') && bare(mine) === bare(value) ? mine : value;
};

/** "Женщины/Лекарственные травы" has no break point until the space, so it
 *  ran out of the 268 tile; a zero-width space lets a line end after "/". */
const breakAfterSlash = (s: string): string => s.replace(/\/(?!\s)/g, '/\u200B');

/** Localization_Osaek JEONGI_Todo_Title; the frame's Korean title as the fallback. */
export const osanAiTitle = (lang: Lang): string =>
  sheet('JEONGI_Todo_Title', lang, { ko: '‘정이’ 뭐하지' }) || "'정이' 모하지 (AI 검색)";

interface Chip {
  /** The canonical value — what travels to the API and the AI store. */
  ko: string;
  /** Localization_Osaek row for the displayed label (`label` is its fallback). */
  key?: string;
  label: L8;
  /** What the chip itself shows, in every language, when it differs from
   *  `label` (the 방문 인원 chips show bare numbers; the unit is in the title).
   *  `label` stays the full answer the result page's summary repeats. */
  chip?: string;
  width?: number;
}

/** 방문 인원 chips — the frame's widths (268 · 269 · 268 · 268 · 311 · 290). */
const PARTY_CHIPS: Chip[] = [
  { ko: '1명', key: 'Visitor_1', chip: '1', width: 268, label: { ko: '1명', en: '1 person', ja: '1人', zh: '1人', vi: '1 người', th: '1 คน', ru: '1 человек', id: '1 orang' } },
  { ko: '2명', key: 'Visitor_2', chip: '2', width: 269, label: { ko: '2명', en: '2 people', ja: '2人', zh: '2人', vi: '2 người', th: '2 คน', ru: '2 человека', id: '2 orang' } },
  { ko: '3명', key: 'Visitor_3', chip: '3', width: 268, label: { ko: '3명', en: '3 people', ja: '3人', zh: '3人', vi: '3 người', th: '3 คน', ru: '3 человека', id: '3 orang' } },
  { ko: '4명', key: 'Visitor_4', chip: '4', width: 268, label: { ko: '4명', en: '4 people', ja: '4人', zh: '4人', vi: '4 người', th: '4 คน', ru: '4 человека', id: '4 orang' } },
  { ko: '5 ~ 9명', key: 'Visitor_5', chip: '5 ~ 9', width: 311, label: { ko: '5 ~ 9명', en: '5~9 pax', ja: '5~9人', zh: '5~9人', vi: '5~9 người', th: '5~9 คน', ru: '5~9 чел.', id: '5~9 orang' } },
  { ko: '10명~', key: 'Visitor_6', chip: '10~', width: 290, label: { ko: '10명~', en: '10+ pax', ja: '10人~', zh: '10人~', vi: '10 người~', th: '10 คน~', ru: '10+ чел.', id: '10 orang~' } },
];

/** 체류 기간 chips — `ko` holds the API's SLOT CODE, the label is what the chip shows. */
const DURATION_CHIPS: Chip[] = [
  { ko: '0-2', key: 'StayTime_02', label: { ko: '0 ~ 2시간', en: '0 ~ 2 hours', ja: '0〜2時間', zh: '0~2小时', vi: '0 ~ 2 giờ', th: '0 ~ 2 ชั่วโมง', ru: '0 ~ 2 часа', id: '0 ~ 2 jam' } },
  { ko: '2-4', key: 'StayTime_24', label: { ko: '2 ~ 4시간', en: '2 ~ 4 hours', ja: '2〜4時間', zh: '2~4小时', vi: '2 ~ 4 giờ', th: '2 ~ 4 ชั่วโมง', ru: '2 ~ 4 часа', id: '2 ~ 4 jam' } },
  { ko: '4-6', key: 'StayTime_46', label: { ko: '4 ~ 6시간', en: '4 ~ 6 hours', ja: '4〜6時間', zh: '4~6小时', vi: '4 ~ 6 giờ', th: '4 ~ 6 ชั่วโมง', ru: '4 ~ 6 часов', id: '4 ~ 6 jam' } },
  { ko: '6+', key: 'StayTime_66', label: { ko: '6시간 ~', en: '6 hours ~', ja: '6時間〜', zh: '6小时以上', vi: 'Từ 6 giờ', th: '6 ชั่วโมงขึ้นไป', ru: 'От 6 часов', id: '6 jam ke atas' } },
];

/** What a chip's answer reads as — its sheet row, else the authored label. */
const chipLabel = (c: Chip, lang: Lang): string => (c.key ? sheet(c.key, lang, c.label) : txt(lang, c.label));

/** The updated frame (인원(명)넣고 카테고리에는 숫자만), Korean included: the unit
 *  goes once in the 방문 인원 title — the sheet's Visitor_Title + this unit,
 *  "방문 인원 (명)", "Number of Visitors (person/people)" — and the chips carry
 *  numbers only (1 … 5 ~ 9, 10~). */
const VISITORS_UNIT: L8 = {
  ko: ' (명)', en: ' (person/people)', ja: '（人）', zh: '（人）',
  vi: ' (người)', th: ' (คน)', ru: ' (чел.)', id: ' (orang)',
};

const SECTION = {
  visitors: { ko: '방문 인원', en: 'Group size', ja: '訪問人数', zh: '同行人数', vi: 'Số người', th: 'จำนวนผู้มา', ru: 'Количество гостей', id: 'Jumlah orang' } as L8,
  stay: { ko: '체류 기간', en: 'Length of stay', ja: '滞在期間', zh: '停留时间', vi: 'Thời gian lưu trú', th: 'ระยะเวลาพำนัก', ru: 'Срок пребывания', id: 'Lama menginap' } as L8,
  interests: { ko: '즐길 거리', en: 'What to enjoy', ja: '楽しみ方', zh: '体验项目', vi: 'Hoạt động yêu thích', th: 'กิจกรรมที่สนใจ', ru: 'Что интересно', id: 'Aktivitas' } as L8,
};

/** The gauge on the 즐길 거리 bar ("3시간 30분 소요"). */
const USED: Partial<Record<Lang, (t: string) => string>> = {
  ko: (t) => `${t} 소요`, en: (t) => `${t} planned`, ja: (t) => `所要 ${t}`, zh: (t) => `需时 ${t}`,
  vi: (t) => `Mất ${t}`, th: (t) => `ใช้เวลา ${t}`, ru: (t) => `Занято ${t}`, id: (t) => `Butuh ${t}`,
};

/** 7812:110703 — the slice of the day courses fit inside. */
const HOURS_NOTE: Partial<Record<Lang, (from: string, to: string) => string>> = {
  ko: (f, t) => `*${f}부터 ${t}까지 이용 가능한 코스를 추천해드립니다.`,
  en: (f, t) => `*We recommend courses you can enjoy from ${f} to ${t}.`,
  ja: (f, t) => `*${f}から${t}まで利用できるコースをおすすめします。`,
  zh: (f, t) => `*为您推荐${f}至${t}期间可游玩的路线。`,
  vi: (f, t) => `*Chúng tôi gợi ý các lộ trình có thể đi từ ${f} đến ${t}.`,
  th: (f, t) => `*เราแนะนำเส้นทางที่เที่ยวได้ตั้งแต่ ${f} ถึง ${t}`,
  ru: (f, t) => `*Рекомендуем маршруты, доступные с ${f} до ${t}.`,
  id: (f, t) => `*Kami merekomendasikan rute yang bisa dinikmati dari ${f} hingga ${t}.`,
};

/** 7812:110433 — every course starts at this kiosk. */
const START_NOTE: L8 = {
  ko: '*모든 추천코스는 키오스크를 기준으로 제작되었습니다.',
  en: '*All recommended courses start from this kiosk.',
  ja: '*すべてのおすすめコースはこのキオスクを起点に作成されています。',
  zh: '*所有推荐路线均以本自助终端为起点制作。',
  vi: '*Tất cả lộ trình gợi ý đều xuất phát từ ki-ốt này.',
  th: '*เส้นทางแนะนำทั้งหมดเริ่มต้นจากตู้คีออสก์นี้',
  ru: '*Все рекомендованные маршруты начинаются от этого киоска.',
  id: '*Semua rute rekomendasi berangkat dari kios ini.',
};

/** START_NOTE without its "*" — the sheet row carries none; the notice draws the marker. */
const noteBody = (authored: L8): L8 =>
  Object.fromEntries(Object.entries(authored).map(([k, v]) => [k, (v ?? '').replace(/^\*/, '')])) as L8;

/** The authored 방문 인원 title (no unit) — the fallback for the sheet's Visitor_Title. */
const VISITORS_WITH_UNIT_BARE: L8 = {
  ko: '방문 인원', en: 'Number of Visitors', ja: '訪問人数', zh: '访问人数',
  vi: 'Số khách', th: 'จำนวนผู้เยี่ยมชม', ru: 'Количество гостей', id: 'Jumlah pengunjung',
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
/** ♿ builder page 1 → page 2 (오산>코스 카테고리-01 7878:45935). */
const NEXT_LABEL: L8 = {
  ko: '다음으로', en: 'Next', ja: '次へ', zh: '下一步',
  vi: 'Tiếp theo', th: 'ถัดไป', ru: 'Далее', id: 'Berikutnya',
};
const RESET_LABEL: L8 = {
  ko: '선택 초기화', en: 'Clear picks', ja: '選択をリセット', zh: '重置选择',
  vi: 'Chọn lại từ đầu', th: 'ล้างการเลือก', ru: 'Сбросить выбор', id: 'Atur ulang pilihan',
};
const SEARCH_LABEL: L8 = {
  ko: '상점 검색', en: 'Search shops', ja: '店舗検索', zh: '搜索店铺',
  vi: 'Tìm cửa hàng', th: 'ค้นหาร้านค้า', ru: 'Поиск магазинов', id: 'Cari toko',
};

/** One store answer (kept canonical) → the label the chip showed, in this language. */
export const localizeOsanAiPick = (ko: string, lang: Lang): string => {
  const chip = [...PARTY_CHIPS, ...DURATION_CHIPS].find((c) => c.ko === ko);
  return chip ? chipLabel(chip, lang) : ko;
};

/**
 * The four 추천코스 cards, in frame order. Positions and the art / copy offsets
 * are the frame's (identical to the 인사동 renewal's), and so is the artwork —
 * the same four illustrations, reused from the 인사동 asset folder at their
 * full resolution. The cards' chevrons (Group 1707482912…925) are white discs
 * with an empty vector on a white card, so they draw nothing and are not drawn.
 */
interface ThemeCard {
  /** Course key handed to the result page (`nature` / `food` / `shop` / `family`). */
  key: string;
  /** Localization_Osaek Recommended_Course_{n}_subtitle / _title. */
  n: number;
  icon: string;
  sub: L8;
  /** Title per language; `\n` is the break the frame draws. */
  title: L8;
  x: number;
  y: number;
  art: { x: number; y: number; w: number; h: number };
  text: { x: number; y: number; w: number };
}

/** The frame's card height (7519:75011); other languages may grow it. */
const THEME_CARD_H = 482;

const THEME_CARDS: ThemeCard[] = [
  {
    key: 'nature', n: 1, icon: 'course-nature',
    sub: {
      ko: '유산을 따라 걷는', en: 'Walking the heritage trail', ja: '遺産をたどって歩く',
      zh: '沿着遗产漫步', vi: 'Dạo bước theo dấu di sản', th: 'เดินตามรอยมรดก',
      ru: 'Прогулка по наследию', id: 'Menyusuri jejak warisan',
    },
    title: {
      ko: '유산\n탐방 코스', en: 'Heritage\nCourse', ja: '遺産\n探訪コース',
      zh: '遗产\n探访路线', vi: 'Tuyến khám phá\ndi sản', th: 'เส้นทาง\nสำรวจมรดก',
      ru: 'Маршрут\nнаследия', id: 'Rute jelajah\nwarisan',
    },
    x: 0, y: 1052,
    art: { x: 43.33, y: 137.49, w: 279.28, h: 207.129 },
    text: { x: 367.12, y: 116, w: 396.24 },
  },
  {
    key: 'food', n: 2, icon: 'course-food',
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
    key: 'shop', n: 3, icon: 'course-shopping',
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
    key: 'family', n: 4, icon: 'course-family',
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
 * 즐길 거리 each 추천코스 card asks the API for, by the 오색시장 catalogue's
 * second-category NAME (prefix stripped) — resolved to the prefixed code from the
 * shop rows this kiosk holds; a name the catalogue does not carry is skipped.
 * The market has no heritage sites, so 유산 탐방 walks its traditional trades.
 */
const THEME_PICKS: Record<string, string[]> = {
  nature: ['인삼/약재', '떡/두부', '기름/방앗간', '한식'],
  food: ['한식', '카페/제과', '분식', '족발/만두'],
  shop: ['의류', '패션잡화', '생활용품', '건강'],
  family: ['분식', '치킨/강정', '카페/제과', '문구'],
};

/** The notice quotes the closing bound the API schedules to. */
const DAY_END_MIN = 21 * 60;

/**
 * Which shop bases are 즐길 거리, in tile order. 정이 도와줘 (마트 · 은행 · 화장실 …)
 * are facilities, not places to walk to.
 */
const JOY_BASES = ['정이 뭐먹지', '정이 뭐사지', '정이 뭐사지2'];

/**
 * The label colour of every tile slot, exactly as 오산>코스카테고리-01 (7812:110619)
 * draws its 6×5 grid, row by row: 8 pink, 4 green, 6 lilac, 1 sky, 5 blue,
 * 6 brown. A tile takes the colour of the slot it lands in, so the grid reads the
 * same as the frame whatever categories fill it. (Slot 12, 레저·액티비티, is drawn
 * selected in the frame; it sits in the green run.)
 */
const SLOT_COLORS: string[] = [
  '#f59993', '#f59993', '#f59993', '#f59993', '#f59993', '#f59993',
  '#f59993', '#f59993', '#81caa8', '#81caa8', '#81caa8', '#81caa8',
  '#a9a3d9', '#a9a3d9', '#a9a3d9', '#a9a3d9', '#a9a3d9', '#a9a3d9',
  '#6ea8eb', '#6375bf', '#6375bf', '#6375bf', '#6375bf', '#6375bf',
  '#c89b7b', '#c89b7b', '#c89b7b', '#c89b7b', '#c89b7b', '#c89b7b',
];
/** Past the frame's 30 slots, the colour cycle repeats from the top. */
const slotColor = (i: number): string => SLOT_COLORS[i % SLOT_COLORS.length]!;

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
}

export function OsanAiCourse({ controller }: Props): JSX.Element {
  const { navigate } = controller;
  const lang = useLang();
  const long = lang !== 'ko';
  const goHome = (): void => navigate('home', 'Back');

  const setResumeQuestions = useAiStore((s) => s.setResumeQuestions);
  /* The store as it stood when 뒤로 was pressed on the result — read ONCE, so
     the visitor lands back on the step and answers they actually gave. */
  const [resumed] = useState(() => {
    const ai = useAiStore.getState();
    return ai.resumeQuestions ? ai : null;
  });
  const [step, setStep] = useState<'landing' | 'custom' | 'theme'>(
    !resumed ? 'landing' : resumed.entry === 'theme' ? 'theme' : 'custom',
  );
  useEffect(() => {
    setResumeQuestions(false);
  }, [setResumeQuestions]);
  const [themeKey, setThemeKey] = useState<string | null>(
    resumed?.entry === 'theme' ? resumed.course || null : null,
  );
  const [party, setParty] = useState(resumed?.visitors || '2명');
  const [duration, setDuration] = useState<InsaDuration>(
    (resumed?.stay as InsaDuration | undefined) || '2-4',
  );
  /* 즐길 거리 in tap order, as the API's `N-name` codes. */
  const [picks, setPicks] = useState<string[]>(() => resumed?.interests ?? []);
  const [busy, setBusy] = useState(false);
  /*
   * ♿ (베리어프리) — the promo moves under the mode bar and the header to 719, so
   * the tall custom builder no longer fits: the frames split it in two pages,
   * 방문 인원 + 체류 기간 (7878:45935) then 즐길 거리 (7878:44811).
   */
  const low = useAccessibilityStore((s) => s.lowReach);
  /* Coming back from the result re-opens the page the picks were made on. */
  const [joyPage, setJoyPage] = useState(() => !!resumed && resumed.entry !== 'theme');

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

  /* The clock when the page opened, for the notice only. */
  const startMin = useRef(nowMinutes()).current;

  /** Every second category the catalogue carries under a place-to-go base. */
  const tiles: JoyTile[] = useMemo(() => {
    const seen = new Map<string, { code: string; shop: Shop; rank: number }>();
    for (const shop of shops) {
      const code = shop.secondCategoryKr?.trim();
      const rank = JOY_BASES.indexOf(shop.baseCategoryKr ?? '');
      if (!code || rank < 0 || seen.has(code)) continue;
      seen.set(code, { code, shop, rank });
    }
    const num = (c: string): number => Number.parseInt(c, 10) || 0;
    return [...seen.values()]
      .sort((x, y) => x.rank - y.rank || num(x.code) - num(y.code))
      .map((t, i) => ({ code: t.code, shop: t.shop, color: slotColor(i) }));
  }, [shops]);
  const codeByName = useMemo(() => new Map(tiles.map((t) => [stripPrefix(t.code), t.code])), [tiles]);

  /* Tell the customer display which stage is up. */
  useEffect(() => {
    void window.api.kiosk.setScreen(step === 'landing' ? 'ai_search' : 'ai_questions');
  }, [step]);

  /* A live total under the tiles for the taps so far, asked a moment after the
     last one. A failure simply leaves it blank — the CTA still works. */
  const [preview, setPreview] = useState<{ key: string; course: InsaCourseSet } | null>(null);
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
        .recommend({ interests: picks, duration, numberOfPeople: partySize(party), startAt: localIso(new Date()) })
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

  /* The gauge follows the 실시간 코스; when nothing is open it reports the 일반 코스. */
  const previewRoute = preview && preview.key === previewKey
    ? (preview.course.realtime.available && preview.course.realtime.spots.length > 0
        ? preview.course.realtime
        : preview.course.general)
    : null;
  const total = previewRoute ? previewRoute.totalMinutes : null;

  /* The step is part of every key: landing and builder are one screen, and a
     group whose boxes are not mounted yet (the builder, while on the landing)
     measures nothing — it must fit again when its step appears. */
  useFitText(landingRef, styles.themeTitleLong, long, 0.62, `${lang}|theme|${step}`);

  /* Figma note on the other-language frames (세로로 길어지게, 단 모든 칸의 크기는
     같아야함): a 추천코스 card whose copy runs past its 482 grows taller, and all
     four grow by the same amount — the tallest copy decides. The copy keeps the
     frame's top offset and gets the same space under it as above it. */
  useLayoutEffect(() => {
    const landing = landingRef.current;
    if (!landing || !styles.themeCopy) return undefined;
    const copies = [...landing.getElementsByClassName(styles.themeCopy)] as HTMLElement[];
    /* How far the cards may grow before the bottom row leaves the room the
       screen has: two rows each grow, so half the space under them — above the
       promo (3267) normally, above the screen's foot in ♿ (landing at 1419,
     cards to 3497 + 2 × grow ≤ 3830). */
    const cap = low ? 165 : 220;
    // The copy keeps its frame top; under it, 70 of space is enough to read as
    // the card's foot (the frame's own ~116 is only kept while it fits).
    const need = (): number => copies.reduce((m, c) => Math.max(m, c.offsetTop + c.offsetHeight + 70), THEME_CARD_H);
    const apply = (): void => {
      if (!long) {
        landing.style.setProperty('--theme-grow', '0px');
        return;
      }
      // Past the cap the titles step down (the same --fit useFitText set)
      // rather than push a card off the screen.
      let k = parseFloat(landing.style.getPropertyValue('--fit')) || 1;
      let n = need();
      while (n - THEME_CARD_H > cap && k > 0.5) {
        k = Math.round((k - 0.02) * 100) / 100;
        landing.style.setProperty('--fit', String(k));
        n = need();
      }
      landing.style.setProperty('--theme-grow', `${Math.ceil(Math.min(cap, n - THEME_CARD_H))}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    for (const c of copies) ro.observe(c);
    return () => {
      ro.disconnect();
      landing.style.removeProperty('--theme-grow');
    };
  }, [long, lang, step, low]);

  useFitText(partyRef, styles.pillLong, long, 0.55, `${lang}|party|${step}|${joyPage}`);
  useFitText(stayRef, styles.pillLong, long, 0.55, `${lang}|stay|${step}|${joyPage}`);
  // A word longer than any tile ("Сельскохозяйственная") takes its own smaller
  // factor (rescue, ≥ 0.45) instead of dragging all 26 tiles down with it.
  useFitText(joyRef, styles.joyChipTextLong, long, 0.6, `${lang}|${tiles.length}|${step}|${joyPage}`, 'both', 0.45);

  /* Other languages: a 즐길 거리 tile whose name needs more lines grows taller
     (Figma note: 세로로 칸이 늘어나더라도), and its whole grid row with it. The CTA
     under the grid is absolutely placed, so it moves down by whatever the grid
     grew past its Korean height (rows × 215 + gaps × 29). */
  useLayoutEffect(() => {
    const grid = joyRef.current;
    const builder = grid?.closest<HTMLElement>(`.${styles.builder}`);
    if (!grid || !builder) return undefined;
    const rows = Math.ceil(tiles.length / 6);
    const base = rows > 0 ? rows * 215 + (rows - 1) * 29 : 0;
    const apply = (): void => {
      const grow = long ? Math.max(0, grid.offsetHeight - base) : 0;
      builder.style.setProperty('--joy-grow', `${grow}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(grid);
    return () => {
      ro.disconnect();
      builder.style.removeProperty('--joy-grow');
    };
  }, [long, tiles.length, step, joyPage]);

  const arrow = osanIconUrl('course-arrow');
  const banner = osanIconUrl('banner-course');
  /* Localization_Osaek JEONGI_Todo_Subtitle1 — the sheet has no SubHeader_AISearch
     row, which the old screenSubtitle lookup read, so the header showed nothing. */
  const aiSubtitle = sheet('JEONGI_Todo_Subtitle1', lang);

  const toLanding = (): void => {
    setJoyPage(false);
    setStep('landing');
  };
  /* ♿ page 2 of the custom builder steps back to page 1, not to the landing. */
  const goBack = (): void => {
    if (step === 'landing') goHome();
    else if (low && step === 'custom' && joyPage) setJoyPage(false);
    else toLanding();
  };
  const lowJoy = low && step === 'custom' && joyPage;
  const lowAsk = low && !lowJoy && step !== 'landing';

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
          {c.chip ?? chipLabel(c, lang)}
        </button>
      ))}
    </div>
  );

  const lines = (text: string): JSX.Element[] =>
    text.split('\n').map((l, i) => (
      <span key={i} style={{ display: 'block' }}>{l}</span>
    ));

  return (
    <>
      <OsanPageBg />

      {low ? (
        <div className={styles.lowHeader}>
          <OsanHeader title={osanAiTitle(lang)} subtitle={aiSubtitle} onHome={goHome} onBack={goBack} />
        </div>
      ) : (
        <OsanHeader title={osanAiTitle(lang)} subtitle={aiSubtitle} onHome={goHome} onBack={goBack} />
      )}

      {step === 'landing' ? (
        <div ref={landingRef} className={low ? `${styles.landing} ${styles.landingLow}` : styles.landing}>
          <p className={`${styles.landingNotice} ${long ? styles.landingNoticeLong : ''}`}>{`*${sheet('JEONGI_Todo_Subtitle1-1', lang, noteBody(START_NOTE))}`}</p>

          <div className={`${styles.label} ${styles.landingLabelCustom}`}>
            <span className={styles.bar} />
            {txt(lang, CUSTOM_SECTION)}
          </div>

          <button type="button" className={styles.customCard} onClick={() => { setEntry('custom'); setStep('custom'); }}>
            <span className={styles.customLeft}>
              {insaIconUrl('course-ai') && (
                <img className={styles.customArt} src={insaIconUrl('course-ai')} alt="" draggable={false} />
              )}
              <span className={styles.customCopy}>
                <span className={styles.eyebrow}>{sheet('My_Course_desc1', lang, MY_COURSE_SUB)}</span>
                <span className={`${styles.customTitle} ${long ? styles.customTitleLong : ''}`}>
                  {sheet('My_Course_title', lang, MY_COURSE_TITLE)}
                </span>
                <span className={styles.customBody}>{lines(sheet('My_Course_desc2', lang, MY_COURSE_BODY))}</span>
              </span>
            </span>
            {arrow && <img className={styles.customArrow} src={arrow} alt="" draggable={false} />}
          </button>

          <div className={`${styles.label} ${styles.landingLabelTheme}`}>
            <span className={styles.bar} />
            {sheet('Recommended_Course_title', lang, RECOMMENDED_SECTION)}
          </div>

          {THEME_CARDS.map((card) => (
            <button
              key={card.key}
              type="button"
              className={styles.themeCard}
              style={{
                left: `${card.x}px`,
                // The bottom row moves down by however much the cards grew.
                top: card.y > THEME_CARDS[0]!.y ? `calc(${card.y}px + var(--theme-grow, 0px))` : `${card.y}px`,
              }}
              onClick={() => openTheme(card)}
            >
              {insaIconUrl(card.icon) && (
                <img
                  className={styles.themeArt}
                  src={insaIconUrl(card.icon)}
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
                <span className={styles.eyebrow}>{sheet(`Recommended_Course_${card.n}_subtitle`, lang, card.sub)}</span>
                <span className={`${styles.themeTitle} ${long ? styles.themeTitleLong : ''}`}>
                  {lines(sheetTitle(`Recommended_Course_${card.n}_title`, lang, card.title))}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div
          className={`${styles.builder} ${step === 'custom' && !low ? styles.builderFull : ''} ${
            lowAsk ? styles.builderLowAsk : ''
          } ${lowJoy ? styles.builderLowJoy : ''}`}
        >
          {/* ♿ the 추천코스 builder carries the hours notice too (7878:46164). */}
          {(step === 'custom' || low) && (
            <p className={`${styles.builderNotice} ${long ? styles.builderNoticeLong : ''}`}>
              {(HOURS_NOTE[lang] ?? HOURS_NOTE.ko)!(clockLabel(Math.max(startMin, 9 * 60)), clockLabel(DAY_END_MIN))}
            </p>
          )}

          {!lowJoy && (
          <>
          <section className={`${styles.section} ${styles.sectionParty}`}>
            <div className={styles.label}>
              <span className={styles.bar} />
              {`${sheet('Visitor_Title', lang, VISITORS_WITH_UNIT_BARE)}${txt(lang, VISITORS_UNIT)}`}
            </div>
            {chipRow(partyRef, PARTY_CHIPS, party, setParty, 268)}
          </section>

          <section className={`${styles.section} ${styles.sectionStay}`}>
            <div className={styles.label}>
              <span className={styles.bar} />
              {sheet('StayTime', lang, SECTION.stay)}
            </div>
            {chipRow(stayRef, DURATION_CHIPS, duration, (v) => setDuration(v as InsaDuration), 412)}
          </section>
          </>
          )}

          {step === 'custom' && (!low || joyPage) && (
            <section className={styles.sectionJoy}>
              {/* ♿ 7878:45920 sets the label inside the tab row, 371 wide. */}
              {!low && (
                <div className={styles.label}>
                  <span className={styles.bar} />
                  {sheet('JoyContent', lang, SECTION.interests)}
                </div>
              )}

              <div className={styles.joyBar}>
                {low && (
                  <div className={`${styles.label} ${styles.joyBarLabel}`}>
                    <span className={styles.bar} />
                    {sheet('JoyContent', lang, SECTION.interests)}
                  </div>
                )}
                {/* 7812:110611 — the chosen 체류 기간 with how many 즐길 거리 are picked. */}
                <span className={`${styles.dayTab} ${styles.dayTabOn}`}>
                  {chipLabel(DURATION_CHIPS.find((c) => c.ko === duration) ?? DURATION_CHIPS[1]!, lang)}
                  {picks.length > 0 && <span className={styles.dayCount}>{picks.length}</span>}
                </span>
                {/* 7812:110616 — clears the picks. */}
                <button type="button" className={styles.refreshBtn} onClick={() => setPicks([])} aria-label={txt(lang, RESET_LABEL)}>
                  {osanIconUrl('course-refresh') && <img src={osanIconUrl('course-refresh')} alt="" draggable={false} />}
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
                        {breakAfterSlash(shopSecondCategory(t.shop, lang) || stripPrefix(t.code))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {low && step === 'custom' && !joyPage ? (
            <button type="button" className={`${styles.cta} ${styles.ctaNext}`} onClick={() => setJoyPage(true)}>
              {txt(lang, NEXT_LABEL)}
            </button>
          ) : (
            <button type="button" className={styles.cta} disabled={busy} onClick={step === 'custom' ? submit : submitTheme}>
              {sheet('SubmitButton', lang, SUBMIT_LABEL)}
            </button>
          )}
        </div>
      )}

      <OsanLeftNav onHome={goHome} onBack={goBack} />

      {/* The tall builder runs to y3710, so only the landing and the short
          builder carry the banner (7812:110552), which opens 상점 검색. In ♿
          every step carries it, under the mode bar (7878:44658 / 45935 / 44811). */}
      {banner && (step !== 'custom' || low) && (
        <button
          type="button"
          className={low ? `${styles.banner} ${styles.bannerLow}` : styles.banner}
          onClick={() => navigate('search', '검색')}
          aria-label={txt(lang, SEARCH_LABEL)}
        >
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </>
  );
}
