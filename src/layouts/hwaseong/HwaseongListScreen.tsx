/**
 * '휴' 뭐먹지 / '휴' 뭐사지 list — Figma 7918:123478 (frame named 오산>정이
 * 뭐먹지-01 in the 화성 file; the 오산 list in [화성휴게소] main 1 #005AB4).
 *
 * Under the shared header: the category tabs (5 per row), the ㄱ–ㅎ row, then
 * the shop cards in a scrolling window (▲/▼ + the edge pill). The tabs and the
 * ㄱ–ㅎ row stay put. Tapping a card opens 상세. The frame draws no banner.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { catLabel, useLang } from '@renderer/lib/i18n';
import { ui } from '@renderer/lib/uiText';
import {
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopSecondCategory,
  shopCategoryLabel,
  shopsForBase,
  padImages,
} from '@renderer/lib/shops';
import { useFitText } from '@layouts/components/fitText';
import { HwaseongHeader } from './HwaseongHeader';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import { HwaseongPageBg } from './HwaseongPageBg';
import { InitialsRow, ListScrollControls, initialOf, useListScroll } from './HwaseongListParts';
import styles from './HwaseongListScreen.module.css';

interface Props {
  title: string;
  controller: KioskController;
  /** witteria API baseCategoryKr for this screen (e.g. '휴 뭐먹지'). */
  baseCategory: string;
  /**
   * Fixed tabs to show when the shop data has NO second categories. Rendered
   * (translated) for parity with the design; the list shows every base shop.
   */
  fixedTabs?: string[];
  /** Fallback category labels shown when no shop data is loaded. */
  defaultTabs?: string[];
  /** Hide the category tabs entirely (e.g. 뭐사지 — a few flat items). */
  hideTabs?: boolean;
}

export function HwaseongListScreen({ title, controller, baseCategory, fixedTabs, defaultTabs = [], hideTabs = false }: Props): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  /* ♿ (B오산>정이 뭐먹지-01 7918:123591, 뭐사지(식품)-01 7918:123707 with two
     tab rows): the page sits under the mode bar and the list comes first; the
     tabs and ㄱ–ㅎ drop to the foot. */
  const low = useAccessibilityStore((st) => st.lowReach);
  const lang = useLang();
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const [selected, setSelected] = useState('');
  const [initial, setInitial] = useState('');

  const baseShops = useMemo(() => shopsForBase(shops, baseCategory), [shops, baseCategory]);

  // Tabs from the base category's second categories. With none (a flat list)
  // the fixed / default labels only preview the design before data loads.
  const dataTabs = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of baseShops) {
      const kr = s.secondCategoryKr;
      if (kr && !map.has(kr)) map.set(kr, shopSecondCategory(s, lang));
    }
    return [...map.entries()]
      .map(([kr, label]) => ({ kr, label }))
      .sort((a, b) => (parseInt(a.kr, 10) || 999) - (parseInt(b.kr, 10) || 999));
  }, [baseShops, lang]);

  const hasCats = dataTabs.length > 0;
  const tabs = hideTabs
    ? []
    : hasCats
      ? dataTabs
      : fixedTabs && fixedTabs.length > 0
        ? fixedTabs.map((label) => ({ kr: label, label: catLabel(label, lang) }))
        : baseShops.length > 0
          ? []
          : defaultTabs.map((label) => ({ kr: label, label: catLabel(label, lang) }));

  const activeKr = selected || tabs[0]?.kr || '';

  /* Korean category names fit the 340px tab on one line; the other languages
     wrap inside it and the row shrinks together — "Other languages" in the CSS. */
  const wide = lang !== 'ko';
  const tabsRef = useRef<HTMLDivElement>(null);
  useFitText(tabsRef, styles.tab, wide, 0.72, tabs.map((x) => x.label).join('|'));

  useEffect(() => {
    if (activeKr) void window.api.kiosk.setScreen(`${controller.screen}_category`);
  }, [activeKr, controller.screen]);

  const visible = useMemo(() => {
    const filtered = baseShops.filter(
      (s) =>
        (!hasCats || s.secondCategoryKr === activeKr) &&
        (!initial || initialOf(s.shopNameKr ?? '') === initial),
    );
    // Random order, with the shops that HAVE photos floated to the top: a
    // Fisher–Yates shuffle, then a stable sort on "has images".
    const shuffled = [...filtered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled.sort(
      (a, b) => (shopImages(b).length > 0 ? 1 : 0) - (shopImages(a).length > 0 ? 1 : 0),
    );
  }, [baseShops, activeKr, hasCats, initial]);

  /* 7918:123577 — the scroll pill and ▲/▼ (see HwaseongListParts). */
  const { listRef, thumb, scrollBy, toTop } = useListScroll(visible);

  const pickTab = (kr: string): void => {
    setSelected(kr);
    toTop();
  };
  const pickInitial = (c: string): void => {
    setInitial((cur) => (cur === c ? '' : c));
    toTop();
  };

  const noImg = hwaseongIconUrl('noimage');

  const openDetail = (shop: (typeof shops)[number]): void => {
    setDetail({
      from: controller.screen,
      shopId: shop.id,
      title,
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
    controller.navigate('detail', `${title} 상세`);
  };

  return (
    <div className={low ? `${styles.root} ${styles.lowList}` : styles.root}>
      <HwaseongPageBg />

      <HwaseongHeader controller={controller} title={title} onHome={goHome} />

      <div className={styles.results}>
        {tabs.length > 0 && (
          <div ref={tabsRef} className={`${styles.tabs} ${tabs.length > 5 ? styles.tabsTwoRows : ''}`}>
            {tabs.map((tab) => (
              <button
                key={tab.kr}
                type="button"
                className={`${styles.tab} ${wide ? styles.tabLong : ''} ${tab.kr === activeKr ? styles.tabSelected : ''}`}
                onClick={() => pickTab(tab.kr)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <InitialsRow value={initial} onPick={pickInitial} />

        <div ref={listRef} className={styles.list}>
          <div className={styles.cards}>
            {visible.map((shop) => (
              <button type="button" key={shop.id} className={styles.card} onClick={() => openDetail(shop)}>
                <div className={styles.info}>
                  <div className={styles.nameRow}>
                    <span className={styles.name}>{shopName(shop, lang)}</span>
                    {shopCategoryLabel(shop, lang) && (
                      <span className={`${styles.cat} ${wide ? styles.catLong : ''}`}>
                        <span className={styles.dot} />
                        {shopCategoryLabel(shop, lang)}
                      </span>
                    )}
                  </div>
                  <p className={styles.address}>{shopAddress(shop, lang)}</p>
                  <p className={styles.desc}>{shopDescription(shop, lang)}</p>
                </div>
                <div className={styles.photos}>
                  {padImages(shopImages(shop), noImg, 2).slice(0, 2).map((src, j) => (
                    <div key={j} className={styles.thumb}>
                      {src && <img src={src} alt="" draggable={false} loading="lazy" />}
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
          {visible.length === 0 && initial && <p className={styles.empty}>{ui('noShopsForInitial', lang)}</p>}
        </div>
      </div>

      <ListScrollControls thumb={thumb} scrollBy={scrollBy} />

      <HwaseongLeftNav onHome={goHome} />
    </div>
  );
}
