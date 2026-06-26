import { useMemo, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import { useLang } from '@renderer/lib/i18n';
import {
  SCREEN_BASE_CATEGORY,
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopSecondCategory,
  shopsForBase,
  padImages,
} from '@renderer/lib/shops';
import { InsadongHeader } from './InsadongHeader';
import styles from './InsadongListScreen.module.css';

interface InsadongListScreenProps {
  /** Header title (Korean id; localized by the header). */
  title: string;
  controller: KioskController;
}

/**
 * Reusable list screen (category pills + result cards) for 뭐먹지 / 뭐사지 / 숙박.
 * Data comes from the witteria shops API (cached), filtered by the screen's base
 * category and the selected second-category tab.
 */
export function InsadongListScreen({ title, controller }: InsadongListScreenProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLang();
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const [selected, setSelected] = useState('');

  const baseKr = SCREEN_BASE_CATEGORY[controller.screen] ?? '';
  const baseShops = useMemo(() => shopsForBase(shops, baseKr), [shops, baseKr]);

  // Tabs derived from the shops' second categories (localized labels).
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

  const activeKr = selected || tabs[0]?.kr || '';
  const visible = useMemo(() => {
    const filtered = baseShops.filter((s) => s.secondCategoryKr === activeKr);
    // Show in random order, but float shops that HAVE photos to the top.
    // Fisher–Yates shuffle, then a stable sort by "has images" keeps the
    // random order within both the with-images and no-image groups.
    const shuffled = [...filtered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled.sort(
      (a, b) => (shopImages(b).length > 0 ? 1 : 0) - (shopImages(a).length > 0 ? 1 : 0),
    );
  }, [baseShops, activeKr]);

  const noImg = iconUrl('noimage');
  const withFallback = (urls: string[]): string[] => (urls.length > 0 ? urls : noImg ? [noImg] : []);

  const openDetail = (shop: (typeof shops)[number]): void => {
    setDetail({
      from: controller.screen,
      title,
      name: shopName(shop, lang),
      category: shopSecondCategory(shop, lang),
      photos: withFallback(shopImages(shop)),
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

  const fewTabs = tabs.length <= 5;

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title={title} onHome={goHome} />

      <div className={styles.results}>
        <div className={fewTabs ? `${styles.tabs} ${styles.tabsRow}` : styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.kr}
              type="button"
              className={`${styles.tab} ${fewTabs ? styles.tabWide : ''} ${tab.kr === activeKr ? styles.tabSelected : ''}`}
              onClick={() => setSelected(tab.kr)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.list}>
          {visible.map((shop) => {
            const imgs = padImages(shopImages(shop), noImg, 4);
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
                      <img src={src} alt="" draggable={false} loading="lazy" />
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="홈으로">
          {iconUrl('home-btn') && <img src={iconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="뒤로">
          {iconUrl('back-arrow') && <img src={iconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>

    </>
  );
}
