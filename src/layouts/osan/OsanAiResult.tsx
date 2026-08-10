import { useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useAiStore } from '@renderer/store/aiStore';
import { useShopStore } from '@renderer/store/shopStore';
import { useDetailStore } from '@renderer/store/detailStore';
import type { Lang } from '@renderer/lib/i18n';
import { pick, useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
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
import { OsanHeader } from './OsanHeader';
import { OsanBanner } from './OsanBanner';
import { interestColor } from './interestColors';
import styles from './OsanAiResult.module.css';

const HEADING = {
  ko: '맞춤 코스가 준비되었어요!',
  en: 'Your custom course is ready!',
  ja: 'おすすめコースが完成しました！',
  zh: '为您准备好了专属路线！',
};
const HEADING_SUB = {
  ko: '인기 장소, 숨은 명소, 균형 잡힌 코스 중에서 선택해 오색시장을 즐겨보세요.',
  en: 'Pick from popular spots, hidden gems, and balanced courses to enjoy Osaek Market.',
  ja: '人気スポット・穴場・バランス型コースから選んでオセク市場を楽しんでください。',
  zh: '从热门景点、隐藏好去处和均衡路线中选择，尽情游览五色市场。',
};

const FALLBACK_INTERESTS = ['전시관', '한식', '카페'];
/** Course tab names — Localization rows, so a copy edit needs no code change. */
const COURSE_KEYS = ['ACourse', 'BCourse', 'CCourse'] as const;

const catMatches = (shop: Shop, cat: string): boolean =>
  stripPrefix(shop.secondCategoryKr ?? '') === cat || stripPrefix(shop.aiCategoryKr ?? '') === cat;

interface CourseSpot {
  category: string;
  /** Canonical KO category — drives the accent dot colour. */
  categoryKr: string;
  title: string;
  image: string;
  tags: string;
  shop?: Shop;
}
interface Course {
  name: string;
  spots: CourseSpot[];
}

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
          categoryKr: stripPrefix(shop.secondCategoryKr ?? '') || cat,
          title: shopName(shop, lang),
          image: shopImages(shop)[0] ?? noImage,
          tags: shopHashtag(shop, lang),
          shop,
        };
      }
      return { category: cat, categoryKr: cat, title: cat, image: noImage, tags: '', shop: undefined };
    }),
  }));
}

/** Figma down-chevron between spots (Vector 11/13). */
function ChevronDown(): JSX.Element {
  return (
    <svg className={styles.chevron} viewBox="0 0 51.48 30.03" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4.29 4.29L25.74 25.74L47.19 4.29" stroke="#999999" strokeWidth="8.58" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface OsanAiResultProps {
  controller: KioskController;
}

export function OsanAiResult({ controller }: OsanAiResultProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const goBack = (): void => controller.navigate('ai_search', 'Back');
  const lang = useLang();
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const noImg = osanIconUrl('noimage') ?? '';

  const interests = useAiStore((s) => s.interests);
  const courses = buildCourses(interests, shops, lang, noImg);

  // null = overview (3 columns); 0/1/2 = that course's wide-card list.
  const [selected, setSelected] = useState<number | null>(null);

  const openSpot = (spot: CourseSpot): void => {
    const shop = spot.shop;
    if (!shop) {
      controller.navigate('ai_detail', '상세');
      return;
    }
    setDetail({
      from: controller.screen,
      title: "'정이' 모하지 (AI 검색)",
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

  // Folder-cap geometry (Insadong-style selected tab): the cap rises CAP_PAD
  // around the selected tab and bridges down into the #D3DFEC panel below.
  const TAB_W = 565;
  const ROW_W = 1820;
  const CAP_PAD = 40;
  const TAB_GAP = (ROW_W - TAB_W * 3) / 2; // 62.5
  const capLeft = (selected ?? 0) * (TAB_W + TAB_GAP) - CAP_PAD;
  const capWidth = TAB_W + CAP_PAD * 2;

  const tabs = (
    <div className={styles.tabs}>
      {courses.map((c, i) => (
        <button
          key={c.name}
          type="button"
          className={`${styles.tab} ${selected === i ? styles.tabActive : ''}`}
          onClick={() => setSelected((prev) => (prev === i ? null : i))}
        >
          {c.name}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {osanIconUrl('bg') && <img className={styles.bg} src={osanIconUrl('bg')} alt="" draggable={false} />}

      <OsanHeader title="'정이' 모하지(AI 검색)" onHome={goHome} onBack={goBack} />

      {selected === null ? (
        /* ── Overview: 3 course columns ── */
        <div className={styles.content}>
          {tabs}
          <div className={styles.columns}>
            {courses.map((course) => (
              <div key={course.name} className={styles.column}>
                {course.spots.map((spot, i) => (
                  <button key={i} type="button" className={styles.spot} onClick={() => openSpot(spot)}>
                    <div className={styles.spotInner}>
                      <div className={styles.spotHead}>
                        <span className={styles.spotCategory}>{spot.category}</span>
                        <span className={styles.spotTitle}>{spot.title}</span>
                      </div>
                      <div className={styles.spotImageWrap}>
                        <img className={styles.spotImage} src={spot.image} alt="" draggable={false} />
                      </div>
                      <p className={styles.spotTags}>{spot.tags}</p>
                    </div>
                    {i < course.spots.length - 1 && <ChevronDown />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── Selected course: navy folder — a #D3DFEC cap behind the selected tab
           bridges into the panel below (same folder style as Insadong). ── */
        <div className={styles.contentSelected}>
          <div className={styles.folder}>
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
              <div className={styles.heading}>
                <p className={styles.headingTitle}>
                  <span className={styles.headingDot} />
                  {pick(HEADING, lang)}
                </p>
                <p className={styles.headingSub}>{pick(HEADING_SUB, lang)}</p>
              </div>
              <div className={styles.list}>
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
                            <span
                              className={styles.dotSmall}
                              style={{ background: interestColor(spot.categoryKr) }}
                            />
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
        </div>
      )}

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="홈으로">
          {osanIconUrl('home-btn') && <img src={osanIconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={goBack} aria-label="뒤로">
          {osanIconUrl('back-arrow') && <img src={osanIconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>

      <OsanBanner onClick={() => controller.startPhoto()} />
    </>
  );
}
