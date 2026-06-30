import { useEffect, useMemo, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import { useLang } from '@renderer/lib/i18n';
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
import { InsadongHeader } from './InsadongHeader';
import styles from './InsadongMuseum.module.css';

const BASE_CATEGORY = '인사동 미술관';

interface InsadongMuseumProps {
  controller: KioskController;
  debug?: boolean;
}

/** 인사동미술관 — list screen (category tabs + result cards), data from shops API. */
export function InsadongMuseum({ controller }: InsadongMuseumProps): JSX.Element {
  const lang = useLang();
  const goHome = (): void => controller.navigate('home', 'Back');
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const [selected, setSelected] = useState('');

  const baseShops = useMemo(() => shopsForBase(shops, BASE_CATEGORY), [shops]);
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

  useEffect(() => {
    if (activeKr) void window.api.kiosk.setScreen('museum_category');
  }, [activeKr]);

  const visible = useMemo(
    () => baseShops.filter((s) => s.secondCategoryKr === activeKr),
    [baseShops, activeKr],
  );

  const noImg = iconUrl('noimage');
  const withFallback = (urls: string[]): string[] => (urls.length > 0 ? urls : noImg ? [noImg] : []);

  const openDetail = (shop: (typeof shops)[number]): void => {
    setDetail({
      from: controller.screen,
      title: '인사 미술관',
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
    controller.navigate('detail', '인사 미술관 상세');
  };

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title="인사 미술관" onHome={goHome} />

      <div className={styles.results}>
        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.kr}
              type="button"
              className={tab.kr === activeKr ? `${styles.tab} ${styles.tabSelected}` : styles.tab}
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
