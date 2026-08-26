/**
 * 제주 AI 코스 상세 — Figma nodes 6289:55320 (제주>제주모하지(AI검색)-03-1, one day)
 * and 6289:55078 (-03-2, the multi-day variant that adds the DAY arrows).
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
import { useLanguageStore } from '@renderer/store/languageStore';
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
  minutesLabel,
  nightCount,
  partySize,
  todayIso,
  transportCode,
} from '@renderer/lib/jejuCourse';
import { JejuPageFrame } from './JejuPageFrame';
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

/* ── QR block under the itinerary ──────────────────────────────────────
   Derived from .list in the CSS (top 1423, height 2240) and .spot (height 515,
   gap 50), so the QR tracks the ACTUAL number of cards rather than a baked y.
   It moves in BOTH directions: a thin day holds fewer cards than the design's
   four and the QR rises to meet them, while a scheduled day can hold nine —
   more than the list's 2240 viewport shows — and the QR would otherwise be
   pushed off the artboard entirely. See `qrTopFor` for the clamp that stops
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
}: {
  dir: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
  /** Optional because CSS Module lookups are typed `string | undefined` here. */
  className?: string;
  style?: CSSProperties;
}): JSX.Element {
  return (
    <button
      type="button"
      className={`${styles.dayArrow} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
      aria-label={dir === 'prev' ? '이전 날짜' : '다음 날짜'}
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
  title: string;
  tags: string;
  desc: string;
  /**
   * OFFLINE FALLBACK ONLY. These are the authored placeholders this page used
   * to show unconditionally; `POST /api/jeju/courses/recommend` now supplies
   * the real 소요시간 / 이동시간 / 난이도 and the per-spot values, and these are
   * reached only when that call fails. They stay because a kiosk that cannot
   * reach the network still has to draw a course — but nothing on the API path
   * may read them, or the bar would mix a real number with an invented one.
   */
  duration: string;
  distance: string;
  difficulty: string;
  /** Per-spot placeholders, same caveat. */
  spotDuration: string;
  spotDifficulty: string;
}

const COURSE_META: Record<string, CourseMeta> = {
  nature: {
    label: 'A',
    title: '자연·유산 탐방 코스',
    tags: '#자연 #유산 #힐링',
    desc: '제주의 아름다운 자연 경관과 역사·문화·유산을 함께 만날 수 있는 코스입니다.\n탁 트인 바다와 오름, 전통 마을을 천천히 둘러보며 여유로운 시간을 즐겨보세요.',
    duration: '약 4~5시간',
    distance: '약 18Km',
    difficulty: '쉬움',
    spotDuration: '2-3시간',
    spotDifficulty: '난이도 쉬움',
  },
  food: {
    label: 'B',
    title: '맛집·감성 코스',
    tags: '#미식 #감성 #로컬',
    desc: '제주의 맛과 감성을 가득 담은 로컬 중심 코스입니다.\n현지인이 즐겨 찾는 맛집과 감성 공간을 천천히 둘러보세요.',
    duration: '약 4~5시간',
    distance: '약 15Km',
    difficulty: '쉬움',
    spotDuration: '1-2시간',
    spotDifficulty: '난이도 쉬움',
  },
  family: {
    label: 'C',
    title: '가족·체험 코스',
    tags: '#가족 #체험 #즐거움',
    desc: '온 가족이 함께 즐길 수 있는 체험 중심 코스입니다.\n아이와 어른 모두 즐겁게 참여할 수 있는 장소로 구성했습니다.',
    duration: '약 5~6시간',
    distance: '약 22Km',
    difficulty: '보통',
    spotDuration: '2-3시간',
    spotDifficulty: '난이도 쉬움',
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

  const meta = COURSE_META[courseKey] ?? COURSE_META.nature!;
  /** Index into `pages`, not a day number — a day can span several pages. */
  const [pageIndex, setPageIndex] = useState(0);
  const lowReach = useAccessibilityStore((s) => s.lowReach);

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

  const openSpot = ({ shop, spot }: Stop): void => {
    setDetail({
      from: 'ai_detail',
      // JejuDetail shows this as the header SUBTITLE for AI-course spots, so it
      // carries the course + day rather than a generic label.
      title: `${meta.label}코스 - ${day}일차`,
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
    });
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
    const chosenTransport = transport || '자동차';
    if (!course) {
      return [
        { label: '총 소요시간', value: meta.duration },
        { label: '이동수단', value: chosenTransport },
        { label: '이동거리', value: meta.distance },
        { label: '난이도', value: meta.difficulty },
      ];
    }
    const travel = course.schedule.reduce(
      (total, d) => total + d.spots.reduce((n, spot) => n + spot.travelMinutes, 0),
      0,
    );
    return [
      { label: '총 소요시간', value: `약 ${minutesLabel(course.totalMinutes)}` },
      { label: '이동수단', value: chosenTransport },
      { label: '이동시간', value: minutesLabel(travel) },
      { label: '난이도', value: difficultyLabel(course.difficulty) || meta.difficulty },
    ];
  }, [course, transport, meta]);

  return (
    <JejuPageFrame
      controller={controller}
      title="'제주' 뭐하지 (AI 검색)"
      subtitle={`${meta.label}코스 - ${day}일차`}
      subtitleColor="#616161"
      bannerFallback="banner-detail"
      showBanner={false}
      onBack={() => controller.navigate('ai_result', '뒤로')}
    >
      <p className={styles.title}>{meta.title}</p>
      <div className={styles.rule} />
      <p className={styles.tags}>{meta.tags}</p>
      <p className={styles.desc}>{meta.desc}</p>

      <div className={styles.summary}>
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

      {/* The pager. Always drawn — greyed at the ends, exactly as the Figma
          shows the left one on the first screen — so the row never reflows.
          It steps a PAGE at a time, which is a day boundary only when the day
          fits on one page; see `pages`. */}
      <DayArrow
        dir="prev"
        disabled={pageIndex <= 0}
        onClick={goPrevPage}
        className={styles.dayPrev}
      />

      <p className={styles.day}>DAY {day}</p>

      <DayArrow
        dir="next"
        disabled={pageIndex >= pages.length - 1}
        onClick={goNextPage}
        className={styles.dayNext}
      />

      {/* Nothing at all while the schedule is in flight: the empty copy tells
          the visitor to change their interests, which would be wrong advice for
          a course that is simply still arriving. */}
      {loading ? null : stops.length === 0 ? (
        <p className={styles.empty}>{pick(T.empty, lang)}</p>
      ) : (
        <>
          <div className={styles.rail} />

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
          <div className={styles.list}>
            {stops.map((stop, i) => {
              const { shop, spot } = stop;
              // Falls back to the shared no-image placeholder, like the list
              // and detail cards; the empty slot stays only if even that is
              // missing from the asset folder.
              const photo = shopImages(shop)[0] ?? jejuIconUrl('noimage');
              // How long the visitor spends here, and how hard it is. Both come
              // from the schedule; the authored pair stands in only offline.
              const dwell = spot ? minutesLabel(spot.dwellMinutes) : meta.spotDuration;
              const grade = spot ? difficultyLabel(spot.difficulty) : '';
              // An ungraded spot draws no 난이도 row rather than a wrong one —
              // `difficulty: 0` is the normalizer's "the server gave none".
              const hardness = spot ? (grade ? `난이도 ${grade}` : '') : meta.spotDifficulty;
              return (
                <div key={`${i}-${shop.id}`} className={styles.stopRow}>
                  <span className={styles.stop}>{stop.number}</span>
                  <button type="button" className={styles.spot} onClick={() => openSpot(stop)}>
                  {photo ? (
                    <img src={photo} alt="" className={styles.spotImg} draggable={false} loading="lazy" />
                  ) : (
                    <span className={styles.spotImg} />
                  )}

                  <span className={styles.spotBody}>
                    <span className={styles.spotTop}>
                      <span className={styles.spotNameRow}>
                        <p className={styles.spotName}>{shopName(shop, lang)}</p>
                        <p className={styles.spotTag}>{shopSecondCategory(shop, lang)}</p>
                      </span>

                      <span className={styles.spotAddrRow}>
                        {jejuIconUrl('ico-marker') && (
                          <img src={jejuIconUrl('ico-marker')} alt="" className={styles.spotAddrIcon} draggable={false} />
                        )}
                        <p className={styles.spotAddr}>{shopAddress(shop, lang)}</p>
                      </span>

                      <p className={styles.spotDesc}>{shopDescription(shop, lang)}</p>
                    </span>

                    <span className={styles.spotMeta}>
                      <span className={styles.metaItem}>
                        {jejuIconUrl('ico-duration') && (
                          <img src={jejuIconUrl('ico-duration')} alt="" className={styles.metaIcon} draggable={false} />
                        )}
                        <span className={styles.metaText}>{dwell}</span>
                      </span>
                      {hardness && (
                        <span className={styles.metaItem}>
                          {jejuIconUrl('ico-difficulty') && (
                            <img src={jejuIconUrl('ico-difficulty')} alt="" className={styles.metaIcon} draggable={false} />
                          )}
                          <span className={styles.metaText}>{hardness}</span>
                        </span>
                      )}
                    </span>
                  </span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* 모바일에서 확인하기 — label left, QR right, the QR's right edge flush
              with the cards' right edge and 30px below the last card.
              Rendered only when there is a real destination: a QR that scans to
              nothing is worse than no QR, which is how JejuSpotDetailCard treats
              its own. See `qrLink`. */}
          {qrLink && (
            <div className={styles.qrRow} style={{ top: qrTopFor(stops.length) }}>
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
              />
              <DayArrow
                dir="next"
                disabled={pageIndex >= pages.length - 1}
                onClick={goNextPage}
                className={styles.dayNextBottom}
                style={{ top: bottomPagerTopFor(stops.length) }}
              />
            </>
          )}
        </>
      )}
    </JejuPageFrame>
  );
}
