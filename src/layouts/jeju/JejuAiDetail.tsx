/**
 * 제주 AI 코스 상세 — Figma node 6760:18772 (제주>제주모하지(AI검색)-04-1), the
 * 2026-09-07 re-stack of 6516:73138 (-03-1). See the stylesheet header for the
 * coordinates; what is new rather than moved is the header QR, the
 * 전체보기 / 선택보기 filter beside the DAY row, and the labelled per-stop stats
 * ("머무는 시간 : 2-3시간" rather than a bare "2-3시간"). What is GONE is the
 * course description that sat between the hashtags and the summary bar — the
 * frame runs the one straight into the other, so `CourseMeta.desc` is authored
 * and carried but no longer drawn.
 *
 * ── The 2026-09-10 redraw (7038:18453, also named -04-1) ────────────────
 * The DAY row and 전체보기 / 선택보기 moved up, the answer pills moved under
 * them onto the card column, and the summary bar reads 총 소요시간 · 이동거리 ·
 * 방문 인원/ 일정 · 이동수단 (see `stats`). The itinerary grew a second card: a
 * stop the visitor did not pick draws as the compact 289px "추천 코스" card
 * (see `isPicked`). On the AI 맞춤 route the header now names the course the
 * way the landing card does — "AI 맞춤 추천 코스 - 1일차", in Bold.
 *
 * ── The 2026-09-11 redraw (7058:21462 선택보기 · 7128:72710 전체보기) ─────
 * Three additions, nothing moved: a travel-time pill ("15분") on the rail
 * between each pair of discs (see `legs`); the compact "추천 코스" card grew to
 * 311 with a 펼치기 pill that opens it into the full plate — the pill beside the
 * name, 접기 in the stats row (see `expanded`); and the full plate's address and
 * stats went Bold. The AI 맞춤 route's header reads "커스텀 코스 - 1일차" now,
 * matching the landing card (AI_COURSE_NAME).
 *
 * Shows the course a questionnaire sent — a themed card's own course, or the
 * AI 맞춤 course whose letter JejuAiSearch derives from the picks (the A/B/C
 * chooser that used to pick it is out of the flow since 2026-09-11): its
 * title/hashtags, a summary bar, and the numbered spot itinerary.
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
 * ── The arrows switch DAYS; the list scrolls within a day ─────────────
 * Every stop scheduled for the visible day is drawn in one list. When a day
 * holds more cards than fit below the DAY row, the list scrolls — the ← →
 * pair only moves between days, never between pages of the same day.
 *
 * ★ One deliberate difference from the design on the API path: the summary's
 * third stat reads 이동시간 (real, summed `travelMinutes`) rather than the
 * design's 이동거리, because the endpoint returns no distance at all and an
 * authored "약 18Km" beside three real numbers is worse than an honest fourth.
 * The fallback path keeps 이동거리, where it is authored alongside the rest.
 */
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  pickerPlanToCourse,
  jejuCourseNameWithDay,
  minutesLabel,
  aboutMinutesLabel,
  nightCount,
  partySize,
  regionCode,
  todayIso,
  transportCode,
} from '@renderer/lib/jejuCourse';
import { localizeJejuAiPick } from '@renderer/lib/jejuAiPicksLabel';
import { buildAiCourseSaveUrlForQr } from '@renderer/lib/aiCourseSave';
import { JejuPageFrame } from './JejuPageFrame';
import { JejuCourseSpotCard } from './JejuCourseSpotCard';
import styles from './JejuAiDetail.module.css';
import { belowModeBar } from './lowReach';

interface Props {
  controller: KioskController;
}

/**
 * Offline fallback: up to this many spots drawn per day when the API is down.
 * The live schedule is not capped here — every spot the server returns for the
 * day lands in the scrollable list.
 */
const OFFLINE_SPOTS_PER_DAY = 4;

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

/** Row heights: the full 515 plate, and the compact "추천 코스" card (311 since
 *  7128:72710). Both are MINIMUMS now (a wrapped name or address grows a card),
 *  so these only stand in for the rail until the rows have been measured. */
/* 453 since 7229:100396 (7058:21462, 2026-09-15); was 515. */
const CARD_HEIGHT = 453;
const COMPACT_HEIGHT = 311;
/** The start-point row's plate (7181:18214), DAY 1 only. */
const START_HEIGHT = 172;
const CARD_GAP = 50;

/**
 * OFFLINE FALLBACK ONLY — the "15분" the frames draw between stops, for the
 * no-API path that has no schedule to time. Same standing as COURSE_META's
 * per-spot placeholders: the API path reads each stop's own `travelMinutes`.
 */
const OFFLINE_TRAVEL_MINUTES = 15;

/**
 * Each numbered disc's centre, measured from the list's top. A disc is centred
 * on its own card, so the next one is half this row, the gap and half the next
 * row further down.
 */
const discCenters = (heights: number[]): number[] => {
  const centers: number[] = [];
  heights.forEach((h, i) => {
    centers.push(i === 0 ? h / 2 : centers[i - 1]! + heights[i - 1]! / 2 + CARD_GAP + h / 2);
  });
  return centers;
};

/**
 * The dashed rail, from the first numbered disc's centre to the last one's.
 *
 * Measured off the ACTUAL rows now that two card heights share the list — the
 * old `(n - 1) × 565` assumed every row was a full plate and overshot past the
 * last disc whenever a compact card sat in the day.
 */
const railFor = (heights: number[]): { top: number; height: number } => {
  if (heights.length <= 1) return { top: 0, height: 0 };
  const centers = discCenters(heights);
  return { top: centers[0]!, height: centers[centers.length - 1]! - centers[0]! };
};

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

/**
 * What the header calls the AI 맞춤 route's course — "AI 맞춤 추천 코스 - 1일차",
 * as 7058:21462 draws it (the 2026-09-14 hand-off names that frame as THE
 * 커스텀 코스 detail; 7128:72710's "커스텀 코스" is superseded). The landing card
 * keeps its own 커스텀 코스 title (JejuAiSearch's AI_CARD).
 */
const AI_COURSE_NAME = {
  ko: 'AI 맞춤 추천 코스', en: 'AI Custom Course', ja: 'AIおすすめコース', zh: 'AI定制推荐路线',
  vi: 'Lộ trình gợi ý AI', th: 'เส้นทางแนะนำโดย AI', ru: 'Маршрут от ИИ', id: 'Rute Rekomendasi AI',
};

/**
 * The itinerary's first row (7181:18213) — where DAY 1 sets off: this kiosk.
 * The courses are built from the kiosk's own coordinates (JejuAiSearch's
 * PICK_NOTE_BY_KIOSK says the same in words), so W006 reads 제주국제공항, W007
 * its ferry terminal and W008 the heritage center. An id not listed keeps the
 * frame's airport.
 *
 * Korean draws the frame's "제주국제공항(Jeju International Airport)"; the other
 * languages draw their own name alone — a Korean name in brackets helps nobody
 * reading Thai.
 */
const START_PLACE: Record<string, Partial<Record<Lang, string>>> = {
  W006: {
    ko: '제주국제공항', en: 'Jeju International Airport', ja: '済州国際空港', zh: '济州国际机场',
    vi: 'Sân bay Quốc tế Jeju', th: 'ท่าอากาศยานนานาชาติเชจู', ru: 'Международный аэропорт Чеджу',
    id: 'Bandara Internasional Jeju',
  },
  W007: {
    ko: '제주국제여객터미널', en: 'Jeju International Ferry Terminal', ja: '済州国際旅客ターミナル',
    zh: '济州国际客运码头', vi: 'Bến tàu khách quốc tế Jeju', th: 'ท่าเรือโดยสารระหว่างประเทศเชจู',
    ru: 'Международный пассажирский терминал Чеджу', id: 'Terminal Penumpang Internasional Jeju',
  },
  W008: {
    ko: '세계자연유산본부', en: 'World Natural Heritage Center', ja: '世界自然遺産本部',
    zh: '世界自然遗产本部', vi: 'Trụ sở Di sản Thiên nhiên Thế giới', th: 'สำนักงานมรดกโลกทางธรรมชาติ',
    ru: 'Центр всемирного природного наследия', id: 'Kantor Warisan Alam Dunia',
  },
};

const startPlaceLabel = (kioskId: string, lang: Lang): string => {
  const names = START_PLACE[kioskId] ?? START_PLACE.W006!;
  return lang === 'ko' ? `${names.ko}(${names.en})` : pick(names, lang);
};

/**
 * The themed courses' own Localization_Jeju rows: each is named (ACourseDesc2
 * "자연·유산 탐방 코스") and tagged (ACourseTags "#자연 #유산 #힐링") there. The
 * sheet is the source; COURSE_META's copy only fills a cell it leaves empty.
 * 쇼핑·로컬 has no row — the API has no D course — so it stays authored, as does
 * the AI 맞춤 route's name (AI_COURSE_NAME).
 */
const COURSE_SHEET_LETTER: Partial<Record<string, 'A' | 'B' | 'C'>> = {
  nature: 'A',
  food: 'B',
  family: 'C',
};

const courseSheetText = (
  courseKey: string,
  field: 'Desc2' | 'Tags',
  lang: Lang,
  authored: Partial<Record<Lang, string>>,
): string => {
  const letter = COURSE_SHEET_LETTER[courseKey];
  return letter ? sheetText(`${letter}Course${field}`, lang, authored) : pick(authored, lang);
};

const T = {
  /**
   * The compact card's pill (7038:18453) — a stop the recommender added rather
   * than one the visitor picked. Short on purpose in every language: the pill
   * is a fixed 214px at 50px type, and "추천 코스" is what fills it in Korean.
   */
  recommended: {
    ko: '추천 코스', en: 'AI pick', ja: 'おすすめ', zh: '推荐',
    vi: 'Gợi ý', th: 'แนะนำ', ru: 'Совет', id: 'Saran',
  },
  /** The themed page's refresh button (7181:18180) — its accessible name. */
  refresh: {
    ko: '다른 코스 추천받기', en: 'Suggest another course', ja: '別のコースを提案', zh: '推荐其他路线',
    vi: 'Gợi ý lộ trình khác', th: 'แนะนำเส้นทางอื่น', ru: 'Другой маршрут', id: 'Sarankan rute lain',
  },
  /** 7128:72710's 펼치기 / 접기 pill on a recommended stop's card. */
  expand: {
    ko: '펼치기', en: 'More', ja: '開く', zh: '展开',
    vi: 'Mở rộng', th: 'ขยาย', ru: 'Развернуть', id: 'Buka',
  },
  collapse: {
    ko: '접기', en: 'Less', ja: '閉じる', zh: '收起',
    vi: 'Thu gọn', th: 'ย่อ', ru: 'Свернуть', id: 'Tutup',
  },
  arrowPrev: {
    ko: '이전', en: 'Previous', ja: '前へ', zh: '上一页',
    vi: 'Trước', th: 'ก่อนหน้า', ru: 'Назад', id: 'Sebelumnya',
  },
  arrowNext: {
    ko: '다음', en: 'Next', ja: '次へ', zh: '下一页',
    vi: 'Tiếp', th: 'ถัดไป', ru: 'Далее', id: 'Berikutnya',
  },
  /**
   * 전체보기 / 선택보기 (6858:69231 · 6858:69233). Localization_Jeju has no row
   * for either — same gap STAT_LABEL below documents — so both are authored in
   * the eight languages the kiosk ships.
   */
  viewAll: {
    ko: '전체보기', en: 'View all', ja: 'すべて表示', zh: '查看全部',
    vi: 'Xem tất cả', th: 'ดูทั้งหมด', ru: 'Показать всё', id: 'Lihat semua',
  },
  viewPicked: {
    ko: '선택보기', en: 'My picks', ja: '選択のみ', zh: '仅所选',
    vi: 'Mục đã chọn', th: 'เฉพาะที่เลือก', ru: 'Только выбранное', id: 'Pilihan saya',
  },
  /**
   * 선택보기 with nothing in the day matching. NOT the same as an empty day:
   * the schedule worked, the filter just left nothing, so the copy must not
   * send the visitor back to redo a search that succeeded.
   */
  emptyPicked: {
    ko: '이 날에는 선택한 즐길 거리와 맞는 장소가 없어요.',
    en: 'Nothing on this day matches the interests you picked.',
    ja: 'この日には選んだ楽しみ方に合う場所がありません。',
    zh: '这一天没有符合所选体验项目的地点。',
    vi: 'Ngày này không có địa điểm nào khớp với sở thích bạn đã chọn.',
    th: 'วันนี้ไม่มีสถานที่ที่ตรงกับกิจกรรมที่คุณเลือก',
    ru: 'В этот день нет мест, соответствующих вашим интересам.',
    id: 'Tidak ada tempat di hari ini yang cocok dengan minat pilihan Anda.',
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
};

interface CourseMeta {
  /** Rail letter used in the header subtitle — "A코스 - 1일차". */
  label: string;
  title: Partial<Record<Lang, string>>;
  tags: Partial<Record<Lang, string>>;
  /**
   * NOT DRAWN by -04-1 — the frame runs the hashtags straight into the summary
   * bar and has no room for a paragraph. Kept because it is authored editorial
   * copy in all eight languages that the -03 frames did draw and a later frame
   * may again; deleting it would mean re-translating it to restore the row.
   */
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
  /** 7038:18453's third slot — the party size and the stay, as answered. */
  partyStay: {
    ko: '방문 인원/ 일정', en: 'Group / Stay', ja: '人数 / 日程', zh: '人数 / 行程',
    vi: 'Số người / Lịch', th: 'จำนวนคน / กำหนดการ', ru: 'Гости / Срок', id: 'Orang / Jadwal',
  },
  /** Per-stop, first in the card's stats row: "영업 시간 08:00-20:00" (7229:100439). */
  hours: {
    ko: '영업 시간', en: 'Hours', ja: '営業時間', zh: '营业时间',
    vi: 'Giờ mở cửa', th: 'เวลาทำการ', ru: 'Часы работы', id: 'Jam buka',
  },
  /** Per-stop only — the card reads "머무는 시간 : 2-3시간" in -04-1. */
  dwell: {
    ko: '머무는 시간', en: 'Time here', ja: '滞在時間', zh: '停留时间',
    vi: 'Thời gian ở lại', th: 'เวลาที่แวะ', ru: 'Время на месте', id: 'Waktu di sini',
  },
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
  /**
   * 쇼핑·로컬 체험 — the landing's fourth themed card. Title and tags authored to
   * match its card; the offline placeholders are 자연·유산's, since nothing about
   * a shopping day is authored anywhere yet and they are only ever drawn when
   * the API is unreachable. Requests course B (see COURSE_LETTERS).
   */
  shop: {
    label: 'B',
    title: {
      ko: '쇼핑·로컬 체험 코스', en: 'Shopping & Local', ja: 'ショッピング・ローカル体験コース',
      zh: '购物·当地体验路线', vi: 'Mua sắm & Trải nghiệm địa phương',
      th: 'เส้นทางช้อปปิ้งและท้องถิ่น', ru: 'Шопинг и местный колорит', id: 'Belanja & Pengalaman Lokal',
    },
    tags: {
      ko: '#쇼핑 #로컬 #기념품', en: '#Shopping #Local #Souvenirs', ja: '#ショッピング #ローカル #お土産',
      zh: '#购物 #本地 #纪念品', vi: '#Muasắm #Địaphương #Quàlưuniệm',
      th: '#ช้อปปิ้ง #ท้องถิ่น #ของที่ระลึก', ru: '#Шопинг #Местное #Сувениры',
      id: '#Belanja #Lokal #Suvenir',
    },
    desc: {
      ko: '제주의 시장과 로컬샵을 둘러보며 기념품과 특산품을 만나는 코스입니다.',
      en: "A course through Jeju's markets and local shops for souvenirs and specialties.",
      ja: '済州の市場やローカルショップを巡り、お土産や特産品に出会うコースです。',
      zh: '游览济州市场与本地小店，挑选纪念品和特产的路线。',
      vi: 'Hành trình dạo chợ và cửa hàng địa phương Jeju để mua quà và đặc sản.',
      th: 'เส้นทางเดินตลาดและร้านท้องถิ่นของเชจู เพื่อซื้อของฝากและของขึ้นชื่อ',
      ru: 'Маршрут по рынкам и местным лавкам Чеджу за сувенирами и деликатесами.',
      id: 'Rute menyusuri pasar dan toko lokal Jeju untuk suvenir dan produk khas.',
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
   * The disc number — the stop's position within its DAY.
   */
  number: number;
}

/** One day's full itinerary — every scheduled stop, scrollable together. */
interface DayItinerary {
  day: number;
  stops: Stop[];
}

export function JejuAiDetail({ controller }: Props): JSX.Element {
  const courseKey = useAiStore((s) => s.course);
  const entry = useAiStore((s) => s.entry);
  const setResumeQuestions = useAiStore((s) => s.setResumeQuestions);
  /**
   * A themed course (Figma 7058:22277): opened from a themed card through its
   * own questionnaire, which asks no 즐길 거리. So there are no answer pills to
   * echo, every stop is the full plate, and the list rises into the band the
   * pills leave (1295 → 1139). Since the 2026-09-14 hand-off it is THIS page
   * that carries 전체보기 / 선택보기 beside the DAY row — 7058:21462, the
   * 커스텀 코스 detail, no longer draws the pair.
   */
  const themed = entry === 'theme';
  const interests = useAiStore((s) => s.interests);
  const transport = useAiStore((s) => s.transport);
  const stay = useAiStore((s) => s.stay);
  const visitors = useAiStore((s) => s.visitors);
  /** 커스텀 코스: the plan the visitor built tap by tap — see the loading effect. */
  const pickerPlan = useAiStore((s) => s.pickerPlan);
  /** The region picked on the themed questionnaire's map (a JejuRegionId). */
  const region = useAiStore((s) => s.region);
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
  /** Index into `days` — the ← → pair steps days, not pages within a day. */
  const [dayIndex, setDayIndex] = useState(0);
  /**
   * 전체보기 / 선택보기 (6858:69231 · 6858:69233) — a CATEGORY filter over the
   * day's stops, not a day switch; the ← → pager still owns the days.
   *
   * The itinerary is not made up only of the visitor's picks. The recommender
   * fills each day to its time budget and the offline fallback tops up with
   * "anything left" outright (see buildSpots), so a day routinely carries stops
   * in categories the visitor never chose. 전체보기 shows the schedule as
   * planned — it is the default, because that is the course the AI built —
   * and 선택보기 drops everything that does not match a picked 즐길 거리.
   */
  const [scope, setScope] = useState<'all' | 'picked'>('all');
  // The pair is drawn on the themed page only (see `themed`), so only there can
  // the view be narrowed.
  const onlyPicked = themed && scope === 'picked';
  /**
   * Recommended stops the visitor opened with 펼치기 (7128:72710), by shop id —
   * the recommender schedules a shop once per course, so the id is enough. A
   * new course starts with every one collapsed (see the `days` effect).
   */
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());
  const toggleExpanded = useCallback((shopId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(shopId)) next.delete(shopId);
      else next.add(shopId);
      return next;
    });
  }, []);
  const listRef = useRef<HTMLDivElement>(null);
  const lowReach = useAccessibilityStore((s) => s.lowReach);

  /**
   * Adds the ♿ row-top override to a class (+113px mode-bar drop).
   *
   * Standard frame is 6516:73138; ♿ uses the mode-bar revision (bar only, no
   * banner) — see the *Low block at the foot of the stylesheet.
   */
  /* Both params are `string | undefined` because that is how CSS Module lookups
     are typed here — see DayArrow's `className` for the same. */
  const low = (base?: string, lowClass?: string): string =>
    [base, lowReach ? lowClass : ''].filter(Boolean).join(' ');

  /** The questionnaire, echoed under the summary bar — see the row in the JSX. */
  /* 즐길 거리 only (2026-09-14): 방문 인원 / 체류 기간 / 이동수단 already read
     in the summary bar above, so the row under DAY echoes just the tiles. */
  const picks = useMemo(() => interests.filter(Boolean), [interests]);
  const pickLabels = useMemo(
    () => picks.map((p) => localizeJejuAiPick(p, lang)),
    [picks, lang],
  );

  /** The scheduled course, or null while it loads and after a failed call. */
  const [course, setCourse] = useState<JejuCourse | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * The Korean names of the course on screen when refresh was last tapped —
   * sent as `excludeShops` so /recommend builds a different combination. It
   * holds only the LATEST course, not every one seen: excluding everything ever
   * shown would starve a small category after a few taps, and the rule-based
   * server still varies the answer from one exclusion set to the next.
   */
  const [excludedShops, setExcludedShops] = useState<string[]>([]);

  /**
   * One request per visit, built from the questionnaire the visitor just filled
   * in. Every answer travels: the course letter picked on JejuAiResult, the
   * 이동수단 and party size and 박수 from the chips, the 즐길 거리 tiles as the
   * catalogue's own `aiCategoryKr` values, and today's date so the server can
   * drop closing days and non-market days for the 5일장.
   *
   * `excludeShops` is the re-recommendation lever, and since 7128:72710 the
   * themed page has the control that pulls it: the refresh button beside the DAY
   * row (see `refreshCourse`). Until it is tapped nothing is excluded.
   *
   * `region` is the 권역 picked on the themed map, and goes ONLY with a themed
   * course: the 커스텀 코스 has no map, so a region left on aiStore by an earlier
   * themed visit must not confine its fallback request.
   */
  useEffect(() => {
    // The catalogue is needed twice over — to recover each interest's prefix,
    // and to resolve the shopIds that come back — so there is nothing to ask
    // for until it lands. It loads at app start, so this is a brief window.
    if (shops.length === 0) {
      setLoading(false);
      return;
    }
    // 커스텀 코스: draw the plan the visitor built tap by tap on the questionnaire
    // (POST /api/jeju/courses/picker) — the same places and times they watched
    // fill the day. /recommend would schedule a different course, and keeps
    // only three interests. It stays the fallback when the picker was down.
    if (entry === 'custom' && pickerPlan) {
      setCourse(pickerPlanToCourse(pickerPlan, shops));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const regionParam = entry === 'theme' ? regionCode(region) : undefined;
    void window.api.jejuCourse
      .recommend({
        course: courseLetter(courseKey),
        ...(regionParam ? { region: regionParam } : {}),
        transport: transportCode(transport),
        party: partySize(visitors),
        nights: nightCount(stay),
        interests: interestCodes(interests, shops),
        visitDate: todayIso(),
        ...(excludedShops.length > 0 ? { excludeShops: excludedShops } : {}),
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
  }, [courseKey, region, transport, visitors, stay, interests, shops, entry, pickerPlan, excludedShops]);

  /** Days the OFFLINE fallback runs for, from the 체류 기간 answer. */
  const fallbackDays = DAYS_BY_STAY[stay] ?? 1;

  const shopById = useMemo(() => new Map(shops.map((shop) => [shop.id, shop])), [shops]);

  // Offline only. Built for the whole trip and sliced per day so a spot never
  // appears twice; cheap enough not to gate on `course`.
  const fallbackSpots = useMemo(
    () => buildSpots(interests, shops, OFFLINE_SPOTS_PER_DAY * fallbackDays),
    [interests, shops, fallbackDays],
  );

  /**
   * The itinerary grouped by day. Every stop the server scheduled for a day is
   * kept together — the list below scrolls when there are more than fit on
   * screen, rather than splitting a day across several pages.
   */
  const days: DayItinerary[] = useMemo(() => {
    if (course) {
      return course.schedule.map((scheduled) => ({
        day: scheduled.day,
        stops: scheduled.spots
          .map((spot): Stop | null => {
            const shop = shopById.get(spot.shopId);
            return shop ? { shop, spot, number: spot.order } : null;
          })
          .filter((stop): stop is Stop => stop !== null),
      }));
    }

    return Array.from({ length: fallbackDays }, (_, i) => ({
      day: i + 1,
      stops: fallbackSpots
        .slice(i * OFFLINE_SPOTS_PER_DAY, (i + 1) * OFFLINE_SPOTS_PER_DAY)
        .map((shop, j) => ({ shop, spot: null, number: j + 1 })),
    }));
  }, [course, shopById, fallbackSpots, fallbackDays]);

  useEffect(() => {
    setDayIndex((i) => Math.max(0, Math.min(i, days.length - 1)));
    setExpanded(new Set());
  }, [days]);

  useEffect(() => {
    listRef.current?.scrollTo(0, 0);
  }, [dayIndex, scope]);

  const currentDay = days[dayIndex];
  /* Memoised because `?? []` would otherwise hand `pickedStops` a fresh array
     every render and defeat its own memo. */
  const stops = useMemo(() => currentDay?.stops ?? [], [currentDay]);
  /**
   * The chips in the row under DAY. The course's own 즐길 거리 when it has any —
   * the visitor's taps on the 커스텀 코스, 쇼핑·로컬's preset on the themed page.
   * 자연·유산 / 맛집·감성 / 가족·체험 carry none, and 7128:72710 still draws the
   * row under 전체보기, so there it shows the categories of the day's stops, in
   * route order and without repeats.
   */
  const chipLabels = useMemo(() => {
    if (pickLabels.length > 0) return pickLabels;
    if (!themed) return [];
    return [...new Set(stops.map((stop) => shopSecondCategory(stop.shop, lang)).filter(Boolean))];
  }, [pickLabels, themed, stops, lang]);
  /** The day number the visible list belongs to — what the DAY label shows. */
  const day = currentDay?.day ?? 1;
  /**
   * The day narrowed to the picked 즐길 거리. `catMatches` is the same predicate
   * the offline builder uses to CHOOSE a shop for a category, so a stop it put
   * in for an interest always survives the filter that interest implies.
   *
   * With no interests stored (a deep link, or an idle reset that cleared the
   * store) there is nothing to filter by, so 선택보기 is a no-op rather than an
   * empty page.
   */
  /**
   * Whether a stop is one the visitor picked — its category matches a 즐길 거리
   * they chose. The rest are the recommender's fill-ins: 7038:18453 draws those
   * as the compact "추천 코스" card, and 선택보기 hides them.
   *
   * The API marks neither kind (JejuCourseSpot has no such field), so this is
   * the same category match 선택보기 has always filtered on. With no picks at all
   * — a themed course from the landing — every stop is the course's own, and
   * they all draw full.
   */
  const isPicked = useCallback(
    (stop: Stop): boolean =>
      // Same on both routes now: 7128:72710 draws the themed 전체보기 with the
      // compact "추천 코스" card for stops outside the course's 즐길 거리. A
      // course with no 즐길 거리 at all draws every stop full.
      interests.length === 0 || interests.some((cat) => catMatches(stop.shop, cat)),
    [interests],
  );
  /**
   * What 선택보기 keeps on the themed page. Not `isPicked`, which is true for
   * every themed stop (they all draw full): the filter reads the course's own
   * 즐길 거리 — 쇼핑·로컬 carries its shopping preset, so 선택보기 narrows that
   * course to its shopping stops. The other themes carry none, and with nothing
   * to match 선택보기 is a no-op rather than an empty page.
   */
  const matchesPicks = useCallback(
    (stop: Stop): boolean => interests.length === 0 || interests.some((cat) => catMatches(stop.shop, cat)),
    [interests],
  );
  const pickedStops = useMemo(() => stops.filter(matchesPicks), [stops, matchesPicks]);
  const visibleStops = onlyPicked ? pickedStops : stops;
  /**
   * DAY 1 opens with the start-point row (7181:18213, disc 1): the kiosk, which
   * is where the day's first travel is measured from. Later days start from the
   * previous day's last stop (see JejuCourseDay), so they draw no start row and
   * number their stops from 1.
   */
  const hasStart = day === 1 && visibleStops.length > 0;
  const startLabel = startPlaceLabel(controller.kioskId, lang);
  /**
   * The 즐길 거리 row under DAY. 커스텀 코스 (7058:21462): always, when there are
   * picks. Themed (7128:72710 · 7058:22277): only under 전체보기 — 선택보기
   * hides the row and the list rises into its band (1295 → 1139).
   */
  const showPicks = chipLabels.length > 0 && (!themed || !onlyPicked);
  /**
   * 7058:21462 puts disc 1 level with the centre of the 즐길 거리 row, not beside
   * the start card: the row is where the day begins, the start card below it
   * carries no disc, and the first stop is disc 2. So on the 커스텀 코스, DAY 1,
   * with the row showing, disc 1 is drawn fixed on the row's centre line and a
   * short stretch of rail joins it to the list.
   */
  const discOnPicks = !themed && showPicks && hasStart;
  /**
   * The rows' real heights, for the rail. A card only STARTS at 515 / 289 — a
   * name, address or description that wraps grows it — and the rail has to end
   * on the last disc wherever that now sits. Measured in a layout effect, so
   * the corrected rail is what first paints; until then (and for a day whose
   * stop count has not been measured yet) the drawn heights stand in.
   */
  const [rowHeights, setRowHeights] = useState<number[]>([]);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (loading || !list) return undefined;
    const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-stop-row]'));
    const measure = (): void => {
      const next = rows.map((row) => row.offsetHeight);
      setRowHeights((prev) =>
        prev.length === next.length && prev.every((h, i) => h === next[i]) ? prev : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    rows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [visibleStops, loading, hasStart]);
  /** Rows on the rail: the start row (DAY 1) and then the stops. */
  const rowCount = visibleStops.length + (hasStart ? 1 : 0);
  const heights =
    rowHeights.length === rowCount
      ? rowHeights
      : [
          ...(hasStart ? [START_HEIGHT] : []),
          ...visibleStops.map((stop) =>
            isPicked(stop) || expanded.has(stop.shop.id) ? CARD_HEIGHT : COMPACT_HEIGHT,
          ),
        ];
  const rail = railFor(heights);
  /**
   * The travel-time pills on the rail (7058:21462 · 7128:72710, "15분") — one
   * per leg, centred on the rail halfway between the two discs it joins.
   *
   * `travelMinutes` is the time from the PREVIOUS stop, so a leg reads the
   * later stop's value. Under 선택보기 two neighbouring rows can be 1 and 3:
   * there was no such leg (the route goes through 2), so that gap gets no pill
   * rather than a number for a trip nobody makes. A zero is the normalizer's
   * "the server gave none" and draws nothing either.
   */
  const centers = discCenters(heights);
  const legOf = (next: Stop): string | null => {
    const minutes = next.spot ? next.spot.travelMinutes : OFFLINE_TRAVEL_MINUTES;
    return minutes > 0 ? minutesLabel(minutes, lang) : null;
  };
  // Row index `r` on the rail is the stop index plus one when the start row leads.
  const offset = hasStart ? 1 : 0;
  /* With disc 1 up on the 즐길 거리 row, the rail inside the list starts at the
     list's top edge (continuing the stretch above it) rather than at a disc. */
  const listRail = discOnPicks ? { top: 0, height: centers[centers.length - 1]! } : rail;
  const legs = [
    // Start → the day's first stop: that stop's travel is measured from the day's
    // start, so it only applies when the first row really IS stop 1. Beside the
    // start card when disc 1 sits on the 즐길 거리 row (21462's pill at 1344 is
    // level with the start card), otherwise halfway between the two discs.
    ...(hasStart
      ? [
          visibleStops[0]!.number === 1 && legOf(visibleStops[0]!)
            ? {
                top: discOnPicks ? centers[0]! : (centers[0]! + centers[1]!) / 2,
                label: legOf(visibleStops[0]!)!,
              }
            : null,
        ]
      : []),
    ...visibleStops.slice(1).map((next, i) => {
      const prev = visibleStops[i]!;
      if (next.number !== prev.number + 1) return null;
      const label = legOf(next);
      if (!label) return null;
      return { top: (centers[i + offset]! + centers[i + offset + 1]!) / 2, label };
    }),
  ];
  /**
   * The header's course+day line. The AI 맞춤 route names the course the way
   * this frame does — "AI 맞춤 추천 코스 - 1일차" (7038:18453); a themed course
   * takes its name from the sheet — "자연·유산 탐방 코스 - 1일차".
   */
  const courseDayTitle = jejuCourseNameWithDay(
    entry === 'custom' ? pick(AI_COURSE_NAME, lang) : courseSheetText(courseKey, 'Desc2', lang, meta.title),
    day,
    lang,
  );

  const goPrevDay = useCallback(() => setDayIndex((i) => Math.max(0, i - 1)), []);
  const goNextDay = useCallback(
    () => setDayIndex((i) => Math.min(days.length - 1, i + 1)),
    [days.length],
  );

  /**
   * How long the visitor spends here: the schedule's, or the authored
   * placeholder offline. -04-1 LABELS it — "머무는 시간 : 2-3시간" — where the
   * -03 frames drew the bare value; the same card is used for the 다음 장소 row
   * under the spot detail, so that one gains the label too.
   */
  const dwellOf = (stop: Stop): string => {
    const value = stop.spot ? minutesLabel(stop.spot.dwellMinutes, lang) : pick(meta.spotDuration, lang);
    return `${pick(STAT_LABEL.dwell, lang)} : ${value}`;
  };

  /**
   * "난이도 : X" — colon-separated in -04-1, to match the dwell stat beside it.
   * An ungraded SCHEDULED spot draws no row rather than a wrong one:
   * `difficulty: 0` is the normalizer's "the server gave none". Offline there is
   * no schedule to grade, so the authored placeholder stands in.
   */
  /**
   * "영업 시간 08:00-20:00" — the first stat on the itinerary cards since
   * 7058:21462 / 7128:72710 (dwell moved into the second slot, 난이도 left the
   * card). Same source rule as the 상세 card's hours in openSpot: the server's
   * `openTimeText`, where NULL means "only an estimate" and draws nothing; the
   * offline path reads the shop's own `openTime`. Line breaks fold to one line.
   */
  const hoursOf = (stop: Stop): string => {
    const raw = (stop.spot ? stop.spot.openTimeText : stop.shop.openTime) ?? '';
    const text = raw.replace(/\s+/g, ' ').trim();
    return text ? `${pick(STAT_LABEL.hours, lang)} ${text}` : '';
  };

  const hardnessOf = (stop: Stop): string => {
    const grade = stop.spot ? difficultyLabel(stop.spot.difficulty) : meta.spotDifficulty;
    if (!grade) return '';
    return `${pick(STAT_LABEL.difficulty, lang)} : ${pick(DIFFICULTY_WORD[grade] ?? { ko: grade }, lang)}`;
  };

  /** Falls back to the shared no-image placeholder, like the list and detail cards. */
  const photoOf = (stop: Stop): string => shopImages(stop.shop)[0] ?? jejuIconUrl('noimage') ?? '';

  /**
   * `list` is the day the tapped stop belongs to, not the whole itinerary: the
   * 다음 장소 chain the detail screen walks must stop at the end of ITS day, and
   * under 전체보기 the day is no longer implied by `stops`.
   */
  const detailFor = (list: Stop[], i: number): DetailItem | undefined => {
    const stop = list[i];
    if (!stop) return undefined;
    const { shop, spot } = stop;
    const nextStop = list[i + 1];
    const nextItem = detailFor(list, i + 1);
    return {
      from: 'ai_detail',
      shopId: shop.id,
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
      rentcarRoute: shop.route ?? null,
      ...(nextStop && nextItem
        ? { courseNext: { dwell: dwellOf(nextStop), difficulty: hardnessOf(nextStop), item: nextItem } }
        : {}),
    };
  };

  const openSpot = (list: Stop[], stop: Stop): void => {
    const item = detailFor(list, list.indexOf(stop));
    if (!item) return;
    setDetail(item);
    controller.navigate('detail', '코스 상세');
  };

  /**
   * The summary bar, in 7038:18453's order: 총 소요시간 · 이동거리 · 방문 인원/
   * 일정 · 이동수단. Four slots either way, and the two paths never mix:
   * scheduled → every number is the server's, offline → every number is the
   * authored placeholder. The last two are the visitor's own answers on both.
   *
   * The second slot is where the paths differ by name as well as value: the API
   * returns travel MINUTES and no distance at all, so it reads 이동시간 there
   * and keeps the design's 이동거리 only on the authored path. 난이도 left the
   * bar in this redraw; every card still carries its own. Totals are for the
   * whole course, not the visible day — the DAY pager sits below the bar.
   */
  const stats: Array<{ label: string; value: string; lg?: boolean }> = useMemo(() => {
    const chosenTransport = transportLabel(transport || '자동차', lang);
    /* The visitor's own two answers, localized like the pick pills. A themed
       course was never asked either question, so it reads a dash rather than
       the defaults its request quietly fell back on. */
    const partyStay =
      [visitors, stay]
        .filter(Boolean)
        .map((answer) => localizeJejuAiPick(answer, lang))
        .join(' / ') || '-';
    const partyStat = { label: pick(STAT_LABEL.partyStay, lang), value: partyStay, lg: true };
    const transportStat = { label: pick(STAT_LABEL.transport, lang), value: chosenTransport };
    if (!course) {
      return [
        { label: totalTimeLabel, value: pick(meta.duration, lang) },
        { label: pick(STAT_LABEL.distance, lang), value: pick(meta.distance, lang) },
        partyStat,
        transportStat,
      ];
    }
    const travel = course.schedule.reduce(
      (total, d) => total + d.spots.reduce((n, spot) => n + spot.travelMinutes, 0),
      0,
    );
    return [
      { label: totalTimeLabel, value: aboutMinutesLabel(course.totalMinutes, lang) },
      { label: pick(STAT_LABEL.travel, lang), value: minutesLabel(travel, lang) },
      partyStat,
      transportStat,
    ];
  }, [course, transport, visitors, stay, meta, totalTimeLabel, lang]);

  /**
   * The header QR's payload — the itinerary on screen, as shopIds and numbers.
   * Rebuilt with `days`, so switching DAY does not change it: the phone gets
   * the whole trip either way, and 전체보기 / 선택보기 is a kiosk-side view.
   */
  const courseQrUrl = useMemo(
    () =>
      buildAiCourseSaveUrlForQr({
        lang,
        // The phone titles the course from this code: the 커스텀 코스 and
        // 쇼핑·로컬 have their own (X / D) — sending the A / B they request
        // made the phone call them 자연·유산 / 맛집·감성.
        course: entry === 'custom' ? 'X' : courseKey === 'shop' ? 'D' : courseLetter(courseKey),
        transport: transportCode(transport),
        party: partySize(visitors),
        nights: nightCount(stay),
        interests: interestCodes(interests, shops),
        visitDate: todayIso(),
        days: days.map((d) => ({
          day: d.day,
          stops: d.stops.map((stop) => ({
            shopId: stop.shop.id,
            dwellMinutes: stop.spot?.dwellMinutes ?? null,
            difficulty: stop.spot?.difficulty ?? null,
          })),
        })),
        totalMinutes: course?.totalMinutes ?? null,
        // Summed the same way the summary bar sums it; absent offline, where the
        // phone falls back to this course's authored 이동거리 instead.
        travelMinutes: course
          ? course.schedule.reduce(
              (sum, d) => sum + d.spots.reduce((n, spot) => n + (spot.travelMinutes ?? 0), 0),
              0,
            )
          : null,
        difficulty: course?.difficulty ?? null,
      }),
    [lang, entry, courseKey, transport, visitors, stay, interests, shops, days, course],
  );

  return (
    <JejuPageFrame
      controller={controller}
      /* Per route, as the two 2026-09-15 frames draw it: the 커스텀 코스 detail
         (7058:21462) reads "‘제주’ 뭐하지", the 추천코스 detail (7128:72710)
         keeps "(AI 검색)". Both resolve through i18n's TITLE_KEYS. */
      title={themed ? "'제주' 뭐하지 (AI 검색)" : '‘제주’ 뭐하지'}
      subtitle={courseDayTitle}
      subtitleColor="#616161"
      subtitleBold
      bannerFallback="banner-detail"
      showBanner={false}
      /* Both routes come here straight from a questionnaire — the A/B/C
         chooser is out of the flow — so 뒤로 reopens the one the visitor filled
         in: the themed page on the same theme, or the full AI 맞춤 page
         (JejuAiSearch reads entry + course on resume). */
      onBack={() => {
        setResumeQuestions(true);
        controller.navigate('ai_search', '뒤로');
      }}
      /* Mode-bar revision: bar + header shift only — no promo banner in ♿. */
      lowReachModeBar
      lowReachShift={belowModeBar()}
    >
      {/* Header QR — the itinerary, opened on the visitor's phone. The frame's
          174² orange-bordered card (7181:18186), 136px of code inside it:
           · level L, because a QR on glass is never scratched or creased and
             the error correction only costs modules. `boostLevel` is on by
             default, so it still lifts to M/Q for free whenever the payload
             leaves room within the same version.
           · marginSize 0 — the quiet zone is the card's own white padding.
           · crispEdges, because antialiased module borders are what turn a QR
             into grey mush once the artboard is scaled down. */}
      <div className={low(styles.qr, styles.qrLow)}>
        {/* No code until there is an itinerary to encode. The bare /ai link it
            used to show in the meantime opens a page that only says
            "키오스크 QR로 열어 주세요" — a scan that looked broken. The card
            itself stays, so the header does not jump when the code appears. */}
        {courseQrUrl && (
          <QRCodeSVG
            className={styles.qrCode}
            value={courseQrUrl}
            size={136}
            level="L"
            marginSize={0}
            shapeRendering="crispEdges"
            bgColor="#ffffff"
            fgColor="#000000"
          />
        )}
      </div>

      {/* -04-1 runs the hashtags straight into the summary bar — the course
          description the -03 frames drew between them is gone. */}
      <p className={low(styles.tags, styles.tagsLow)}>{courseSheetText(courseKey, 'Tags', lang, meta.tags)}</p>

      <div className={low(styles.summary, styles.summaryLow)}>
        {stats.map((s, i) => (
          <Fragment key={s.label}>
            {i > 0 && <span className={styles.statSep} />}
            <span className={styles.stat}>
              <span className={s.lg ? `${styles.statLabel} ${styles.statLabelLg}` : styles.statLabel}>
                {s.label}
              </span>
              <span className={styles.statValue}>{s.value}</span>
            </span>
          </Fragment>
        ))}
      </div>

      {/* The questionnaire echoed back — UNDER the DAY row since 7038:18453 (it
          sat between the summary bar and the DAY row in 6516:73323). Every value
          is stored KOREAN (see JejuAiSearch's submit), which is how the frame
          draws them; empty slots drop out. */}
      {showPicks && (
        <div className={low(styles.picks, styles.picksLow)}>
          {chipLabels.map((label, i) => (
            <span key={i} className={lang === 'ko' ? styles.pick : `${styles.pick} ${styles.pickWrap}`}>
              {/* A break opportunity after the middle dot, so 레저·액티비티 wraps
                  the way the frame draws it — "레저·" over "액티비티". */}
              {label.replace(/·/g, '·\u200b')}
            </span>
          ))}
        </div>
      )}

      {/* 커스텀 코스, DAY 1: disc 1 on the 즐길 거리 row's centre line, and the
          rail from it down to the list (see discOnPicks). */}
      {!loading && discOnPicks && (
        <>
          <div className={low(styles.railStub, styles.railStubLow)} />
          <span className={low(`${styles.stop} ${styles.stopFixed}`, styles.stopFixedLow)}>1</span>
        </>
      )}

      {/* 7181:18180 — the themed page's refresh: ask /recommend for a different
          combination than the one on screen. Disabled while a course loads. */}
      {themed && (
        <button
          type="button"
          className={low(styles.refreshBtn, styles.refreshLow)}
          aria-label={pick(T.refresh, lang)}
          disabled={loading}
          onClick={() => {
            const names = days.flatMap((d) => d.stops.map((stop) => shopName(stop.shop, 'ko'))).filter(Boolean);
            setExcludedShops([...new Set(names)]);
            setDayIndex(0);
          }}
        >
          {jejuIconUrl('ico-refresh') && (
            <img src={jejuIconUrl('ico-refresh')} alt="" className={styles.refreshIcon} draggable={false} />
          )}
        </button>
      )}

      {/* The day pager. Always drawn — greyed at the ends on DAY 1 / the last
          day — so the row never reflows. The 전체보기 / 선택보기 pair beside it
          filters WITHIN the day and leaves the pager alone. */}
      <DayArrow
        dir="prev"
        disabled={dayIndex <= 0}
        onClick={goPrevDay}
        className={low(styles.dayPrev, styles.dayArrowLow)}
        lang={lang}
      />

      <p className={low(styles.day, styles.dayLow)}>DAY {day}</p>

      <DayArrow
        dir="next"
        disabled={dayIndex >= days.length - 1}
        onClick={goNextDay}
        className={low(styles.dayNext, styles.dayArrowLow)}
        lang={lang}
      />

      {/* 전체보기 / 선택보기 — two pills right of the pager (7181:18191 ·
          7181:18193): the whole scheduled day, or only the stops matching the
          course's 즐길 거리. Drawn on the themed detail (7058:22277) only — the
          커스텀 코스 detail (7058:21462) has the answer pills under the DAY row
          instead. */}
      {themed && (
      <>
      <button
        type="button"
        className={low(
          `${styles.scopeBtn} ${styles.scopeAll} ${onlyPicked ? '' : styles.scopeBtnOn}`,
          styles.scopeLow,
        )}
        aria-pressed={!onlyPicked}
        onClick={() => setScope('all')}
      >
        {pick(T.viewAll, lang)}
      </button>
      <button
        type="button"
        className={low(
          `${styles.scopeBtn} ${styles.scopeDay} ${onlyPicked ? styles.scopeBtnOn : ''}`,
          styles.scopeLow,
        )}
        aria-pressed={onlyPicked}
        onClick={() => setScope('picked')}
      >
        {pick(T.viewPicked, lang)}
      </button>
      </>
      )}

      {loading ? null : visibleStops.length === 0 ? (
        /* A day with no stops at all is the "we found nothing" case; a day whose
           stops were all filtered out is a different sentence, and saying the
           first there would send the visitor back to redo a search that worked. */
        <p className={styles.empty}>{pick(stops.length === 0 ? T.empty : T.emptyPicked, lang)}</p>
      ) : (
        <div
          ref={listRef}
          /* Under the 즐길 거리 row when it shows (1295); risen into its band
             when it does not (1139) — the themed 선택보기, 7058:22277. */
          className={low(
            showPicks ? styles.list : `${styles.list} ${styles.listTheme}`,
            showPicks ? styles.listLow : styles.listThemeLow,
          )}
        >
          {rowCount > 1 && (
            <div
              className={discOnPicks ? `${styles.rail} ${styles.railContinued}` : styles.rail}
              style={{ top: listRail.top, height: listRail.height }}
            />
          )}
          {legs.map(
            (leg, i) =>
              leg && (
                <span key={`leg-${i}`} className={styles.leg} style={{ top: leg.top }}>
                  {leg.label}
                </span>
              ),
          )}
          {hasStart && (
            <div className={styles.stopRow} data-stop-row>
              {/* No disc here when disc 1 is up on the 즐길 거리 row — the spacer
                  keeps the start card on the x310 card column. */}
              {discOnPicks ? (
                <span className={styles.stopSpacer} />
              ) : (
                <span className={styles.stop}>1</span>
              )}
              <div className={styles.startCard}>{startLabel}</div>
            </div>
          )}
          {visibleStops.map((stop, i) => {
            const picked = isPicked(stop);
            const open = !picked && expanded.has(stop.shop.id);
            return (
              <div key={`${i}-${stop.shop.id}`} className={styles.stopRow} data-stop-row>
                {/* Picked stops draw the full plate; the recommender's fill-ins the
                    compact "추천 코스" card with 펼치기, which opens it into the full
                    plate — pill beside the name, 접기 in the stats row
                    (7128:72710). See isPicked. */}
                {/* The stop's own place in the DAY, not its row here: under
                    선택보기 the numbers read 1 · 3 · 4, which is the honest
                    statement that this is a subset of the planned day. On
                    DAY 1 the start row is disc 1, so every stop moves up one. */}
                <span className={styles.stop}>{stop.number + offset}</span>
                <JejuCourseSpotCard
                  width={1678}
                  variant={picked || open ? 'full' : 'compact'}
                  /* The full plate is 7229:100396's 453 itinerary plate. */
                  slim
                  badge={picked ? undefined : pick(T.recommended, lang)}
                  toggle={
                    picked
                      ? undefined
                      : {
                          label: pick(open ? T.collapse : T.expand, lang),
                          onToggle: () => toggleExpanded(stop.shop.id),
                        }
                  }
                  photo={photoOf(stop)}
                  name={shopName(stop.shop, lang)}
                  category={shopSecondCategory(stop.shop, lang)}
                  address={shopAddress(stop.shop, lang)}
                  description={shopDescription(stop.shop, lang)}
                  hours={hoursOf(stop)}
                  dwell={dwellOf(stop)}
                  difficulty={hardnessOf(stop)}
                  /* The 다음 장소 chain follows what is ON SCREEN, so under
                     선택보기 it walks the filtered day rather than re-introducing
                     the stops the visitor just hid. */
                  onClick={() => openSpot(visibleStops, stop)}
                />
              </div>
            );
          })}
        </div>
      )}
    </JejuPageFrame>
  );
}
