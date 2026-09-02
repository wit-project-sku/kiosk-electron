/**
 * 제주 AI 코스 상세 — Figma node 6516:73138 (제주>제주모하지(AI검색)-03-1), the
 * 2026-08-26 re-stack of 6289:55320 (-03-1) / 6289:55078 (-03-2). See the
 * stylesheet header for what moved; the one thing that is new rather than moved
 * is the row of answer pills under the summary bar.
 *
 * Shows the course chosen on JejuAiResult: its title/description/hashtags, a
 * summary bar, and the numbered spot itinerary.
 *
 * WHERE THE CONTENT COMES FROM — worth reading before changing anything:
 *  - Course title / description / hashtags: authored (same source as the course
 *    cards on JejuAiResult).
 *  - THE ITINERARY: `POST /api/jeju/courses/recommend`, via JejuCourseService.
 *    The server owns the scheduling now — which spots, in what order, on which
 *    day, how long at each, how long between them and how hard it is. This page
 *    only resolves each `shopId` against the catalogue and draws it.
 *  - Summary bar 이동수단: the visitor's own answer, carried on aiStore.
 *
 * ── What the API replaced ────────────────────────────────────────────
 * `buildSpots` used to greedily walk the picked interests and take the first
 * unused matching shop, four per day, and every number on the page was authored
 * per course — a kiosk telling every visitor "약 18Km" whatever the itinerary.
 * Neither could be right: `Shop` carries no duration, difficulty or distance,
 * and nothing here computed a route. The server does, against 220 places with
 * coordinates, inside an 8-hour daily budget, honouring opening hours, closing
 * days, 5일장 market days, ferry crossings and party capacity.
 *
 * ★ Both survive as the OFFLINE fallback and nothing more. A kiosk that cannot
 * reach the API still draws a course rather than an error, and on that path
 * EVERY number is the authored placeholder again — see COURSE_META. The two
 * paths are never mixed: real numbers or authored ones, never half of each.
 *
 * ── The arrows page the LIST, they do not scroll it ─────────────────
 * A day can hold nine scheduled spots and the frame draws four, so the extra
 * ones have to go somewhere. They are PAGED, not scrolled: the ← → pair beside
 * the DAY label walks a flat run of pages, four cards each, and a day simply
 * contributes as many pages as it needs before the next day starts. That is
 * what the buttons are for — the design put them there precisely so this page
 * would never need a scrollbar, and a kiosk's spot list should not be something
 * a visitor has to drag.
 *
 * ★ One deliberate difference from the design on the API path: the summary's
 * third stat reads 이동시간 (real, summed `travelMinutes`) rather than the
 * design's 이동거리, because the endpoint returns no distance at all and an
 * authored "약 18Km" beside three real numbers is worse than an honest fourth.
 * The fallback path keeps 이동거리, where it is authored alongside the rest.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { Shop } from '@shared/types/shop';
import type { JejuCourse, JejuCourseSpot } from '@shared/types/jejuCourse';
import { isOk } from '@shared/types/result';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useAiStore } from '@renderer/store/aiStore';
import { useShopStore } from '@renderer/store/shopStore';
import { useDetailStore } from '@renderer/store/detailStore';
import type { DetailItem } from '@renderer/store/detailStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { sheetText } from '@renderer/lib/loc';
import type { Lang } from '@renderer/lib/i18n';
import { pick } from '@renderer/lib/i18n';
import {
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopSecondCategory,
  stripPrefix,
} from '@renderer/lib/shops';
import {
  courseLetter,
  difficultyLabel,
  interestCodes,
  jejuCourseDayTitle,
  minutesLabel,
  aboutMinutesLabel,
  nightCount,
  partySize,
  todayIso,
  transportCode,
} from '@renderer/lib/jejuCourse';
import { localizeJejuAiPick } from '@renderer/lib/jejuAiPicksLabel';
import { JejuPageFrame } from './JejuPageFrame';
import { JejuCourseSpotCard } from './JejuCourseSpotCard';
import styles from './JejuAiDetail.module.css';

interface Props {
  controller: KioskController;
}

/**
 * Cards on one page — the four numbered stops the design draws, and the four
 * the numbered rail is sized for.
 *
 * It is a PAGE size, not a day size. The server schedules as many spots in a
 * day as its time budget allows (nine on day 1 of a two-day 자연 course, checked
 * 2026-08-25); those become three pages of this size rather than one long
 * scroll. The offline fallback still builds exactly one page per day.
 */
const SPOTS_PER_PAGE = 4;

/**
 * Days on the OFFLINE fallback, from the 체류 기간 answer. The API returns its
 * own `days` (nights + 1, capped at 4) and that wins whenever it answered.
 */
const DAYS_BY_STAY: Record<string, number> = {
  '당일치기': 1,
  '1박 2일': 2,
  '2박 3일': 3,
  '3박 이상': 4,
};

/* ── QR block under the itinerary — ♿ ONLY ────────────────────────────
   The standard frame (6516:73138) puts the QR on the DAY row at a fixed y1395,
   so none of this arithmetic applies there any more; it survives for the ♿
   frame (6418:11330), which still draws the QR under the last card.

   Derived from .listLow in the CSS (top 1423, height 2240) and the spot card
   (height 515, gap 50), so the QR tracks the ACTUAL number of cards rather than
   a baked y. It moves in BOTH directions: a thin day holds fewer cards than the
   design's four and the QR rises to meet them, while a scheduled day can hold
   nine — more than the list's 2240 viewport shows — and the QR would otherwise
   be pushed off the artboard entirely. See `qrTopFor` for the clamp that stops
   it. */
const LIST_TOP = 1423;
const CARD_HEIGHT = 515;
const CARD_GAP = 50;
/** Gap between the last card's bottom edge and the QR. */
const QR_GAP = 30;
/** The kiosk artboard. Nothing may be drawn below it — the frame clips. */
const ARTBOARD_HEIGHT = 3840;
/** QR frame side, and the round day arrow's, so the low-reach pair can centre on that row. */
const QR_SIZE = 150;
const ARROW_SIZE = 85;
// The horizontal anchor is CSS-side: .qrRow uses `right: 172px`, which is
// 2160 − (the cards' right edge at 1988), so the QR's right edge sits on the
// cards'. Keep the two in step if the list geometry moves.

/**
 * Top of the QR row for `n` spot cards, never past the artboard.
 *
 * The floor of the clamp is where the QR's own bottom edge meets 3840 — this
 * page draws no banner, so that is the last usable row. Four cards land on the
 * design's own 3663 and the clamp is inert; nine cards would put it at 3843,
 * three past the edge and clipped, so it settles on 3690 just under the list's
 * scrolling viewport (which ends at 3663) instead.
 */
const qrTopFor = (n: number): number =>
  Math.min(
    LIST_TOP + n * CARD_HEIGHT + Math.max(0, n - 1) * CARD_GAP + QR_GAP,
    ARTBOARD_HEIGHT - QR_SIZE,
  );

/**
 * Top of the low-reach day pager: vertically centred on the QR row, which is
 * where Figma 6418:11330 draws it (measured y3695 against a QR row at y3663).
 */
const bottomPagerTopFor = (n: number): number => qrTopFor(n) + (QR_SIZE - ARROW_SIZE) / 2;

/**
 * One round day-pager button — an 85px disc with a white chevron, #ff7f0f while
 * the day exists and #999 once it does not. Shared by the pager beside the DAY
 * label and the low-reach one at the foot of the page so the two can't drift.
 */
function DayArrow({
  dir,
  disabled,
  onClick,
  className,
  style,
  lang,
}: {
  dir: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
  /** Optional because CSS Module lookups are typed `string | undefined` here. */
  className?: string;
  style?: CSSProperties;
  lang: Lang;
}): JSX.Element {
  return (
    <button
      type="button"
      className={`${styles.dayArrow} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
      aria-label={dir === 'prev' ? pick(T.arrowPrev, lang) : pick(T.arrowNext, lang)}
    >
      <svg className={styles.dayArrowIcon} viewBox="0 0 85 85" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="42.5" cy="42.5" r="42.5" fill={disabled ? '#999999' : '#FF7F0F'} />
        <path
          d={dir === 'prev' ? 'M48.5 25.5 L32 42.5 L48.5 59.5' : 'M36.5 25.5 L53 42.5 L36.5 59.5'}
          fill="none"
          stroke="#fff"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

const T = {
  arrowPrev: {
    ko: '이전', en: 'Previous', ja: '前へ', zh: '上一页',
    vi: 'Trước', th: 'ก่อนหน้า', ru: 'Назад', id: 'Sebelumnya',
  },
  arrowNext: {
    ko: '다음', en: 'Next', ja: '次へ', zh: '下一页',
    vi: 'Tiếp', th: 'ถัดไป', ru: 'Далее', id: 'Berikutnya',
  },
  empty: {
    ko: '코스에 담을 장소를 찾지 못했어요.\n관심사를 바꿔 다시 검색해보세요.',
    en: 'No places found for this course.\nTry different interests.',
    ja: 'コースに入る場所が見つかりませんでした。\n興味を変えて再検索してください。',
    zh: '未找到可加入路线的地点。\n请更换兴趣后重试。',
    vi: 'Không tìm thấy địa điểm cho lộ trình này.\nHãy thử sở thích khác.',
    th: 'ไม่พบสถานที่สำหรับเส้นทางนี้\nลองเปลี่ยนความสนใจดู',
    ru: 'Места для маршрута не найдены.\nПопробуйте другие интересы.',
    id: 'Tidak ada tempat untuk rute ini.\nCoba minat yang lain.',
  },
  /** Label beside the QR under the last spot card. No sheet key exists for it
   *  (Localization_Jeju has no 모바일 row), so it is authored here in all eight
   *  languages — the pattern this file already uses for `empty`. */
  viewOnMobile: {
    ko: '모바일에서 확인하기',
    en: 'View on your phone',
    ja: 'スマホで確認する',
    zh: '在手机上查看',
    vi: 'Xem trên điện thoại',
    th: 'ดูบนมือถือ',
    ru: 'Открыть на телефоне',
    id: 'Lihat di ponsel',
  },
};

interface CourseMeta {
  /** Rail letter used in the header subtitle — "A코스 - 1일차". */
  label: string;
  title: Partial<Record<Lang, string>>;
  tags: Partial<Record<Lang, string>>;
  desc: Partial<Record<Lang, string>>;
  /**
   * OFFLINE FALLBACK ONLY. These are the authored placeholders this page used
   * to show unconditionally; `POST /api/jeju/courses/recommend` now supplies
   * the real 소요시간 / 이동시간 / 난이도 and the per-spot values, and these are
   * reached only when that call fails. They stay because a kiosk that cannot
   * reach the network still has to draw a course — but nothing on the API path
   * may read them, or the bar would mix a real number with an invented one.
   */
  duration: Partial<Record<Lang, string>>;
  distance: Partial<Record<Lang, string>>;
  difficulty: string;
  /** Per-spot placeholders, same caveat. */
  spotDuration: Partial<Record<Lang, string>>;
  spotDifficulty: string;
}

/**
 * Summary-bar labels and the two values that are words rather than numbers.
 *
 * ★ Translated here, in all eight languages (2026-08-27). Localization_Jeju has
 * `TotalStayTime` and nothing else for this bar — no row for 이동수단, 이동거리 or
 * 난이도 — so three of the four labels rendered Korean on a page the visitor
 * reaches through a fully localized questionnaire. Same reason SECTION in
 * JejuAiSearch is authored: the sheet simply has no row yet.
 *
 * The NUMBERS beside them (약 4~5시간, 약 18Km) are still Korean. They come from
 * COURSE_META, which is authored placeholder data for the no-API path, and from
 * `minutesLabel` in lib/jejuCourse — a shared helper with no `lang` parameter
 * that every layout calls. Localizing those is a separate change to that lib.
 */
const STAT_LABEL = {
  transport: {
    ko: '이동수단', en: 'Getting around', ja: '移動手段', zh: '交通方式',
    vi: 'Phương tiện', th: 'การเดินทาง', ru: 'Транспорт', id: 'Transportasi',
  },
  distance: {
    ko: '이동거리', en: 'Distance', ja: '移動距離', zh: '移动距离',
    vi: 'Quãng đường', th: 'ระยะทาง', ru: 'Расстояние', id: 'Jarak',
  },
  travel: {
    ko: '이동시간', en: 'Travel time', ja: '移動時間', zh: '移动时间',
    vi: 'Thời gian di chuyển', th: 'เวลาเดินทาง', ru: 'Время в пути', id: 'Waktu tempuh',
  },
  difficulty: {
    ko: '난이도', en: 'Difficulty', ja: '難易度', zh: '难度',
    vi: 'Độ khó', th: 'ระดับความยาก', ru: 'Сложность', id: 'Tingkat kesulitan',
  },
};

/** COURSE_META's authored 난이도 words, so the value localizes with its label. */
const DIFFICULTY_WORD: Record<string, Partial<Record<Lang, string>>> = {
  쉬움: {
    ko: '쉬움', en: 'Easy', ja: 'やさしい', zh: '简单',
    vi: 'Dễ', th: 'ง่าย', ru: 'Лёгкий', id: 'Mudah',
  },
  보통: {
    ko: '보통', en: 'Moderate', ja: 'ふつう', zh: '普通',
    vi: 'Trung bình', th: 'ปานกลาง', ru: 'Средний', id: 'Sedang',
  },
  어려움: {
    ko: '어려움', en: 'Hard', ja: 'むずかしい', zh: '困难',
    vi: 'Khó', th: 'ยาก', ru: 'Сложный', id: 'Sulit',
  },
};

/** The visitor's 이동수단 answer, localized — same path as the pick chips. */
const transportLabel = (ko: string, lang: Lang): string => localizeJejuAiPick(ko, lang);

const COURSE_META: Record<string, CourseMeta> = {
  nature: {
    label: 'A',
    title: {
      ko: '자연·유산 탐방 코스', en: 'Nature & Heritage', ja: '自然・遺産探訪コース',
      zh: '自然·遗产探访路线', vi: 'Thiên nhiên & Di sản',
      th: 'เส้นทางธรรมชาติและมรดก', ru: 'Природа и наследие', id: 'Alam & Warisan',
    },
    tags: {
      ko: '#자연 #유산 #힐링', en: '#Nature #Heritage #Healing', ja: '#自然 #遺産 #ヒーリング',
      zh: '#自然 #遗产 #疗愈', vi: '#Thiênnhiên #Disản #Thưgiãn',
      th: '#ธรรมชาติ #มรดก #ผ่อนคลาย', ru: '#Природа #Наследие #Отдых',
      id: '#Alam #Warisan #Relaksasi',
    },
    desc: {
      ko: '제주의 아름다운 자연 경관과 역사·문화·유산을 함께 만날 수 있는 코스입니다.\n탁 트인 바다와 오름, 전통 마을을 천천히 둘러보며 여유로운 시간을 즐겨보세요.',
      en: "A course that brings together Jeju's scenery and its history and heritage.\nTake your time along the open sea, the oreum and the old villages.",
      ja: '済州の美しい自然と歴史・文化・遺産を一緒に楽しめるコースです。\n開けた海とオルム、伝統的な村をゆっくり巡ってみてください。',
      zh: '这是一条可以同时领略济州自然风光与历史文化遗产的路线。\n请慢慢游览开阔的大海、오름和传统村落。',
      vi: 'Hành trình kết hợp cảnh quan thiên nhiên với lịch sử và di sản của Jeju.\nHãy thong thả dạo qua biển rộng, các oreum và những ngôi làng cổ.',
      th: 'เส้นทางที่รวมทัศนียภาพธรรมชาติเข้ากับประวัติศาสตร์และมรดกของเชจู\nค่อย ๆ เดินชมทะเลกว้าง โอรึม และหมู่บ้านโบราณ',
      ru: 'Маршрут, соединяющий природу Чеджу с его историей и наследием.\nНе спеша пройдите вдоль открытого моря, оремов и старых деревень.',
      id: 'Rute yang memadukan panorama alam dengan sejarah dan warisan Jeju.\nNikmati perlahan laut lepas, oreum, dan desa-desa tradisional.',
    },
    duration: {
      ko: '약 4~5시간', en: 'Approx. 4–5 hrs', ja: '約4〜5時間', zh: '约 4–5 小时',
      vi: 'Khoảng 4–5 giờ', th: 'ประมาณ 4–5 ชม.', ru: 'Около 4–5 ч', id: 'Sekitar 4–5 jam',
    },
    distance: {
      ko: '약 18Km', en: 'Approx. 18 km', ja: '約18km', zh: '约 18 公里',
      vi: 'Khoảng 18 km', th: 'ประมาณ 18 กม.', ru: 'Около 18 км', id: 'Sekitar 18 km',
    },
    difficulty: '쉬움',
    spotDuration: {
      ko: '2-3시간', en: '2–3 hrs', ja: '2〜3時間', zh: '2–3 小时',
      vi: '2–3 giờ', th: '2–3 ชม.', ru: '2–3 ч', id: '2–3 jam',
    },
    spotDifficulty: '쉬움',
  },
  food: {
    label: 'B',
    title: {
      ko: '맛집·감성 코스', en: 'Food & Vibes', ja: 'グルメ・雰囲気コース',
      zh: '美食·情调路线', vi: 'Ẩm thực & Cảm xúc',
      th: 'อาหารและบรรยากาศ', ru: 'Еда и атмосфера', id: 'Kuliner & Suasana',
    },
    tags: {
      ko: '#미식 #감성 #로컬', en: '#Food #Vibes #Local', ja: '#グルメ #雰囲気 #ローカル',
      zh: '#美食 #情调 #本地', vi: '#Ẩmthực #Cảmxúc #Địaphương',
      th: '#อาหาร #บรรยากาศ #ท้องถิ่น', ru: '#Еда #Атмосфера #Местное',
      id: '#Kuliner #Suasana #Lokal',
    },
    desc: {
      ko: '제주의 맛과 감성을 가득 담은 로컬 중심 코스입니다.\n현지인이 즐겨 찾는 맛집과 감성 공간을 천천히 둘러보세요.',
      en: "A local-first course full of Jeju's flavours and atmosphere.\nTake your time around the places islanders themselves go back to.",
      ja: '済州の味と雰囲気をたっぷり詰め込んだローカル中心のコースです。\n地元の人が通う名店と居心地のよい空間をゆっくり巡ってみてください。',
      zh: '这是一条充满济州味道与情调的本地路线。\n请慢慢探访当地人常去的美食店与惬意空间。',
      vi: 'Hành trình thiên về địa phương, đậm hương vị và cảm xúc Jeju.\nHãy thong thả ghé những quán ăn và không gian mà người bản địa yêu thích.',
      th: 'เส้นทางเน้นท้องถิ่นที่เต็มไปด้วยรสชาติและบรรยากาศของเชจู\nค่อย ๆ แวะร้านอาหารและพื้นที่ที่คนท้องถิ่นชื่นชอบ',
      ru: 'Маршрут для местных вкусов и атмосферы Чеджу.\nНе спеша загляните туда, куда возвращаются сами островитяне.',
      id: 'Rute berbasis lokal yang penuh cita rasa dan suasana Jeju.\nNikmati perlahan tempat makan dan ruang favorit warga setempat.',
    },
    duration: {
      ko: '약 4~5시간', en: 'Approx. 4–5 hrs', ja: '約4〜5時間', zh: '约 4–5 小时',
      vi: 'Khoảng 4–5 giờ', th: 'ประมาณ 4–5 ชม.', ru: 'Около 4–5 ч', id: 'Sekitar 4–5 jam',
    },
    distance: {
      ko: '약 15Km', en: 'Approx. 15 km', ja: '約15km', zh: '约 15 公里',
      vi: 'Khoảng 15 km', th: 'ประมาณ 15 กม.', ru: 'Около 15 км', id: 'Sekitar 15 km',
    },
    difficulty: '쉬움',
    spotDuration: {
      ko: '1-2시간', en: '1–2 hrs', ja: '1〜2時間', zh: '1–2 小时',
      vi: '1–2 giờ', th: '1–2 ชม.', ru: '1–2 ч', id: '1–2 jam',
    },
    spotDifficulty: '쉬움',
  },
  family: {
    label: 'C',
    title: {
      ko: '가족·체험 코스', en: 'Family & Activities', ja: '家族・体験コース',
      zh: '家庭·体验路线', vi: 'Gia đình & Trải nghiệm',
      th: 'ครอบครัวและกิจกรรม', ru: 'Семья и впечатления', id: 'Keluarga & Aktivitas',
    },
    tags: {
      ko: '#가족 #체험 #즐거움', en: '#Family #Experience #Fun', ja: '#家族 #体験 #楽しさ',
      zh: '#家庭 #体验 #欢乐', vi: '#Giađình #Trảinghiệm #Vuivẻ',
      th: '#ครอบครัว #กิจกรรม #สนุก', ru: '#Семья #Впечатления #Веселье',
      id: '#Keluarga #Pengalaman #Seru',
    },
    desc: {
      ko: '온 가족이 함께 즐길 수 있는 체험 중심 코스입니다.\n아이와 어른 모두 즐겁게 참여할 수 있는 장소로 구성했습니다.',
      en: 'A hands-on course the whole family can enjoy together.\nEvery stop is somewhere children and adults can join in.',
      ja: '家族みんなで楽しめる体験中心のコースです。\n子どもも大人も一緒に参加できる場所で構成しました。',
      zh: '这是一条全家人都能一起享受的体验路线。\n每个地点孩子与大人都能愉快参与。',
      vi: 'Hành trình trải nghiệm cả gia đình cùng tận hưởng.\nMỗi điểm dừng đều phù hợp cho cả trẻ em và người lớn.',
      th: 'เส้นทางเน้นกิจกรรมที่ทั้งครอบครัวสนุกร่วมกันได้\nทุกจุดแวะเหมาะกับทั้งเด็กและผู้ใหญ่',
      ru: 'Маршрут впечатлений для всей семьи.\nКаждая остановка подходит и детям, и взрослым.',
      id: 'Rute pengalaman yang bisa dinikmati seluruh keluarga.\nSetiap perhentian cocok untuk anak maupun orang dewasa.',
    },
    duration: {
      ko: '약 5~6시간', en: 'Approx. 5–6 hrs', ja: '約5〜6時間', zh: '约 5–6 小时',
      vi: 'Khoảng 5–6 giờ', th: 'ประมาณ 5–6 ชม.', ru: 'Около 5–6 ч', id: 'Sekitar 5–6 jam',
    },
    distance: {
      ko: '약 22Km', en: 'Approx. 22 km', ja: '約22km', zh: '约 22 公里',
      vi: 'Khoảng 22 km', th: 'ประมาณ 22 กม.', ru: 'Около 22 км', id: 'Sekitar 22 km',
    },
    difficulty: '보통',
    spotDuration: {
      ko: '2-3시간', en: '2–3 hrs', ja: '2〜3時間', zh: '2–3 小时',
      vi: '2–3 giờ', th: '2–3 ชม.', ru: '2–3 ч', id: '2–3 jam',
    },
    spotDifficulty: '쉬움',
  },
};

const catMatches = (shop: Shop, cat: string): boolean =>
  stripPrefix(shop.secondCategoryKr ?? '') === cat || stripPrefix(shop.aiCategoryKr ?? '') === cat;

/**
 * OFFLINE FALLBACK ONLY — the itinerary this page built before the API existed:
 * walk the chosen interests in order, take the first unused shop matching each,
 * cycle until the day is full, and top up with anything left so a thin
 * catalogue still yields a course.
 *
 * It knows nothing about travel time, opening hours, closing days or capacity,
 * which is precisely why the server took the job over. Reached only when the
 * recommendation call fails.
 */
function buildSpots(interests: string[], shops: Shop[], count: number): Shop[] {
  const out: Shop[] = [];
  const used = new Set<number>();
  const cats = interests.length ? interests : [''];

  for (let round = 0; out.length < count && round < count; round += 1) {
    for (const cat of cats) {
      if (out.length >= count) break;
      const hit = shops.find((s) => !used.has(s.id) && (cat === '' || catMatches(s, cat)));
      if (hit) {
        used.add(hit.id);
        out.push(hit);
      }
    }
    // No interest matched anything new this round — top up with whatever is left.
    if (out.length === 0 || round === count - 1) {
      for (const s of shops) {
        if (out.length >= count) break;
        if (!used.has(s.id)) {
          used.add(s.id);
          out.push(s);
        }
      }
    }
  }
  return out;
}

/** One drawn stop: the catalogue row, plus the server's schedule for it. */
interface Stop {
  shop: Shop;
  /** Null on the offline fallback, where there is no schedule to attach. */
  spot: JejuCourseSpot | null;
  /**
   * The disc number — the stop's position within its DAY, not within its page.
   * Page two of day one therefore reads 5·6·7·8, which is the whole point: the
   * numbers name the itinerary, and paging is only how it is shown.
   */
  number: number;
}

/** One screenful: four cards at most, all belonging to the same day. */
interface Page {
  day: number;
  stops: Stop[];
}

export function JejuAiDetail({ controller }: Props): JSX.Element {
  const courseKey = useAiStore((s) => s.course);
  const interests = useAiStore((s) => s.interests);
  const transport = useAiStore((s) => s.transport);
  const stay = useAiStore((s) => s.stay);
  const visitors = useAiStore((s) => s.visitors);
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const lang = useLanguageStore((s) => s.currentLanguage) as Lang;
  /**
   * The two labels this page repeats — from Localization_Jeju, which carries
   * both in all eight languages and was going unread. They were authored Korean,
   * so an English visitor read "총 소요시간" and "1일차" on an otherwise
   * translated page. The authored words stay as the fallback.
   *
   * `dayLapsed` is a SUFFIX ("일차"), and it is appended in every language
   * because that is how the sheet stores it — one word, not a pattern with a
   * slot. English therefore reads "1 Day"; putting the number elsewhere would
   * need a placeholder the sheet does not have.
   */
  const totalTimeLabel = sheetText('TotalStayTime', lang, { ko: '총 소요시간' });

  const meta = COURSE_META[courseKey] ?? COURSE_META.nature!;
  /** Index into `pages`, not a day number — a day can span several pages. */
  const [pageIndex, setPageIndex] = useState(0);
  const lowReach = useAccessibilityStore((s) => s.lowReach);

  /**
   * Adds the ♿ row-top override to a class, and nothing otherwise.
   *
   * The standard frame is the 2026-08-26 re-stack (6516:73138) and the ♿ frame
   * (6418:11330) is still on the layout before it, so seven rows sit at two
   * different heights. See the *Low block at the foot of the stylesheet.
   */
  /* Both params are `string | undefined` because that is how CSS Module lookups
     are typed here — see DayArrow's `className` for the same. */
  const low = (base?: string, lowClass?: string): string =>
    [base, lowReach ? lowClass : ''].filter(Boolean).join(' ');

  /** The questionnaire, echoed under the summary bar — see the row in the JSX. */
  const picks = useMemo(
    () => [visitors, stay, transport, ...interests].filter(Boolean),
    [visitors, stay, transport, interests],
  );
  const pickLabels = useMemo(
    () => picks.map((p) => localizeJejuAiPick(p, lang)),
    [picks, lang],
  );

  /** The scheduled course, or null while it loads and after a failed call. */
  const [course, setCourse] = useState<JejuCourse | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * One request per visit, built from the questionnaire the visitor just filled
   * in. Every answer travels: the course letter picked on JejuAiResult, the
   * 이동수단 and party size and 박수 from the chips, the 즐길 거리 tiles as the
   * catalogue's own `aiCategoryKr` values, and today's date so the server can
   * drop closing days and non-market days for the 5일장.
   *
   * `excludeShops` is deliberately not sent: it is the re-recommendation lever
   * and there is no 다시 추천 control on this screen to pull it. The service and
   * the contract carry it, so wiring a button later is the button and nothing
   * else.
   */
  useEffect(() => {
    // The catalogue is needed twice over — to recover each interest's prefix,
    // and to resolve the shopIds that come back — so there is nothing to ask
    // for until it lands. It loads at app start, so this is a brief window.
    if (shops.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void window.api.jejuCourse
      .recommend({
        course: courseLetter(courseKey),
        transport: transportCode(transport),
        party: partySize(visitors),
        nights: nightCount(stay),
        interests: interestCodes(interests, shops),
        visitDate: todayIso(),
      })
      .then((res) => {
        if (cancelled) return;
        // A failure is not an error state here: `course` stays null and the
        // offline itinerary below draws instead, which is what a kiosk with no
        // network has to fall back on anyway.
        setCourse(isOk(res) ? res.value : null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseKey, transport, visitors, stay, interests, shops]);

  /** Days the OFFLINE fallback runs for, from the 체류 기간 answer. */
  const fallbackDays = DAYS_BY_STAY[stay] ?? 1;

  const shopById = useMemo(() => new Map(shops.map((shop) => [shop.id, shop])), [shops]);

  // Offline only. Built for the whole trip and sliced per day so a spot never
  // appears twice; cheap enough not to gate on `course`.
  const fallbackSpots = useMemo(
    () => buildSpots(interests, shops, SPOTS_PER_PAGE * fallbackDays),
    [interests, shops, fallbackDays],
  );

  /**
   * The whole itinerary, cut into pages the arrows walk.
   *
   * A scheduled spot whose `shopId` is not in the catalogue is dropped rather
   * than drawn as an empty card — the whole card is built from that row. In
   * practice every id resolves (13/13 checked 2026-08-25 against
   * `/api/shops?kioskId=6`); this is the guard for a catalogue that has not
   * caught up with a newly-added place. A day left with no drawable stop still
   * contributes ONE page, so the pager cannot skip a day silently.
   */
  const pages: Page[] = useMemo(() => {
    const out: Page[] = [];

    if (course) {
      for (const scheduled of course.schedule) {
        const stops = scheduled.spots
          .map((spot): Stop | null => {
            const shop = shopById.get(spot.shopId);
            return shop ? { shop, spot, number: spot.order } : null;
          })
          .filter((stop): stop is Stop => stop !== null);
        if (stops.length === 0) {
          out.push({ day: scheduled.day, stops: [] });
          continue;
        }
        for (let i = 0; i < stops.length; i += SPOTS_PER_PAGE) {
          out.push({ day: scheduled.day, stops: stops.slice(i, i + SPOTS_PER_PAGE) });
        }
      }
      return out;
    }

    // Offline: exactly one page per day, which is what this page always drew.
    for (let d = 1; d <= fallbackDays; d += 1) {
      out.push({
        day: d,
        stops: fallbackSpots
          .slice((d - 1) * SPOTS_PER_PAGE, d * SPOTS_PER_PAGE)
          .map((shop, i) => ({ shop, spot: null, number: i + 1 })),
      });
    }
    return out;
  }, [course, shopById, fallbackSpots, fallbackDays]);

  useEffect(() => {
    // A shorter run than the page being viewed (a re-request, or the catalogue
    // arriving late) must not leave the pager past the end.
    setPageIndex((i) => Math.max(0, Math.min(i, pages.length - 1)));
  }, [pages]);

  const page = pages[pageIndex];
  const stops = page?.stops ?? [];
  /** The day the visible page belongs to — what the DAY label and header show. */
  const day = page?.day ?? 1;
  /** The header's course+day line, e.g. "A코스 - 1일차". */
  const courseDayTitle = jejuCourseDayTitle(meta.label, day, lang);

  const goPrevPage = useCallback(() => setPageIndex((i) => Math.max(0, i - 1)), []);
  const goNextPage = useCallback(
    () => setPageIndex((i) => Math.min(pages.length - 1, i + 1)),
    [pages.length],
  );

  /**
   * Destination for the 모바일에서 확인하기 QR.
   *
   * TODO(제주 W006): there is no per-course mobile page anywhere in this project,
   * so nothing exists that "the course on your phone" could point at. Until one
   * does, this scans to the FIRST spot of the day — which matches what the sheet
   * promises for this screen (SubHeader_AICourse: "QR을 핸드폰으로 찍으시면 길을
   * 안내해드려요"). Point it at the real course URL the moment there is one.
   *
   * `naverLink` is the same field JejuSpotDetailCard scans, and it is validated
   * the same way: rows carry blanks and occasional non-URLs.
   */
  const firstLink = stops[0]?.shop.naverLink ?? '';
  const qrLink = /^https?:\/\//i.test(firstLink) ? firstLink : null;

  /**
   * Every stop of the VISIBLE DAY, in itinerary order.
   *
   * Paging is a display device — a day that does not fit in the list's 2240px
   * viewport spills onto further pages — so anything that follows the itinerary
   * rather than the screen has to walk this, not `stops`.
   */
  const dayStops = useMemo(
    () => pages.filter((p) => p.day === day).flatMap((p) => p.stops),
    [pages, day],
  );

  /** How long the visitor spends here: the schedule's, or the authored placeholder offline. */
  const dwellOf = (stop: Stop): string =>
    stop.spot ? minutesLabel(stop.spot.dwellMinutes, lang) : pick(meta.spotDuration, lang);

  /**
   * "난이도 X". An ungraded SCHEDULED spot draws no row rather than a wrong one —
   * `difficulty: 0` is the normalizer's "the server gave none". Offline there is
   * no schedule to grade, so the authored placeholder stands in.
   */
  const hardnessOf = (stop: Stop): string => {
    const grade = stop.spot ? difficultyLabel(stop.spot.difficulty) : meta.spotDifficulty;
    if (!grade) return '';
    // Was the Korean literal `난이도 ${grade}` — built from the same two tables
    // the summary bar uses, so the word and its label localize together.
    return `${pick(STAT_LABEL.difficulty, lang)} ${pick(DIFFICULTY_WORD[grade] ?? { ko: grade }, lang)}`;
  };

  /** Falls back to the shared no-image placeholder, like the list and detail cards. */
  const photoOf = (stop: Stop): string => shopImages(stop.shop)[0] ?? jejuIconUrl('noimage') ?? '';

  /**
   * The DetailItem for `dayStops[i]`, with the stop AFTER it attached as
   * `courseNext` — which is what JejuDetail draws as the 다음 장소 card under the
   * 상세 plate (Figma 6289:58438 / 6516:72906). Recursive, so that card opens a
   * detail carrying the one after it and a visitor can walk the whole day
   * without returning here.
   *
   * Scoped to the DAY, deliberately: the detail's header subtitle is
   * "A코스 - 1일차", so a card that quietly crossed into the next day would be
   * captioned with the wrong one. The last stop of a day simply has no card.
   *
   * Built on demand rather than memoised — the depth is the day's spot count
   * (nine at the worst observed) and it runs once per tap.
   */
  const detailFor = (i: number): DetailItem | undefined => {
    const stop = dayStops[i];
    if (!stop) return undefined;
    const { shop, spot } = stop;
    const nextStop = dayStops[i + 1];
    const nextItem = detailFor(i + 1);
    return {
      from: 'ai_detail',
      // JejuDetail shows this as the header SUBTITLE for AI-course spots, so it
      // carries the course + day rather than a generic label.
      title: courseDayTitle,
      name: shopName(shop, lang),
      category: shopSecondCategory(shop, lang),
      photos: shopImages(shop),
      address: shopAddress(shop, lang),
      /*
       * `openTimeText` is the server's display-ready hours, and NULL there is a
       * statement: it means the hours it holds for this shop are an estimate,
       * and the contract is to show none rather than a guess. So it is not
       * backfilled from `shop.openTime` — only the offline path, which never
       * had the server's answer to begin with, reads that.
       */
      hours: spot ? (spot.openTimeText ?? '') : (shop.openTime ?? ''),
      phone: shop.tel ?? '',
      description: shopDescription(shop, lang),
      tags: shopHashtag(shop, lang),
      rating: shop.naverRating != null ? String(shop.naverRating) : '',
      instagram: '',
      blogReviews: shop.naverLink ?? '',
      ...(nextStop && nextItem
        ? { courseNext: { dwell: dwellOf(nextStop), difficulty: hardnessOf(nextStop), item: nextItem } }
        : {}),
    };
  };

  const openSpot = (stop: Stop): void => {
    // Identity lookup, not an index: `pages` holds one Stop object per stop and
    // `dayStops` re-lists those same objects, so the tapped card is found even
    // though the visible page is only a slice of the day.
    const item = detailFor(dayStops.indexOf(stop));
    if (!item) return;
    setDetail(item);
    controller.navigate('detail', '코스 상세');
  };

  /**
   * The summary bar. Four slots either way, and the two paths never mix:
   * scheduled → every number is the server's, offline → every number is the
   * authored placeholder. 이동수단 is the visitor's own answer on both.
   *
   * The third slot is where the paths differ by name as well as value: the API
   * returns travel MINUTES and no distance at all, so it reads 이동시간 there
   * and keeps the design's 이동거리 only on the authored path. Totals are for
   * the whole course, not the visible day — the DAY pager sits below the bar.
   */
  const stats: Array<{ label: string; value: string }> = useMemo(() => {
    const chosenTransport = transportLabel(transport || '자동차', lang);
    if (!course) {
      return [
        { label: totalTimeLabel, value: pick(meta.duration, lang) },
        { label: pick(STAT_LABEL.transport, lang), value: chosenTransport },
        { label: pick(STAT_LABEL.distance, lang), value: pick(meta.distance, lang) },
        {
          label: pick(STAT_LABEL.difficulty, lang),
          value: pick(DIFFICULTY_WORD[meta.difficulty] ?? { ko: meta.difficulty }, lang),
        },
      ];
    }
    const travel = course.schedule.reduce(
      (total, d) => total + d.spots.reduce((n, spot) => n + spot.travelMinutes, 0),
      0,
    );
    return [
      { label: totalTimeLabel, value: aboutMinutesLabel(course.totalMinutes, lang) },
      { label: pick(STAT_LABEL.transport, lang), value: chosenTransport },
      { label: pick(STAT_LABEL.travel, lang), value: minutesLabel(travel, lang) },
      {
        label: pick(STAT_LABEL.difficulty, lang),
        value: (() => {
          const word = difficultyLabel(course.difficulty) || meta.difficulty;
          return pick(DIFFICULTY_WORD[word] ?? { ko: word }, lang);
        })(),
      },
    ];
  }, [course, transport, meta, totalTimeLabel, lang]);

  return (
    <JejuPageFrame
      controller={controller}
      title="'제주' 뭐하지 (AI 검색)"
      subtitle={courseDayTitle}
      subtitleColor="#616161"
      bannerFallback="banner-detail"
      showBanner={false}
      onBack={() => controller.navigate('ai_result', '뒤로')}
    >
      <p className={styles.title}>{pick(meta.title, lang)}</p>
      <div className={styles.rule} />
      <p className={low(styles.tags, styles.tagsLow)}>{pick(meta.tags, lang)}</p>
      <p className={low(styles.desc, styles.descLow)}>{pick(meta.desc, lang)}</p>

      <div className={low(styles.summary, styles.summaryLow)}>
        {stats.map((s, i) => (
          <Fragment key={s.label}>
            {i > 0 && <span className={styles.statSep} />}
            <span className={styles.stat}>
              <span className={styles.statLabel}>{s.label}</span>
              <span className={styles.statValue}>{s.value}</span>
            </span>
          </Fragment>
        ))}
      </div>

      {/* The questionnaire echoed back, between the summary bar and the DAY row
          (6516:73323). Standard frame only — the ♿ frame has no such row. Every
          value is stored KOREAN (see JejuAiSearch's submit), which is how the
          frame draws them; empty slots (deep-link, idle reset) drop out. */}
      {!lowReach && picks.length > 0 && (
        <div className={styles.picks}>
          {pickLabels.map((label, i) => (
            <span key={i} className={styles.pick}>{label}</span>
          ))}
        </div>
      )}

      {/* The pager. Always drawn — greyed at the ends, exactly as the Figma
          shows the left one on the first screen — so the row never reflows.
          It steps a PAGE at a time, which is a day boundary only when the day
          fits on one page; see `pages`. */}
      <DayArrow
        dir="prev"
        disabled={pageIndex <= 0}
        onClick={goPrevPage}
        className={low(styles.dayPrev, styles.dayArrowLow)}
        lang={lang}
      />

      <p className={low(styles.day, styles.dayLow)}>DAY {day}</p>

      <DayArrow
        dir="next"
        disabled={pageIndex >= pages.length - 1}
        onClick={goNextPage}
        className={low(styles.dayNext, styles.dayArrowLow)}
        lang={lang}
      />

      {/* Nothing at all while the schedule is in flight: the empty copy tells
          the visitor to change their interests, which would be wrong advice for
          a course that is simply still arriving. */}
      {loading ? null : stops.length === 0 ? (
        <p className={styles.empty}>{pick(T.empty, lang)}</p>
      ) : (
        <>
          <div className={low(styles.rail, styles.railLow)} />

          {/* ── The itinerary ──
              Each numbered disc rides INSIDE the row with its own card rather
              than being pinned to the page at a computed y. It had to move: the
              four discs the design draws were fixed to the list's first four
              rows, which was exact while this page built its own four-spot day
              and wrong the moment a day could span pages — page two opens on
              stops 5·6·7·8, and a disc nailed to row one can only ever say 1.
              Flex centring reproduces the design's own offset exactly: a 105
              disc centred on a 515 card is the 1628 against a list top of 1423
              that the old STOP_TOP encoded. */}
          <div className={low(styles.list, styles.listLow)}>
            {stops.map((stop, i) => (
              <div key={`${i}-${stop.shop.id}`} className={styles.stopRow}>
                <span className={styles.stop}>{stop.number}</span>
                {/* 1678, not the detail screen's 1793: the numbered disc and its
                    35px gap take the first 140px of the list's 1818 gutter. */}
                <JejuCourseSpotCard
                  width={1678}
                  photo={photoOf(stop)}
                  name={shopName(stop.shop, lang)}
                  category={shopSecondCategory(stop.shop, lang)}
                  address={shopAddress(stop.shop, lang)}
                  description={shopDescription(stop.shop, lang)}
                  dwell={dwellOf(stop)}
                  difficulty={hardnessOf(stop)}
                  onClick={() => openSpot(stop)}
                />
              </div>
            ))}
          </div>

          {/* 모바일에서 확인하기 — label left, QR right, the QR's right edge flush
              with the cards' right edge and 30px below the last card.
              Rendered only when there is a real destination: a QR that scans to
              nothing is worse than no QR, which is how JejuSpotDetailCard treats
              its own. See `qrLink`. */}
          {qrLink && (
            <div
              className={styles.qrRow}
              /* Standard: a fixed y1395 on the DAY row, set in the CSS. ♿ still
                 hangs it off the last card, so only that layout computes a top. */
              style={lowReach ? { top: qrTopFor(stops.length) } : undefined}
            >
              <span className={styles.qrLabel}>{pick(T.viewOnMobile, lang)}</span>
              <span className={styles.qrFrame}>
                <QRCodeSVG className={styles.qrCode} value={qrLink} bgColor="#ffffff" fgColor="#000000" level="M" />
              </span>
            </div>
          )}

          {/* Low-reach day pager — the same two buttons repeated at the foot of
              the page. Only for the ♿ layout: this page cannot be shifted down
              the way JejuLanguage is (its list already runs to y3663), so the
              reachable control is duplicated rather than moved. Multi-day
              courses only; on a one-day course both ends are dead. */}
          {lowReach && pages.length > 1 && (
            <>
              <DayArrow
                dir="prev"
                disabled={pageIndex <= 0}
                onClick={goPrevPage}
                className={styles.dayPrevBottom}
                style={{ top: bottomPagerTopFor(stops.length) }}
                lang={lang}
              />
              <DayArrow
                dir="next"
                disabled={pageIndex >= pages.length - 1}
                onClick={goNextPage}
                className={styles.dayNextBottom}
                style={{ top: bottomPagerTopFor(stops.length) }}
                lang={lang}
              />
            </>
          )}
        </>
      )}
    </JejuPageFrame>
  );
}
