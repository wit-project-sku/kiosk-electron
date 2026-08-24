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
 *  - Spots: REAL shops, matched to the visitor's picked interests exactly the
 *    way OsanAiResult builds its courses. Name, category, address, description
 *    and photo are live data.
 *  - Summary bar 이동수단: the visitor's own answer, carried on aiStore.
 *  - Summary 소요시간 / 이동거리 / 난이도 and the per-spot 소요시간 / 난이도:
 *    NO DATA SOURCE EXISTS. `Shop` has no duration, difficulty or distance, and
 *    nothing computes a route. They are authored per course below and must be
 *    replaced by a real source before this ships — see COURSE_META.
 */
import { Fragment, useCallback, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { Shop } from '@shared/types/shop';
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
import { JejuPageFrame } from './JejuPageFrame';
import styles from './JejuAiDetail.module.css';

interface Props {
  controller: KioskController;
}

/** Spots shown per day — matches the four numbered stops in the design. */
const SPOTS_PER_DAY = 4;

/**
 * How many days the itinerary runs, from the 체류 기간 answer on the
 * questionnaire — so the day swiper reflects what the visitor actually picked
 * rather than a fixed number. Unknown/skipped falls back to a single day.
 */
const DAYS_BY_STAY: Record<string, number> = {
  '당일치기': 1,
  '1박 2일': 2,
  '2박 3일': 3,
  '3박 이상': 4,
};

/**
 * Timeline geometry. NORMALISED: Figma steps the cards by 565 (515 + 50 gap)
 * but the numbered circles by 566 (1625 / 2191 / 2757 / 3323), so its own stops
 * drift below their cards. Stepping by the card pitch keeps every number
 * centred on its card; stop 1 still lands within 3px of Figma's 1625.
 */
const STOP_TOP = 1628;
const STOP_STEP = 565;

/* ── QR block under the itinerary ──────────────────────────────────────
   Derived from .list in the CSS (left 310, top 1423, width 1678) and .spot
   (height 515, gap 50), so the QR tracks the ACTUAL number of cards rather than
   a baked y: the last day of a course can hold fewer than SPOTS_PER_DAY when the
   catalogue runs thin, and a fixed y would then float below empty space. */
const LIST_TOP = 1423;
const CARD_HEIGHT = 515;
const CARD_GAP = 50;
/** Gap between the last card's bottom edge and the QR. */
const QR_GAP = 30;
// The horizontal anchor is CSS-side: .qrRow uses `right: 172px`, which is
// 2160 − (.list left 310 + width 1678) = 2160 − 1988, so the QR's right edge sits
// on the cards' right edge. Keep the two in step if the list geometry moves.

/** Top of the QR row for `n` spot cards. */
const qrTopFor = (n: number): number =>
  LIST_TOP + n * CARD_HEIGHT + Math.max(0, n - 1) * CARD_GAP + QR_GAP;

/** QR frame side, and the round day arrow's, so the low-reach pair can centre on that row. */
const QR_SIZE = 150;
const ARROW_SIZE = 85;

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
   * TODO(제주 W006): AUTHORED PLACEHOLDERS. Nothing in the app computes a route,
   * so 소요시간 / 이동거리 / 난이도 (and the per-spot values below) are fixed text.
   * A kiosk telling every visitor "약 18Km" regardless of the actual itinerary
   * is the same class of problem as the home screen's flight board — wire a real
   * source, or drop these three stats from the bar.
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
 * Pick the itinerary: walk the chosen interests in order and take the first
 * unused shop matching each, cycling the interests until the day is full. Falls
 * back to any shop so a thin catalogue still yields a course.
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

export function JejuAiDetail({ controller }: Props): JSX.Element {
  const courseKey = useAiStore((s) => s.course);
  const interests = useAiStore((s) => s.interests);
  const transport = useAiStore((s) => s.transport);
  const stay = useAiStore((s) => s.stay);
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const lang = useLanguageStore((s) => s.currentLanguage) as Lang;

  const meta = COURSE_META[courseKey] ?? COURSE_META.nature!;
  const dayCount = DAYS_BY_STAY[stay] ?? 1;
  const [day, setDay] = useState(1);
  const lowReach = useAccessibilityStore((s) => s.lowReach);

  const goPrevDay = useCallback(() => setDay((d) => Math.max(1, d - 1)), []);
  const goNextDay = useCallback(() => setDay((d) => Math.min(dayCount, d + 1)), [dayCount]);

  // Build the whole trip once, then slice the visible day out of it, so a spot
  // never appears on two days.
  const allSpots = useMemo(
    () => buildSpots(interests, shops, SPOTS_PER_DAY * dayCount),
    [interests, shops, dayCount],
  );
  const spots = allSpots.slice((day - 1) * SPOTS_PER_DAY, day * SPOTS_PER_DAY);

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
  const firstLink = spots[0]?.naverLink ?? '';
  const qrLink = /^https?:\/\//i.test(firstLink) ? firstLink : null;

  const openSpot = (shop: Shop): void => {
    setDetail({
      from: 'ai_detail',
      // JejuDetail shows this as the header SUBTITLE for AI-course spots, so it
      // carries the course + day rather than a generic label.
      title: `${meta.label}코스 - ${day}일차`,
      name: shopName(shop, lang),
      category: shopSecondCategory(shop, lang),
      photos: shopImages(shop),
      address: shopAddress(shop, lang),
      hours: shop.openTime ?? '',
      phone: shop.tel ?? '',
      description: shopDescription(shop, lang),
      tags: shopHashtag(shop, lang),
      rating: shop.naverRating != null ? String(shop.naverRating) : '',
      instagram: '',
      blogReviews: shop.naverLink ?? '',
    });
    controller.navigate('detail', '코스 상세');
  };

  const stats: Array<{ label: string; value: string }> = [
    { label: '총 소요시간', value: meta.duration },
    // The only stat backed by real input: what the visitor picked on the
    // questionnaire. Falls back to the design's value if they skipped it.
    { label: '이동수단', value: transport || '자동차' },
    { label: '이동거리', value: meta.distance },
    { label: '난이도', value: meta.difficulty },
  ];

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

      {/* Day swiper. The arrows are always drawn — greyed at the ends, exactly
          as the Figma shows the left one on DAY 1 — so the row never reflows. */}
      <DayArrow dir="prev" disabled={day <= 1} onClick={goPrevDay} className={styles.dayPrev} />

      <p className={styles.day}>DAY {day}</p>

      <DayArrow dir="next" disabled={day >= dayCount} onClick={goNextDay} className={styles.dayNext} />

      {spots.length === 0 ? (
        <p className={styles.empty}>{pick(T.empty, lang)}</p>
      ) : (
        <>
          <div className={styles.rail} />
          {spots.map((shop, i) => (
            <span key={`stop-${shop.id}`} className={styles.stop} style={{ top: STOP_TOP + i * STOP_STEP }}>
              {i + 1}
            </span>
          ))}

          <div className={styles.list}>
            {spots.map((shop) => {
              // Falls back to the shared no-image placeholder, like the list
              // and detail cards; the empty slot stays only if even that is
              // missing from the asset folder.
              const photo = shopImages(shop)[0] ?? jejuIconUrl('noimage');
              return (
                <button key={shop.id} type="button" className={styles.spot} onClick={() => openSpot(shop)}>
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
                        <span className={styles.metaText}>{meta.spotDuration}</span>
                      </span>
                      <span className={styles.metaItem}>
                        {jejuIconUrl('ico-difficulty') && (
                          <img src={jejuIconUrl('ico-difficulty')} alt="" className={styles.metaIcon} draggable={false} />
                        )}
                        <span className={styles.metaText}>{meta.spotDifficulty}</span>
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* 모바일에서 확인하기 — label left, QR right, the QR's right edge flush
              with the cards' right edge and 30px below the last card.
              Rendered only when there is a real destination: a QR that scans to
              nothing is worse than no QR, which is how JejuSpotDetailCard treats
              its own. See `qrLink`. */}
          {qrLink && (
            <div className={styles.qrRow} style={{ top: qrTopFor(spots.length) }}>
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
          {lowReach && dayCount > 1 && (
            <>
              <DayArrow
                dir="prev"
                disabled={day <= 1}
                onClick={goPrevDay}
                className={styles.dayPrevBottom}
                style={{ top: bottomPagerTopFor(spots.length) }}
              />
              <DayArrow
                dir="next"
                disabled={day >= dayCount}
                onClick={goNextDay}
                className={styles.dayNextBottom}
                style={{ top: bottomPagerTopFor(spots.length) }}
              />
            </>
          )}
        </>
      )}
    </JejuPageFrame>
  );
}
