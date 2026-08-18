import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import { facilityLabel, useLang } from '@renderer/lib/i18n';
import {
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopSecondCategory,
  shopsForBase,
  stripPrefix,
} from '@renderer/lib/shops';
import { InsadongHeader } from './InsadongHeader';
import styles from './InsadongHelp.module.css';

const BASE_CATEGORY = '인사 도와줘';

/** Fixed Figma category tabs (2-row grid), in design order. The Korean string is
 *  the canonical id: it matches the API secondCategory's bare name and is the
 *  restroom deep-link target.
 *
 *  Labels prefer the shop rows (witteria returns secondCategory in all 8
 *  languages). A category with no shops — e.g. 흡연실 — falls back to
 *  `facilityLabel` so the tab still switches language. */
const CATEGORY_IDS: string[] = [
  '안내소', '편의점', '병원', '약국', '은행',
  '환전소', '종교', '화장실', '흡연실', '기타',
];

interface InsadongHelpProps {
  controller: KioskController;
  debug?: boolean;
  /** Category to open on first render (e.g. 화장실 when arriving from the home tile). */
  initialTab?: string;
}

/** 도와줘 인사 — facility finder (category grid + photo/QR cards), data from shops API. */
export function InsadongHelp({ controller, initialTab }: InsadongHelpProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLang();
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  // Deep-link: open on initialTab (e.g. 화장실 from the restroom tile), else 안내소.
  const [active, setActive] = useState(
    initialTab && CATEGORY_IDS.includes(initialTab) ? initialTab : '안내소',
  );

  const baseShops = useMemo(() => shopsForBase(shops, BASE_CATEGORY), [shops]);

  /** Korean category id → the label in the active language, taken from the shop
   *  rows the cards already use, so the tab and the card can never disagree. */
  const catLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of baseShops) {
      const kr = stripPrefix(s.secondCategoryKr ?? '');
      if (kr && !map.has(kr)) map.set(kr, shopSecondCategory(s, lang));
    }
    return map;
  }, [baseShops, lang]);
  const visible = useMemo(
    () => baseShops.filter((s) => stripPrefix(s.secondCategoryKr ?? '') === active),
    [baseShops, active],
  );

  const noImg = iconUrl('noimage');
  const withFallback = (urls: string[]): string[] => (urls.length > 0 ? urls : noImg ? [noImg] : []);

  const openDetail = (shop: (typeof shops)[number]): void => {
    setDetail({
      from: controller.screen,
      title: '도와줘 ‘인사’',
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
    controller.navigate('detail', '도와줘 인사 상세');
  };

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title="도와줘 ‘인사’" onHome={goHome} />

      <div className={styles.results}>
        <div className={styles.cats}>
          {CATEGORY_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`${styles.cat} ${active === id ? styles.catSel : ''}`}
              onClick={() => setActive(id)}
            >
              {catLabels.get(id) || facilityLabel(id, lang)}
            </button>
          ))}
        </div>

        <div className={styles.list}>
          {visible.map((shop) => {
            const photo = withFallback(shopImages(shop))[0];
            return (
              <button type="button" key={shop.id} className={styles.card} onClick={() => openDetail(shop)}>
                <div className={styles.photo}>{photo && <img src={photo} alt="" draggable={false} loading="lazy" />}</div>
                <div className={styles.info}>
                  <div className={styles.nameRow}>
                    <span className={styles.name}>{shopName(shop, lang)}</span>
                    <span className={styles.cat2}>
                      <span className={styles.dot} />
                      {shopSecondCategory(shop, lang)}
                    </span>
                  </div>
                  <p className={styles.address}>{shopAddress(shop, lang)}</p>
                  <p className={styles.hours}>{shop.openTime ?? ''}</p>
                  <p className={styles.tags}>{shopHashtag(shop, lang)}</p>
                </div>
                {shop.naverLink && (
                  <div className={styles.qr}>
                    <QRCodeSVG value={shop.naverLink} level="M" style={{ width: '100%', height: '100%' }} />
                  </div>
                )}
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
