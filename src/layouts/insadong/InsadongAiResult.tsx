import { useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useAiStore } from '@renderer/store/aiStore';
import { useShopStore } from '@renderer/store/shopStore';
import { useDetailStore } from '@renderer/store/detailStore';
import type { Lang } from '@renderer/lib/i18n';
import { useLang } from '@renderer/lib/i18n';
import { t, tPlain } from '@renderer/lib/loc';
import type { Shop } from '@shared/types/shop';
import {
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopSecondCategory,
  stripPrefix,
} from '@renderer/lib/shops';
import { InsadongHeader } from './InsadongHeader';
import { InsadongLeftNav } from './InsadongLeftNav';
import styles from './InsadongAiResult.module.css';

/**
 * '인사' 뭐하지 (AI 검색) — recommendation RESULTS.
 *
 * Second step of the AI-search flow (Figma "#아이콘04>인사 모하지(AI)"):
 *  • Overview (-02): three candidate courses (A·B·C코스) side by side, each
 *    showing the first few spots.
 *  • Tap a course tab → that course's FULL filtered list (-03): wide cards.
 *  • Tap any spot card → detail page (-04, InsadongAiDetail).
 *
 * Spot data mirrors the Figma placeholder content; wire it to the AI
 * recommendation backend when available.
 */
interface CourseSpot {
  category: string;
  title: string;
  image: string;
  tags: string;
  shop?: Shop;
}
interface Course {
  name: string;
  spots: CourseSpot[];
}

/** Course-picker heading + subheading — Localization rows, so a copy edit needs
 *  no code change and all eight languages come from the sheet. */
const HEADING_KEY = 'AI_CourseContent_1';
const HEADING_SUB_KEY = 'AI_CourseContent_2';

const FALLBACK_INTERESTS = ['전시관', '한식', '카페'];
/** Course tab names — Localization rows, so a copy edit needs no code change. */
const COURSE_KEYS = ['ACourse', 'BCourse', 'CCourse'] as const;

/** A shop matches an interest if its second- or AI-category (prefix stripped) equals it. */
const catMatches = (shop: Shop, cat: string): boolean =>
  stripPrefix(shop.secondCategoryKr ?? '') === cat || stripPrefix(shop.aiCategoryKr ?? '') === cat;

/**
 * Build the 3 courses from the user's selected interests using REAL shops — one
 * card per interest, in the chosen order; course A/B/C each pick a different shop
 * for the same interest. Falls back to a no-image card when no shop matches.
 */
function buildCourses(interests: string[], shops: Shop[], lang: Lang, noImage: string): Course[] {
  const cats = interests.length ? interests.slice(0, 3) : FALLBACK_INTERESTS;
  return COURSE_KEYS.map((key, ci) => ({
    name: t(key, lang),
    spots: cats.map((cat) => {
      const matches = shops.filter((s) => catMatches(s, cat));
      const shop = matches.length ? matches[ci % matches.length] : undefined;
      if (shop) {
        return {
          category: shopSecondCategory(shop, lang) || cat,
          title: shopName(shop, lang),
          image: shopImages(shop)[0] ?? noImage,
          tags: shopHashtag(shop, lang),
          shop,
        };
      }
      return { category: cat, title: cat, image: noImage, tags: '', shop: undefined };
    }),
  }));
}

/** Figma "Vector 11/13" — down chevron between course steps (#999 stroke). */
function ChevronDown(): JSX.Element {
  return (
    <svg className={styles.chevron} viewBox="0 0 51.48 30.03" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4.29 4.29L25.74 25.74L47.19 4.29" stroke="#999999" strokeWidth="8.58" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface InsadongAiResultProps {
  controller: KioskController;
  debug?: boolean;
}

export function InsadongAiResult({ controller }: InsadongAiResultProps): JSX.Element {
  const banner = useRotatingBanner();
  const goHome = (): void => controller.navigate('home', 'Back');
  const goBack = (): void => controller.navigate('ai_search', 'Back');

  const lang = useLang();
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const noImg = iconUrl('noimage') ?? '';

  // Cards are built from the interests the user picked, using REAL shop data.
  const interests = useAiStore((s) => s.interests);
  const courses = buildCourses(interests, shops, lang, noImg);

  /** Open a spot — show its real shop detail (or the AI detail when none). */
  const openSpot = (spot: CourseSpot): void => {
    const shop = spot.shop;
    if (!shop) {
      controller.navigate('ai_detail', '상세');
      return;
    }
    setDetail({
      from: controller.screen,
      title: '‘인사’ 뭐하지 (AI 검색)',
      name: shopName(shop, lang),
      category: shopSecondCategory(shop, lang),
      photos: shopImages(shop).length ? shopImages(shop) : noImg ? [noImg] : [],
      address: shopAddress(shop, lang),
      hours: shop.openTime ?? '',
      phone: shop.tel ?? '',
      description: shopDescription(shop, lang),
      tags: shopHashtag(shop, lang),
      rating: shop.naverRating != null ? String(shop.naverRating) : '',
      instagram: '',
      blogReviews: shop.naverLink ?? '',
    });
    controller.navigate('detail', 'AI 추천 상세');
  };

  // null = overview (3 columns); 0/1/2 = that course's full filtered list.
  const [selected, setSelected] = useState<number | null>(null);

  const onTab = (i: number): void => setSelected((prev) => (prev === i ? null : i));

  // Peach "folder" cap geometry (Figma 코스Border). Tabs stay full-width / flush
  // in their row (gap ≈63, like Figma); the peach folder is OVERSIZED — it
  // extends CAP_PAD beyond the row on every side (the panel below is widened to
  // match), so the flush tabs get an equal peach margin all around. The cap
  // wraps the selected tab and its outer edge meets the widened panel edge.
  const TAB_W = 565;
  const ROW_W = 1816.802;
  const CAP_PAD = 40;
  const TAB_GAP = (ROW_W - TAB_W * 3) / 2;
  const tabLeft = selected === null ? 0 : selected * (TAB_W + TAB_GAP);
  const capLeft = tabLeft - CAP_PAD;
  const capWidth = TAB_W + CAP_PAD * 2;

  const tabs = (
    <div className={styles.tabs}>
      {courses.map((c, i) => (
        <button
          key={c.name}
          type="button"
          className={`${styles.tab} ${selected === i ? styles.tabActive : ''}`}
          onClick={() => onTab(i)}
        >
          {c.name}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title="‘인사’ 뭐하지 (AI 검색)" onHome={goHome} onBack={goBack} />

      <div className={styles.content}>
        {selected === null ? (
          /* ── Overview: tabs as column headers + three columns ── */
          <>
            {tabs}
            <div className={styles.columns}>
              {courses.map((course) => (
                <div key={course.name} className={styles.column}>
                  {course.spots.map((spot, i) => (
                    <button key={i} type="button" className={styles.spot} onClick={() => openSpot(spot)}>
                      <div className={styles.spotInner}>
                        <div className={styles.spotHead}>
                          <p className={styles.spotCategory}>{spot.category}</p>
                          <p className={styles.spotTitle}>{spot.title}</p>
                        </div>
                        <div className={styles.spotImageWrap}>
                          <img className={styles.spotImage} src={spot.image} alt="" draggable={false} />
                        </div>
                        <div className={styles.spotTags}>{spot.tags}</div>
                      </div>
                      <ChevronDown />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : (
          /* ── A course selected: peach folder wraps the tab + full list ── */
          <div className={styles.folder}>
            {/* peach cap behind the selected tab, bridging into the panel */}
            <span className={styles.cap} style={{ left: `${capLeft}px`, width: `${capWidth}px` }} />
            {tabs}
            <div
              className={styles.course}
              style={{
                /* Square the panel corner the cap meets so the selected tab flows
                   straight into the body (no rounded notch on the first/last tab). */
                borderTopLeftRadius: selected === 0 ? 0 : undefined,
                borderTopRightRadius: selected === courses.length - 1 ? 0 : undefined,
              }}
            >
              <div className={styles.courseHeading}>
                <p className={styles.courseHeadingTitle}>
                  {/* The panel draws its own bullet, so use the marker-free value. */}
                  <span className={styles.dot} />
                  {tPlain(HEADING_KEY, lang)}
                </p>
                <p className={styles.courseHeadingSub}>{tPlain(HEADING_SUB_KEY, lang)}</p>
              </div>

              <div className={styles.courseList}>
                {courses[selected]!.spots.map((spot, i, arr) => (
                  <div key={i} className={styles.wideCardWrap}>
                    <button type="button" className={styles.wideCard} onClick={() => openSpot(spot)}>
                      <div className={styles.wideImageWrap}>
                        <img className={styles.wideImage} src={spot.image} alt="" draggable={false} />
                      </div>
                      <div className={styles.wideBody}>
                        <div className={styles.wideHead}>
                          <span className={styles.wideTitle}>{spot.title}</span>
                          <span className={styles.wideCat}>
                            <span className={styles.dotSmall} />
                            {spot.category}
                          </span>
                        </div>
                        <p className={styles.wideTags}>{spot.tags}</p>
                      </div>
                    </button>
                    {i < arr.length - 1 && <ChevronDown />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <InsadongLeftNav onHome={goHome} onBack={goBack} />

      {banner && (
        <button type="button" className={styles.banner} onClick={() => controller.startPhoto()} aria-label="가상 한복 체험">
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </>
  );
}
