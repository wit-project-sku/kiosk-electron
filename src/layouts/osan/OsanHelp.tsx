import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { osanIconUrl } from '@renderer/assets/icons/osan';
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
  stripPrefix,
} from '@renderer/lib/shops';
import { OsanHeader } from './OsanHeader';
import styles from './OsanHelp.module.css';

const BASE_CATEGORY = '정이 도와줘';

/** Keep the card compact — show at most 3 hashtags so the text never runs into the QR. */
function firstTags(raw: string, max = 3): string {
  return raw.split(/\s+/).filter(Boolean).slice(0, max).join(' ');
}

interface OsanHelpProps {
  controller: KioskController;
  /** Category to open on first render (e.g. 화장실 from the restroom tile). */
  initialTab?: string;
}

/** 도와줘 '정이' — facility finder (category grid + photo/QR cards), shops API. */
export function OsanHelp({ controller, initialTab }: OsanHelpProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLang();
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const [selected, setSelected] = useState('');

  const baseShops = useMemo(() => shopsForBase(shops, BASE_CATEGORY), [shops]);

  // Category tabs derived from the actual shop data (secondCategoryKr), sorted
  // by the leading "N-" prefix — same as the 뭐먹지/뭐사지 list screens.
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

  // Deep-link (e.g. 화장실 from the restroom tile) matches a tab by its bare name.
  const initialKr = initialTab ? tabs.find((t) => stripPrefix(t.kr) === initialTab)?.kr : undefined;
  const activeKr = selected || initialKr || tabs[0]?.kr || '';

  useEffect(() => {
    if (activeKr) void window.api.kiosk.setScreen('help_category');
  }, [activeKr]);
  const visible = useMemo(
    () => baseShops.filter((s) => s.secondCategoryKr === activeKr),
    [baseShops, activeKr],
  );

  const noImg = osanIconUrl('noimage');
  const withFallback = (urls: string[]): string[] => (urls.length > 0 ? urls : noImg ? [noImg] : []);

  const openDetail = (shop: (typeof shops)[number]): void => {
    setDetail({
      from: controller.screen,
      title: "도와줘 '정이'",
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
    controller.navigate('detail', "도와줘 '정이' 상세");
  };

  return (
    <>
      {osanIconUrl('bg') && <img className={styles.bg} src={osanIconUrl('bg')} alt="" draggable={false} />}

      <OsanHeader title="도와줘 '정이'" onHome={goHome} />

      <div className={styles.results}>
        <div className={styles.cats}>
          {tabs.map((tab) => (
            <button
              key={tab.kr}
              type="button"
              className={`${styles.cat} ${tab.kr === activeKr ? styles.catSel : ''}`}
              onClick={() => setSelected(tab.kr)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.list}>
          {visible.map((shop) => {
            const photo = withFallback(shopImages(shop))[0];
            return (
              <button type="button" key={shop.id} className={styles.card} onClick={() => openDetail(shop)}>
                <div className={styles.photo}>
                  {photo && <img src={photo} alt="" draggable={false} loading="lazy" />}
                </div>
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
                  <p className={styles.tags}>{firstTags(shopHashtag(shop, lang))}</p>
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
          {osanIconUrl('home-btn') && <img src={osanIconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="뒤로">
          {osanIconUrl('back-arrow') && <img src={osanIconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>
    </>
  );
}
