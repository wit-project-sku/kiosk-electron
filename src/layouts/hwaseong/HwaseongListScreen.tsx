import { useEffect, useMemo, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import { catLabel, useLang } from '@renderer/lib/i18n';
import {
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopSecondCategory,
  shopsForBase,
  padImages,
} from '@renderer/lib/shops';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongListScreen.module.css';

interface Props {
  title: string;
  controller: KioskController;
  /** witteria API baseCategoryKr for this screen (e.g. '휴 뭐먹지'). */
  baseCategory: string;
  /**
   * Fixed Figma tabs to show when the shop data has NO second categories
   * (e.g. 뭐사지). Rendered (translated) for visual parity with the design; the
   * card list shows every base shop until the data is categorized.
   */
  fixedTabs?: string[];
  /** Fallback category labels shown (per Figma) when no shop data is loaded. */
  defaultTabs?: string[];
}

/**
 * Reusable category-tab list screen (e.g. '휴' 뭐먹지). Shops are filtered to the
 * screen's base category first, then split by second category. When the base has
 * no sub-categories (e.g. 뭐사지), the Figma tabs (`fixedTabs`) render for visual
 * parity and all base shops show.
 */
export function HwaseongListScreen({ title, controller, baseCategory, fixedTabs, defaultTabs = [] }: Props): JSX.Element {
  const lang = useLang();
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const [selected, setSelected] = useState('');

  const baseShops = useMemo(() => shopsForBase(shops, baseCategory), [shops, baseCategory]);

  // Tabs derived from the base category's second categories. If the data has
  // none (flat list), tabs is empty; the Figma labels only appear as a preview
  // before shop data has loaded.
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
  const tabs = hasCats
    ? dataTabs
    : fixedTabs && fixedTabs.length > 0
      ? fixedTabs.map((label) => ({ kr: label, label: catLabel(label, lang) }))
      : baseShops.length > 0
        ? []
        : defaultTabs.map((label) => ({ kr: label, label: catLabel(label, lang) }));

  const activeKr = selected || tabs[0]?.kr || '';

  useEffect(() => {
    if (activeKr) void window.api.kiosk.setScreen(`${controller.screen}_category`);
  }, [activeKr, controller.screen]);

  const visible = useMemo(() => {
    // No sub-categories → show every shop in the base category.
    const filtered = hasCats ? baseShops.filter((s) => s.secondCategoryKr === activeKr) : baseShops;
    const shuffled = [...filtered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled.sort(
      (a, b) => (shopImages(b).length > 0 ? 1 : 0) - (shopImages(a).length > 0 ? 1 : 0),
    );
  }, [baseShops, activeKr, hasCats]);

  const noImg = hwaseongIconUrl('noimage');

  const openDetail = (shop: (typeof shops)[number]): void => {
    setDetail({
      from: controller.screen,
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
    <div className={styles.root}>
      {/* Background */}
      <div className={styles.bgBase} />
      {hwaseongIconUrl('bg') && (
        <img src={hwaseongIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      {/* Shared header */}
      <HwaseongHeader controller={controller} title={title} />

      {/* Category tabs + result list */}
      <div className={styles.results}>
        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.kr}
              type="button"
              className={`${styles.tab} ${tab.kr === activeKr ? styles.tabSelected : ''}`}
              onClick={() => setSelected(tab.kr)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.list}>
          {visible.map((shop) => {
            const imgs = padImages(shopImages(shop), noImg ?? '', 4);
            return (
              <button type="button" key={shop.id} className={styles.card} onClick={() => openDetail(shop)}>
                <div className={styles.info}>
                  <div className={styles.nameRow}>
                    <span className={styles.name}>{shopName(shop, lang)}</span>
                    <span className={styles.cat}>
                      <span className={styles.dot} />
                      {shopSecondCategory(shop, lang)}
                    </span>
                  </div>
                  <p className={styles.address}>{shopAddress(shop, lang)}</p>
                  <p className={styles.desc}>{shopDescription(shop, lang)}</p>
                  <p className={styles.tags}>{shopHashtag(shop, lang)}</p>
                </div>
                <div className={styles.photos}>
                  {imgs.map((src, j) => (
                    <div key={j} className={styles.thumb}>
                      {src ? <img src={src} alt="" draggable={false} loading="lazy" /> : <div className={styles.thumbEmpty} />}
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Left nav */}
      <div className={styles.leftNav}>
        {hwaseongIconUrl('fg-leftnav') && (
          <img src={hwaseongIconUrl('fg-leftnav')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button type="button" className={styles.leftNavZoneHome} onClick={() => controller.navigate('home')} aria-label="홈" />
        <button type="button" className={styles.leftNavZoneBack} onClick={() => controller.navigate('home')} aria-label="뒤로" />
      </div>

      {/* Bottom banner */}
      <div className={styles.banner}>
        {hwaseongIconUrl('fg-banner') && (
          <img src={hwaseongIconUrl('fg-banner')} alt="" className={styles.bannerImg} draggable={false} />
        )}
      </div>
    </div>
  );
}
