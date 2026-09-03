/**
 * 제주 shop category list — one screen for all three Figma frames, which draw the
 * byte-identical layout and differ only in their title and chip set:
 *   6212:55184  "'제주' 뭐먹지?"  (eat)     10 chips, 5×2 (also 6391:57961,
 *                                          the same frame with nothing picked)
 *   6212:55233  "'제주' 뭐사지?"  (shop)    10 chips, 5×2 (also 6390:57326,
 *                                          the same frame with 기념품 picked)
 *   6212:55282  "숙박안내"        (lodging)  5 chips, one row (also 6391:58267,
 *                                          the same frame with nothing picked)
 * The first two carry the same stale frame name ("제주>하영뭐사지=공항-01") — the
 * title inside Component 30 is what distinguishes them. The chip row's height is
 * the ONLY layout difference between them (170 vs 375), and the grid derives it,
 * so the 50px gaps below and every card y follow automatically — verified
 * 2026-08-24 against the lodging frames, whose single 170 row puts the 초성 index
 * on 920 and the first card on 1042 exactly as Figma draws them (the two-row
 * screens land on 1125 / 1247).
 *
 * A category chip grid (5 per row) + a 초성 index row over the shared shop card
 * list. Same data path the other layouts' list screens use: filter the shops to
 * this screen's base category, derive the second-category chips from what the
 * data actually contains, and open the shared detail on tap.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { KioskScreenId } from '@shared/types/kiosk';
import type { Shop } from '@shared/types/shop';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import { catLabel } from '@renderer/lib/i18n';
import { leadingChosung, type Chosung } from '@renderer/lib/chosung';
import {
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopOpenTime,
  shopSecondCategory,
  shopsForBase,
} from '@renderer/lib/shops';
import { JejuChosungRow } from './JejuChosungRow';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { JejuPageFrame } from './JejuPageFrame';
import { JejuShopCard } from './JejuShopCard';
import styles from './JejuListScreen.module.css';

/** The screens this one file serves. */
export type JejuListScreenId = Extract<KioskScreenId, 'eat' | 'shop' | 'lodging'>;

interface Props {
  screen: JejuListScreenId;
  controller: KioskController;
}

/**
 * Base category (witteria `baseCategoryKr`) per screen. Every layout has its own
 * prefix — 인사동 '인사 뭐먹지', 오산 '정이 뭐먹지', 화성 '휴 뭐먹지'.
 *
 * VERIFIED 2026-08-12 against the live catalogue (`/api/shops?kioskId=7`, prod
 * and stage): 제주 uses the LOCATION prefix, not the 하영 mascot the Figma frame
 * names suggested, and 숙박 is the bare '숙박안내' with no prefix at all. The four
 * base categories the API returns are exactly:
 *   제주 뭐하지 (136) · 제주 뭐먹지 (58) · 제주 뭐사지 (48) · 숙박안내 (68)
 * 제주 뭐하지 is the 관광명소 grid on 여기는 제주도 — see JejuAbout.
 */
const BASE_CATEGORY: Record<JejuListScreenId, string> = {
  eat: '제주 뭐먹지',
  shop: '제주 뭐사지',
  lodging: '숙박안내',
};

/** Header title id — localized by JejuHeader (숙박안내 resolves via the sheet). */
const TITLE: Record<JejuListScreenId, string> = {
  eat: "'제주' 뭐먹지?",
  shop: "'제주' 뭐사지?",
  lodging: '숙박안내',
};

/** Chips per row — Figma's `R>상단 카테고리-5개*2` is a 5-wide grid. */
const CHIP_COLS = 5;
/* The standard list top (y700, under the 700px header) lives in the CSS as
   `.scroll`; only the low-reach top is needed here, to hang the controls. */
/** Low-reach list top — under the mode bar + header (Figma 6561:80628). */
const LIST_TOP_LOW = 837;
/** Low-reach: gap between the list's bottom edge and the controls block. */
const LOW_CONTROLS_GAP = 100;

/**
 * Figma-parity chips, shown only while no shop data has loaded — the real list
 * is derived from the data, exactly as the other layouts do it. Mirrors
 * HwaseongKiosk's FOOD_TABS.
 *
 * Each set is what its frame draws, in frame order (6212:55190 eat, I6212:55239
 * shop, 6212:55288 lodging). Every label is localized through `catLabel`, so
 * adding one here means adding it to CATEGORY_LABELS too — an unmapped label
 * renders Korean in all 8 languages with no error.
 */
const DEFAULT_TABS: Record<JejuListScreenId, string[]> = {
  eat: [
    '흑돼지',
    '해산물·회',
    '갈치·고등어',
    '고기국수',
    '제주 향토음식',
    '한식',
    '한정식',
    '호텔뷔페',
    '카페',
    '기타',
  ],
  shop: [
    '기념품',
    '특산품',
    '먹거리',
    '감귤·농산물',
    '수산물·해산물',
    '전통주·차',
    '공예품',
    '제주 굿즈',
    '체험 기념품',
    '기타',
  ],
  // Written '리조트·콘도' and '독채·단독이용' with the middle dot the DATA uses —
  // these are ids matched against the catalogue's own strings, not display copy,
  // so they follow it rather than the frame's slash.
  lodging: ['호텔', '펜션', '리조트·콘도', '게스트하우스', '독채·단독이용'],
};

/** One scroll-button press moves by a card + its gap. */
const SCROLL_STEP = 590;

export function JejuListScreen({ screen, controller }: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const setDetail = useDetailStore((s) => s.setItem);
  const shops = useShopStore((s) => s.shops);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const [activeKr, setActiveKr] = useState<string | null>(null);
  const [jamo, setJamo] = useState<Chosung | null>(null);
  /**
   * The 초성 row is a KOREAN-only control: it filters on the leading jamo of the
   * shop's Korean name, so on any other language it is a row of glyphs the
   * visitor cannot read filtering on a name they are not being shown. Hidden
   * outside Korean, exactly as JejuAbout's 관광명소 grid does it.
   */
  const showChosung = lang === 'ko';

  /**
   * Leaving Korean must also drop an ACTIVE filter, not just the control —
   * otherwise a visitor who taps ㅅ and then switches to English is left on a
   * short list with no visible reason and no way to clear it.
   */
  useEffect(() => {
    if (!showChosung && jamo !== null) setJamo(null);
  }, [showChosung, jamo]);

  const baseShops = useMemo(() => shopsForBase(shops, BASE_CATEGORY[screen]), [shops, screen]);

  // Distinct second categories present in the data, ordered by the sheet's "N-"
  // prefix and labelled in the current language.
  const tabs = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of baseShops) {
      const kr = s.secondCategoryKr;
      if (kr && !map.has(kr)) map.set(kr, shopSecondCategory(s, lang));
    }
    return [...map.entries()]
      .map(([kr, label]) => ({ kr, label }))
      .sort((a, b) => (parseInt(a.kr, 10) || 999) - (parseInt(b.kr, 10) || 999));
  }, [baseShops, lang]);

  const chips =
    tabs.length > 0
      ? tabs
      : DEFAULT_TABS[screen].map((label) => ({ kr: label, label: catLabel(label, lang) }));

  /*
   * Low-reach geometry follows the chip ROW COUNT, because the controls sit at
   * the foot and a shorter chip block gives the list back the space:
   *
   *   2 rows (eat/shop, 10 categories)  list h2296, controls y3233
   *   1 row  (lodging, 5 categories)    list h2501, controls y3438
   *
   * The one-row values are measured on the mode-bar revision template
   * 6561:80628 (list y837–3338, chips 3438, 초성 3658); the two-row pair is
   * derived from it by one chip row + its 35 gap (205), keeping the 초성 row on
   * its ~3658 anchor — the revised two-row frames have not been shared. Both
   * fall out of one rule — the controls hang 100px under the list — so only the
   * list height is a constant here.
   */
  const chipRows = Math.ceil(chips.length / CHIP_COLS);
  const lowListHeight = chipRows >= 2 ? 2296 : 2501;
  const lowControlsTop = LIST_TOP_LOW + lowListHeight + LOW_CONTROLS_GAP;

  const visible = useMemo(() => {
    let list = activeKr ? baseShops.filter((s) => s.secondCategoryKr === activeKr) : baseShops;
    // The 초성 row indexes the shop NAME, and always the Korean one: the buckets
    // are Korean consonants, so filtering a translated name would empty the list
    // for every non-Korean visitor.
    if (jamo) list = list.filter((s) => leadingChosung(shopName(s, 'ko')) === jamo);
    return list;
  }, [baseShops, activeKr, jamo]);

  const scrollBy = (delta: number): void =>
    scrollRef.current?.scrollBy({ top: delta, behavior: 'smooth' });

  // Re-filtering leaves the view scrolled into a list that no longer exists.
  const resetScroll = (): void => scrollRef.current?.scrollTo({ top: 0 });

  const openDetail = (shop: Shop): void => {
    setDetail({
      from: screen,
      // Verbatim: the detail header reads "'제주' 뭐먹지? > 상세" (6212:55208) /
      // "'제주' 뭐사지? > 상세" (6212:55257), quotes and question mark included.
      // JejuDetail appends the " > 상세".
      title: TITLE[screen],
      name: shopName(shop, lang),
      category: shopSecondCategory(shop, lang),
      photos: shopImages(shop),
      address: shopAddress(shop, lang),
      hours: shopOpenTime(shop.openTime),
      phone: shop.tel ?? '',
      description: shopDescription(shop, lang),
      tags: shopHashtag(shop, lang),
      rating: shop.naverRating != null ? String(shop.naverRating) : '',
      instagram: '',
      blogReviews: shop.naverLink ?? '',
      rentcarRoute: shop.route ?? null,
    });
    controller.navigate('detail', TITLE[screen]);
  };

  /* The category chips and the 초성 index. In the standard layout they scroll
     with the cards; in low-reach they are pulled out of the scroller and pinned
     to the foot of the page — same markup either way, see .controlsLow. */
  const controls = (
    <>
      {/* `catsIdle` while nothing is picked — the whole row is drawn in the
            brand colour then, and only falls back to grey once one chip takes
            the solid plate. See the note above .catsIdle. */}
      <div className={`${styles.cats} ${activeKr === null ? styles.catsIdle : ''}`}>
        {chips.map((c) => (
          <button
            key={c.kr}
            type="button"
            className={`${styles.chip} ${c.kr === activeKr ? styles.chipActive : ''}`}
            onClick={() => {
              // Tapping the active chip clears it — there is no "전체" chip.
              setActiveKr((prev) => (prev === c.kr ? null : c.kr));
              resetScroll();
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {showChosung && (
        <JejuChosungRow
          className={styles.chosung}
          /* 14 × 120.43 = 1686, Figma's x237–1923 for the ㄱ…ㅎ run. The
             low-reach frames set the row wider — their text box is x208–1952
             (1744, measured ink 220–1943) — so the cells grow with it rather
             than leaving the run narrow against a wider slot. Both centre on
             x1080. */
          cellWidth={lowReach ? 124.57 : 120.43}
          value={jamo}
          onChange={(next) => {
            setJamo(next);
            resetScroll();
          }}
        />
      )}
    </>
  );

  return (
    /* No banner: the list runs to the bottom of the artboard in this frame.
       ♿ is on the 2026-08-26 mode-bar revision (template 6561:80628): bar at
       the top, header at y113; the list/controls position themselves, so the
       body shift stays 0. */
    <JejuPageFrame
      controller={controller}
      title={TITLE[screen]}
      showBanner={false}
      lowReachModeBar
      lowReachShift={113}
    >
      <div
        className={`${styles.scroll} ${lowReach ? styles.scrollLow : ''}`}
        style={lowReach ? { height: lowListHeight } : undefined}
        ref={scrollRef}
      >
        {!lowReach && controls}
        {visible.length > 0 ? (
          <div className={styles.list}>
            {visible.map((shop) => (
              <JejuShopCard
                key={shop.id}
                shop={shop}
                lang={lang}
                onClick={() => openDetail(shop)}
              />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>
            {baseShops.length === 0 ? '준비중입니다' : '조건에 맞는 상점이 없습니다'}
          </p>
        )}
      </div>

      {lowReach && (
        <div className={styles.controlsLow} style={{ top: lowControlsTop }}>
          {controls}
        </div>
      )}

      <button
        type="button"
        className={`${styles.scrollBtn} ${styles.scrollUp}`}
        onClick={() => scrollBy(-SCROLL_STEP)}
        aria-label="위로"
      >
        {jejuIconUrl('scroll-arrow') && (
          <img
            src={jejuIconUrl('scroll-arrow')}
            alt=""
            className={styles.scrollBtnImg}
            draggable={false}
          />
        )}
      </button>
      <button
        type="button"
        className={`${styles.scrollBtn} ${styles.scrollDown}`}
        onClick={() => scrollBy(SCROLL_STEP)}
        aria-label="아래로"
      >
        {jejuIconUrl('scroll-arrow') && (
          <img
            src={jejuIconUrl('scroll-arrow')}
            alt=""
            className={styles.scrollBtnImg}
            draggable={false}
          />
        )}
      </button>

      {/* The frames' bottom-right ▲▼ pair (6212:55250 / 6212:55201) used to be
          drawn here as a second scroll control (JejuScrollHint). Removed
          2026-09-03 by request: these three screens ALSO carry the right-hand
          ▲▼ circles above, at the visitor's own eye level, and two controls
          doing exactly the same thing in two corners is one too many. The
          corner triangles are the further away and the smaller of the pair, so
          they are the ones that go. JejuScrollHint itself stays — 렌트카 still
          renders it. */}
    </JejuPageFrame>
  );
}
