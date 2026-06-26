import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import { pick, useLang } from '@renderer/lib/i18n';
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

/** Fixed Figma category tabs (2-row grid). `id` matches the API secondCategory's
 *  bare name (e.g. "안내소"); 화장실 is also the restroom deep-link target. */
const CATEGORIES: Array<{ id: string; t: Record<string, string> }> = [
  { id: '안내소', t: { ko: '안내소', en: 'Info', ja: '案内所', zh: '咨询处' } },
  { id: '편의점', t: { ko: '편의점', en: 'Store', ja: 'コンビニ', zh: '便利店' } },
  { id: '병원', t: { ko: '병원', en: 'Hospital', ja: '病院', zh: '医院' } },
  { id: '약국', t: { ko: '약국', en: 'Pharmacy', ja: '薬局', zh: '药店' } },
  { id: '은행', t: { ko: '은행', en: 'Bank', ja: '銀行', zh: '银行' } },
  { id: '환전소', t: { ko: '환전소', en: 'Exchange', ja: '両替所', zh: '换钱所' } },
  { id: '종교', t: { ko: '종교', en: 'Religion', ja: '宗教', zh: '宗教' } },
  { id: '화장실', t: { ko: '화장실', en: 'Restroom', ja: 'トイレ', zh: '洗手间' } },
  { id: '흡연장소', t: { ko: '흡연장소', en: 'Smoking', ja: '喫煙所', zh: '吸烟区' } },
  { id: '기타', t: { ko: '기타', en: 'Other', ja: 'その他', zh: '其他' } },
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
    initialTab && CATEGORIES.some((c) => c.id === initialTab) ? initialTab : '안내소',
  );

  const baseShops = useMemo(() => shopsForBase(shops, BASE_CATEGORY), [shops]);
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
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${styles.cat} ${active === c.id ? styles.catSel : ''}`}
              onClick={() => setActive(c.id)}
            >
              {pick(c.t, lang)}
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
