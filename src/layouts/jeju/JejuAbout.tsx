/**
 * 여기는 제주도 — Figma node 6212:59045 (제주>여기는 제주도, 역사 tab).
 *
 * Three tabs (역사 / 문화 / 관광명소). Each tab is its own Figma frame with its
 * OWN layout, not a shared template — only 역사 uses the white panel:
 *   역사        6212:59045  white panel: gallery + intro, timeline bar, epoch prose
 *   문화        6212:59093  one white panel: intro + four 806×1014 shadowed cards
 *   관광명소     6212:59152  no panel; 초성 index over a scrolling 3-wide card grid
 * The tab row is the only thing all three share, and it is the same row on all
 * three frames.
 *
 * 관광명소 drills down IN PLACE (6212:59326): tapping a card swaps the grid for
 * the shared 상세 card, keeping this page's header, tabs and 초성 row. It is not
 * the `detail` screen — that one composes its own "<page> > 상세" header and
 * would come back to the 역사 tab, losing where the visitor was.
 */
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import type { Shop } from '@shared/types/shop';
import { isOk } from '@shared/types/result';
import type { DetailItem } from '@renderer/store/detailStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useShopStore } from '@renderer/store/shopStore';
import { useAttractionStore } from '@renderer/store/attractionStore';
import { pick, type Lang } from '@renderer/lib/i18n';
import { hasLoc, sheetText, t, tExact } from '@renderer/lib/loc';
import { leadingChosung, type Chosung } from '@renderer/lib/chosung';
import {
  shopAddress,
  shopCategoryLabel,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopsForBase,
} from '@renderer/lib/shops';
import { trackEvent } from '@renderer/lib/analytics';
import { JejuAttractionCard } from './JejuAttractionCard';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { JejuChosungRow } from './JejuChosungRow';
import { JejuPageFrame } from './JejuPageFrame';
import { JejuSpotDetailCard } from './JejuSpotDetailCard';
import { JejuTabRow } from './JejuTabRow';
import styles from './JejuAbout.module.css';

import history1 from '@renderer/assets/photos/jeju/about/history-1.jpg';
import history2 from '@renderer/assets/photos/jeju/about/history-2.jpg';
import history3 from '@renderer/assets/photos/jeju/about/history-3.jpg';
import history4 from '@renderer/assets/photos/jeju/about/history-4.jpg';
import history5 from '@renderer/assets/photos/jeju/about/history-5.jpg';
import history6 from '@renderer/assets/photos/jeju/about/history-6.jpg';
import cultureHaenyeo from '@renderer/assets/photos/jeju/about/culture-haenyeo.jpg';
import cultureStone from '@renderer/assets/photos/jeju/about/culture-stone.jpg';
import cultureLiving from '@renderer/assets/photos/jeju/about/culture-living.jpg';
import cultureFood from '@renderer/assets/photos/jeju/about/culture-food.jpg';

type TabId = 'history' | 'culture' | 'attractions';

/**
 * Tabs — 관광명소 FIRST, then the frames' 역사 / 문화.
 *
 * The Figma frames order them 역사 / 문화 / 관광명소 (6212:59071 / 59073 /
 * 59075); 관광명소 was moved to the head on 2026-08-24 by request — it is the
 * tab visitors actually come for, and it also becomes the landing tab (the
 * `tab` state initialises to the first entry's id).
 *
 * Labels come from Localization_Jeju — Here_History / Here_Culture /
 * Here_Attraction, all three filled in every one of the eight languages. The
 * objects below are the fallback used only if a key vanishes from the sheet;
 * `sheetText` keeps the sheet's own per-language cell ahead of them so an
 * empty ja cell falls to the authored Japanese, not to Korean.
 */
const TABS = [
  { id: 'attractions', key: 'Here_Attraction', label: { ko: '관광명소', en: 'Attractions', ja: '観光名所', zh: '旅游景点', vi: 'Điểm tham quan', th: 'สถานที่ท่องเที่ยว', ru: 'Достопримечательности', id: 'Tempat Wisata' } },
  { id: 'history', key: 'Here_History', label: { ko: '역사', en: 'History', ja: '歴史', zh: '历史', vi: 'Lịch sử', th: 'ประวัติศาสตร์', ru: 'История', id: 'Sejarah' } },
  { id: 'culture', key: 'Here_Culture', label: { ko: '문화', en: 'Culture', ja: '文化', zh: '文化', vi: 'Văn hóa', th: 'วัฒนธรรม', ru: 'Культура', id: 'Budaya' } },
] as const satisfies ReadonlyArray<{ id: TabId; key: string; label: Record<string, string> }>;

// Copy resolution is `t()` from lib/loc — Localization_Jeju fills the about-tab
// keys in all eight languages.

const COMING_SOON = {
  ko: '준비중입니다',
  en: 'Coming soon',
  ja: '準備中です',
  zh: '正在准备中',
  vi: 'Đang chuẩn bị',
  th: 'กำลังเตรียมการ',
  ru: 'В подготовке',
  id: 'Sedang disiapkan',
};

/**
 * The 역사 gallery. The hero cycles through all six; the filmstrip draws five at
 * the widths Figma gives each one (they are aspect-driven crops at h210), and
 * tapping one brings it into the hero.
 *
 * PROVENANCE: these are the stock photos the Figma frame uses (Unsplash /
 * Freepik originals, re-encoded down from 26MB total to 345KB — the originals
 * were up to 4096px for a 361px slot). They are the design's own content, but
 * they are stock, so swap in licensed 제주 photography before launch.
 */
const GALLERY = [
  { src: history1 },
  { src: history2 },
  { src: history3 },
  { src: history4 },
  { src: history5 },
  { src: history6 },
];
/** Vertical filmstrip beside the hero — indices 1..5 in frame order. */
const THUMBS = [1, 2, 3, 4, 5];

/** Timeline emoji — one per stage (1=선사 … 6=현재). Paste from the design sheet. */
const HISTORY_FLOW_EMOJI = ['🪨', '👑', '🏯', '📜', '🇰🇷', ' 🌋'] as const;

/**
 * 문화 cards (6212:59098), in frame order — reading order is row-major, so the
 * 2×2 grid falls out of the array without any per-card positioning.
 *
 * `focus` is the object-position each photo is cropped to in the frame: every
 * source is 3:2 and every slot is 650×379, so ~14% of the height is cropped and
 * Figma anchors that crop differently per photo (top / centre / bottom). Getting
 * it wrong beheads the 돌하르방 in 제주 생활문화.
 *
 * PROVENANCE: same as the 역사 gallery — these are the frame's own stock photos
 * (Unsplash originals, re-encoded from 19MB to 445KB; two were 4096px wide for a
 * 650px slot). Swap in licensed 제주 photography before launch.
 *
 * Title and body copy come from Localization_Jeju (`Here_CultureContent_N_title`
 * / `Here_CultureContent_N`). Photos and crop anchors stay here — bundled assets,
 * not sheet content.
 */
const CULTURE = [
  {
    id: 'haenyeo',
    photo: cultureHaenyeo,
    focus: 'center',
    titleKey: 'Here_CultureContent_1_title',
    bodyKey: 'Here_CultureContent_1',
  },
  {
    id: 'stone',
    photo: cultureStone,
    focus: 'bottom',
    titleKey: 'Here_CultureContent_2_title',
    bodyKey: 'Here_CultureContent_2',
  },
  {
    id: 'living',
    photo: cultureLiving,
    focus: 'bottom',
    titleKey: 'Here_CultureContent_3_title',
    bodyKey: 'Here_CultureContent_3',
  },
  {
    id: 'food',
    photo: cultureFood,
    focus: 'top',
    titleKey: 'Here_CultureContent_4_title',
    bodyKey: 'Here_CultureContent_4',
  },
] as const satisfies ReadonlyArray<{
  id: string;
  photo: string;
  focus: 'top' | 'center' | 'bottom';
  titleKey: string;
  bodyKey: string;
}>;

/**
 * Fallback source for the 관광명소 grid: the general shop catalogue filtered to
 * this base category.
 *
 * This USED to be the only source. `/api/jeju/attractions` now supplies a
 * curated list and is preferred; this stays as the offline/first-launch
 * fallback, because the shop catalogue is fetched by the same launch sync and a
 * kiosk that has one cached but not the other should still show a grid.
 *
 * The two are not the same rows. VERIFIED 2026-08-12 against
 * `/api/shops?kioskId=7`: '제주 뭐하지' is 136 rows across 해녀 체험, 감귤 체험,
 * 승마 체험, 레저·액티비티, 사진 촬영, 자연명소, 해변, 섬 여행, 오름·트래킹,
 * 역사유적지 and 전시관·문화공간 — the first five of which are ACTIVITIES that do
 * not belong under 관광명소. The attractions endpoint returns only the other
 * six (101 rows, verified against stage 2026-08-14), which is the actual reason
 * to prefer it. Falling back therefore widens the list rather than emptying it,
 * which is the right way round for a fallback.
 */
const ATTRACTION_BASE_CATEGORY = '제주 뭐하지';

/** 1686 (the row's drawn span, x208–1894) over its 14 letters — 120.43, the
 *  same cell the list screens use for the identical ㄱ…ㅎ run. */
const CHOSUNG_CELL = 1686 / 14;

/**
 * The band the 초성 row occupies between the tabs and the grid (`.chosung` sits
 * at y920 and the grid starts at y1002). Hiding the row hands that band back to
 * the grid instead of leaving an 82px hole above it — see `.spotsNoChosung`.
 * This is the SPACING, not the row's own 72px box.
 */
const CHOSUNG_BAND = 82;

/** The 상세 card sits at y1047 here, clearing the tab and 초성 rows. */
const DETAIL_TOP = 1047;

/*
 * Low-reach y values — Figma 6289:70215 / 70264 / 70323 / 70496, re-read
 * 2026-08-26 on the mode-bar revision (bar at y0–113, header y113, no banner).
 * The tab row moves to the foot and the content tops are now PER STATE: the
 * 역사 panel and 문화 cards at 1085, the 관광명소 grid's first card at 875
 * (exactly three 730 rows fit), and the drill-down 상세 card at 1057 (its 2133
 * height bottoms out at 3190, level with the grid's 3185).
 */
const LOW_CONTENT_TOP = 1057;
/** 14 × 124.57 = 1744 — the wider ㄱ…ㅎ run the low-reach frames draw. */
const LOW_CHOSUNG_CELL = 124.57;

/**
 * A shop row as the shared 상세 card reads it. `from`/`title` are the detail
 * SCREEN's fields and unused by the card, but they are what makes this item
 * valid to hand to the detail store later if the drill-down ever moves there.
 *
 * `blogReviews` carries the Naver LINK, not a review count — see JejuDetail.
 */
const toDetailItem = (s: Shop, lang: Lang): DetailItem => ({
  from: 'about',
  title: '여기는 제주도',
  name: shopName(s, lang),
  category: shopCategoryLabel(s, lang),
  photos: shopImages(s),
  address: shopAddress(s, lang),
  hours: s.openTime ?? '',
  phone: s.tel ?? '',
  description: shopDescription(s, lang),
  tags: shopHashtag(s, lang),
  rating: s.naverRating != null ? String(s.naverRating) : '',
  instagram: '',
  blogReviews: s.naverLink ?? '',
});

const NO_MATCH = {
  ko: '조건에 맞는 관광명소가 없습니다',
  en: 'No attractions match',
  ja: '条件に合う観光名所がありません',
  zh: '没有符合条件的旅游景点',
  vi: 'Không có điểm tham quan phù hợp',
  th: 'ไม่มีสถานที่ท่องเที่ยวที่ตรงเงื่อนไข',
  ru: 'Нет подходящих достопримечательностей',
  id: 'Tidak ada objek wisata yang cocok',
};

/**
 * How far one ▲▼ press moves, per tab: about half a 역사 panel screenful, one
 * 문화 card row (890 card + 72 gap), or one 관광명소 row (730 card + 60 gap).
 */
const SCROLL_STEP: Record<TabId, number> = {
  history: 260,
  culture: 962,
  attractions: 790,
};

interface Props {
  controller: KioskController;
}

export function JejuAbout({ controller }: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const shops = useShopStore((s) => s.shops);
  const attractions = useAttractionStore((s) => s.attractions);
  // Lands on the row's FIRST tab — 관광명소 since the 2026-08-24 reorder — so
  // the highlighted tab is never mid-row on open.
  const [tab, setTab] = useState<TabId>(TABS[0].id);
  const [hero, setHero] = useState(0);
  const [jamo, setJamo] = useState<Chosung | null>(null);
  /** The 관광명소 drill-down; null is the card grid. */
  const [spot, setSpot] = useState<Shop | null>(null);

  /** Whichever region the active tab scrolls — the 문화 / 역사 panel as a whole,
   *  or the 관광명소 grid. Only one is mounted at a time. */
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * The curated catalogue when it has loaded, the filtered shop list when it has
   * not. Both are `Shop`-shaped, so everything downstream — the 초성 index, the
   * cards, the 상세 card — is unchanged by which one is in play.
   *
   * Ordering matters: an EMPTY attractions list means "not cached yet" (main
   * refuses to cache an empty response — see AttractionService), never "there
   * are no attractions", so falling through on empty is correct rather than a
   * guess.
   */
  const spots = useMemo(
    () =>
      attractions.length > 0 ? attractions : shopsForBase(shops, ATTRACTION_BASE_CATEGORY),
    [attractions, shops],
  );

  /**
   * ── The 초성 row is KOREAN-ONLY ────────────────────────────────────────
   * Its buckets are Korean consonants and it indexes the Korean name, so to a
   * visitor reading English or Thai it is a row of 14 glyphs they cannot match
   * against anything on screen — every card shows a name in their own language.
   * It is hidden outside Korean rather than translated, because there is nothing
   * to translate it INTO: an alphabet index only works for the alphabet the
   * names are written in.
   */
  /**
   * The 역사 timeline, straight from Localization_Jeju.
   *
   * ★ The sheet REPLACED one blob with five epochs. `Here_HistoryContent` was a
   * single 459-character cell with its paragraph breaks lost and Korean only;
   * the operator has since added `Here_HistoryContent_1..5` plus a `_epoch`
   * title for each, filled in all eight languages. That fixes both TODOs above
   * at once — the split is the SHEET's now, not a guess about where a sentence
   * ends, and the page localizes.
   *
   * Built by probing 1..5 rather than from a fixed list, so the operator adding
   * a sixth epoch needs no release. An epoch with no body is skipped (the rows
   * exist before they are written); an empty result falls the whole tab back to
   * the original single key, which is what a kiosk on the old bundled table has.
   * `tExact` is deliberate: a body that has not been translated yet should fall
   * to Korean via `sheetText`, but a MISSING epoch must read as absent, and
   * `t()` would return the key name itself.
   */
  const historyEpochs = useMemo(() => {
    const out: Array<{ key: string; title: string; body: string }> = [];
    for (let i = 1; ; i += 1) {
      const key = `Here_HistoryContent_${i}`;
      if (!hasLoc(key)) break;
      const body = tExact(key, lang);
      if (!body) continue;
      out.push({ key, title: t(`${key}_epoch`, lang), body });
    }
    return out;
  }, [lang]);

  /** Timeline bar — epoch label + one-line summary per stage (1..6). */
  const historyFlow = useMemo(() => {
    const out: Array<{ key: string; epoch: string; summary: string }> = [];
    for (let i = 1; ; i += 1) {
      const key = `Here_HistoryContent_${i}`;
      const epochKey = `${key}_epoch`;
      if (!hasLoc(epochKey)) break;
      const epoch = t(epochKey, lang);
      if (!epoch) continue;
      out.push({
        key,
        epoch,
        summary: t(`${key}_summary`, lang),
      });
    }
    return out;
  }, [lang]);

  const showChosung = lang === 'ko';

  /**
   * Leaving Korean must also drop an ACTIVE filter, not just the control.
   * Otherwise a visitor who taps ㅅ and then switches to English is left on a
   * 19-of-101 list with no visible reason and no way to clear it.
   */
  useEffect(() => {
    if (!showChosung && jamo !== null) setJamo(null);
  }, [showChosung, jamo]);

  /**
   * The API's own 초성 filter, when it answered. Null = never asked, or asked
   * and failed — both fall through to the local filter below.
   */
  const [serverFiltered, setServerFiltered] = useState<Shop[] | null>(null);

  /**
   * Ask the API with `initial`, and let the local filter carry the screen until
   * (or unless) it answers.
   *
   * The two agree for 13 of the 14 buckets; they differ on names that do not
   * begin with a Korean syllable — `1100고지습지` is ㄱ to the server and
   * unbucketable locally, because `leadingChosung` refuses to scan past a
   * leading digit on purpose (see AttractionService.listByInitial). So the
   * server is the better answer, and this is worth the round-trip — but only as
   * a REFINEMENT: the grid has already painted from cache by the time it lands,
   * and an offline kiosk simply keeps the local result.
   *
   * The `cancelled` guard is what makes rapid taps safe — ㄱ then ㅅ must not
   * end with ㄱ's slower response overwriting ㅅ's list.
   */
  useEffect(() => {
    setServerFiltered(null);
    if (!jamo || !showChosung) return;
    let cancelled = false;
    void window.api.attractions.listByInitial(jamo).then((res) => {
      if (cancelled || !isOk(res) || res.value === null) return;
      setServerFiltered(res.value);
    });
    return () => {
      cancelled = true;
    };
  }, [jamo, showChosung]);

  /**
   * The 초성 row indexes the attraction NAME, and always the Korean one: the
   * buckets are Korean consonants, so filtering a translated name would empty
   * the list for every non-Korean visitor. Same rule as JejuListScreen.
   */
  const visibleSpots = useMemo(() => {
    if (!jamo) return spots;
    if (serverFiltered) return serverFiltered;
    return spots.filter((s) => leadingChosung(shopName(s, 'ko')) === jamo);
  }, [spots, jamo, serverFiltered]);

  /**
   * The ▲▼ pair is drawn on all three frames (6212:59090 / 59149 / 59320) as it
   * is on every 제주 content page. 역사 and 문화 scroll their panels as a whole
   * when content overflows; 관광명소 does as soon as there are more than six
   * attractions.
   */
  const [canScroll, setCanScroll] = useState(false);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    setCanScroll(!!el && el.scrollHeight > el.clientHeight + 1);
  }, [tab, lang, spot, visibleSpots.length, historyEpochs.length, historyFlow.length]);

  const scrollBy = (delta: number): void =>
    scrollRef.current?.scrollBy({ top: delta, behavior: 'smooth' });

  const select = (id: TabId): void => {
    trackEvent({
      name: 'button_clicked',
      payload: { screen: 'about', tab: id, kioskId: controller.kioskId },
    });
    setTab(id);
    setSpot(null);
  };

  const openSpot = (s: Shop): void => {
    trackEvent({
      name: 'button_clicked',
      payload: { screen: 'about', tab: 'attractions', shopId: s.id, kioskId: controller.kioskId },
    });
    setSpot(s);
  };

  /** Back closes the drill-down first — leaving the page from inside it would
   *  drop the visitor home from two levels down in one press. */
  const goBack = (): void => {
    if (spot) setSpot(null);
    else controller.navigate('home', '뒤로');
  };

  return (
    /* No banner override in STANDARD: this frame carries the same 상점 검색
       promo as 상세. ♿ is on the 2026-08-26 mode-bar revision (all four state
       frames): bar at the top, header y113, banner gone, content self-laid-out
       below — so the body shift stays 0 (lowReachSelfLayout's job, and the
       mode-bar default). */
    <JejuPageFrame
      controller={controller}
      title="여기는 제주도"
      bannerFallback="banner-detail"
      onBack={goBack}
      lowReachSelfLayout
      lowReachModeBar
      lowReachShift={113}
    >
      <JejuTabRow
        tabs={TABS.map(({ id, key, label }) => ({ id, label: sheetText(key, lang, label) }))}
        value={tab}
        onChange={select}
        className={lowReach ? styles.tabsLow : undefined}
      />

      {tab === 'culture' && (
        <div
          ref={scrollRef}
          className={`${styles.culturePanel} ${lowReach ? styles.culturePanelLow : ''}`}
        >
          <header className={styles.cultureHeader}>
            <h2 className={styles.cultureTitle}>
              <span className={styles.cultureBullet} aria-hidden="true">
                ●
              </span>
              {t('Here_Jeju_1_Culture', lang)}
            </h2>
            <p className={styles.cultureIntro}>
              {t('Here_Jeju_1_CultureContent', lang)}
            </p>
          </header>

          <div className={styles.cards}>
            {CULTURE.map(({ id, photo, focus, titleKey, bodyKey }) => (
              <article key={id} className={styles.card}>
                <div className={styles.cardPhoto}>
                  <img
                    src={photo}
                    alt=""
                    style={{ objectPosition: focus }}
                    draggable={false}
                    loading="lazy"
                  />
                </div>
                <h3 className={styles.cardTitle}>{t(titleKey, lang)}</h3>
                <p className={styles.cardBody}>{t(bodyKey, lang)}</p>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div
          ref={scrollRef}
          className={`${styles.historyPanel} ${lowReach ? styles.historyPanelLow : ''}`}
        >
          <div className={styles.historyIntroRow}>
            <div className={styles.historyGallery}>
              <div className={styles.historyThumbs}>
                {THUMBS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    className={`${styles.historyThumb} ${hero === i ? styles.historyThumbActive : ''}`}
                    onClick={() => setHero(i)}
                    aria-label={`사진 ${i + 1}`}
                  >
                    <img src={GALLERY[i]!.src} alt="" draggable={false} loading="lazy" />
                  </button>
                ))}
              </div>
              <div className={styles.historyHero}>
                <img src={GALLERY[hero]!.src} alt="" draggable={false} />
              </div>
            </div>

            <div className={styles.historyIntro}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionBullet} aria-hidden="true">
                  ●
                </span>
                {t('Here_Jeju_2_Culture', lang)}
              </h2>
              <p className={styles.historyIntroBody}>
                {t('Here_Jeju_2_CultureContent', lang)}
              </p>
            </div>
          </div>

          {historyFlow.length > 0 && (
            <section className={styles.historyFlow}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionBullet} aria-hidden="true">
                  ●
                </span>
                {t('Here_HistoryFlow', lang)}
              </h2>
              <div className={styles.historyFlowBar}>
                {historyFlow.map((item, index) => (
                  <div
                    key={`${item.key}-emoji`}
                    className={styles.historyFlowEmojiSlot}
                    style={{ gridColumn: index * 2 + 1, gridRow: 1 }}
                  >
                    {HISTORY_FLOW_EMOJI[index] && (
                      <span className={styles.historyFlowEmoji} aria-hidden="true">
                        {HISTORY_FLOW_EMOJI[index]}
                      </span>
                    )}
                  </div>
                ))}

                {historyFlow.map((item, index) => (
                  <Fragment key={item.key}>
                    {index > 0 && (
                      <span
                        className={styles.historyFlowArrow}
                        style={{ gridColumn: index * 2, gridRow: 2 }}
                        aria-hidden="true"
                      >
                        ›
                      </span>
                    )}
                    <span
                      className={styles.historyFlowEpoch}
                      style={{ gridColumn: index * 2 + 1, gridRow: 2 }}
                    >
                      {item.epoch}
                    </span>
                  </Fragment>
                ))}

                {historyFlow.map((item, index) => (
                  <p
                    key={`${item.key}-summary`}
                    className={styles.historyFlowSummary}
                    style={{ gridColumn: index * 2 + 1, gridRow: 3 }}
                  >
                    {item.summary}
                  </p>
                ))}
              </div>
            </section>
          )}

          <div className={styles.historyProse}>
            {historyEpochs.length > 0 ? (
              historyEpochs.map((e) => (
                <section key={e.key} className={styles.epoch}>
                  {e.title && (
                    <h3 className={styles.epochTitle}>
                      <span className={styles.sectionBullet} aria-hidden="true">
                        ●
                      </span>
                      {e.title}
                    </h3>
                  )}
                  <p>{e.body}</p>
                </section>
              ))
            ) : (
              <p>{t('Here_HistoryContent_1', lang)}</p>
            )}
          </div>
        </div>
      )}

      {/* 관광명소 (6212:59152) — a fixed 초성 index over a scrolling 3-wide grid.
          The row stays put while the grid moves: it is the filter, and losing it
          off the top of a kiosk screen would strand the visitor mid-list. */}
      {tab === 'attractions' && (
        <>
          {showChosung && (
            <JejuChosungRow
              className={`${styles.chosung} ${lowReach ? styles.chosungLow : ''}`}
              {...(lowReach ? { cellWidth: LOW_CHOSUNG_CELL } : {})}
              value={jamo}
              onChange={(next) => {
                setJamo(next);
                // Filtering is a list action: it closes the drill-down and puts
                // the visitor back on the grid. Re-filtering would otherwise also
                // leave the view scrolled into a list that no longer exists.
                setSpot(null);
                scrollRef.current?.scrollTo({ top: 0 });
              }}
              cellWidth={CHOSUNG_CELL}
            />
          )}

          {spot ? (
            /* 상세 (6212:59326) — the shared card in its 사진1개 variant, in
               place of the grid. The 초성 row above it stays, exactly as the
               frame draws it — and where there is no row, the card takes that
               band too rather than floating below a gap. */
            <JejuSpotDetailCard
              item={toDetailItem(spot, lang)}
              top={lowReach ? LOW_CONTENT_TOP : showChosung ? DETAIL_TOP : DETAIL_TOP - CHOSUNG_BAND}
              gallery="single"
            />
          ) : (
            <div
              className={[styles.spots, showChosung ? '' : styles.spotsNoChosung, lowReach ? styles.spotsLow : '']
                .filter(Boolean)
                .join(' ')}
              ref={scrollRef}
            >
              {visibleSpots.length > 0 ? (
                <div className={styles.spotGrid}>
                  {visibleSpots.map((s) => (
                    <JejuAttractionCard
                      key={s.id}
                      name={shopName(s, lang)}
                      address={shopAddress(s, lang)}
                      // The shops API carries one `openTime` string; the frame's
                      // third row shows a second (breaktime) line, which needs an
                      // API field that does not exist yet.
                      hours={s.openTime ? [s.openTime] : []}
                      photo={shopImages(s)[0]}
                      onClick={() => openSpot(s)}
                    />
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>
                  {pick(spots.length === 0 ? COMING_SOON : NO_MATCH, lang)}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {canScroll && (
        <>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollUp}`}
            onClick={() => scrollBy(-SCROLL_STEP[tab])}
            aria-label="위로"
          >
            {jejuIconUrl('scroll-arrow') && (
              <img src={jejuIconUrl('scroll-arrow')} alt="" className={styles.scrollBtnImg} draggable={false} />
            )}
          </button>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollDown}`}
            onClick={() => scrollBy(SCROLL_STEP[tab])}
            aria-label="아래로"
          >
            {jejuIconUrl('scroll-arrow') && (
              <img src={jejuIconUrl('scroll-arrow')} alt="" className={styles.scrollBtnImg} draggable={false} />
            )}
          </button>
        </>
      )}
    </JejuPageFrame>
  );
}
