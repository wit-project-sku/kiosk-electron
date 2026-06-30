import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { Shop } from '@shared/types/shop';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import { facilityLabel, useLang, type Lang } from '@renderer/lib/i18n';
import {
  firstTags,
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopsForBase,
} from '@renderer/lib/shops';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongHelp.module.css';

/** witteria API base category for the 도와줘 '휴' facility finder (kioskId=5). */
const BASE_CATEGORY = '휴 도와줘';

/** Figma facility tabs (node 4167-172026), 2 rows of 5. 상인회 = "all". */
const TABS_ROW1 = ['상인회', '편의점', '병원', '약국', '은행'];
const TABS_ROW2 = ['환전소', '종교', '화장실', '흡연실', '기타'];
const ALL_TAB = '상인회';

/**
 * Map a facility's Korean name to its tab — the shop API has no second category
 * for 휴 도와줘, so categorize by name keyword (per the Figma tab set).
 */
function facilityCategory(nameKr: string): string {
  if (nameKr.includes('화장실')) return '화장실';
  if (nameKr.includes('편의점')) return '편의점';
  if (nameKr.includes('흡연')) return '흡연실';
  if (nameKr.includes('약국')) return '약국';
  if (nameKr.includes('병원') || nameKr.includes('의원')) return '병원';
  if (nameKr.includes('은행') || nameKr.includes('ATM')) return '은행';
  if (nameKr.includes('환전')) return '환전소';
  if (nameKr.includes('교회') || nameKr.includes('성당') || nameKr.includes('사찰')) return '종교';
  return '기타';
}

interface Props {
  controller: KioskController;
  /** When '화장실', open filtered to the restrooms (화장실 tile). */
  defaultTab?: string;
  noScroll?: boolean;
}

/**
 * 도와줘 '휴' — facility finder backed by the witteria shops API (base "휴 도와줘").
 * Tabs + cards match Figma node 4167-172026. No dummy data: the 9 real facilities
 * (화장실 / 편의점 / 수유실 / 흡연부스 / 주유소 …) are bucketed into the tabs by name.
 */
export function HwaseongHelp({ controller, defaultTab, noScroll = false }: Props): JSX.Element {
  const lang = useLang();
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const [activeTab, setActiveTab] = useState(defaultTab ?? ALL_TAB);

  const baseShops = useMemo(() => shopsForBase(shops, BASE_CATEGORY), [shops]);
  const visible = useMemo(
    () =>
      activeTab === ALL_TAB
        ? baseShops
        : baseShops.filter((s) => facilityCategory(s.shopNameKr) === activeTab),
    [baseShops, activeTab],
  );

  const noImg = hwaseongIconUrl('noimage');

  function openDetail(shop: Shop): void {
    const imgs = shopImages(shop);
    setDetail({
      from: 'help',
      title: "도와줘 '휴'",
      name: shopName(shop, lang),
      category: facilityLabel(facilityCategory(shop.shopNameKr), lang),
      photos: imgs.length ? imgs : noImg ? [noImg] : [],
      address: shopAddress(shop, lang),
      hours: shop.openTime ?? '',
      phone: shop.tel ?? '',
      description: shopDescription(shop, lang),
      tags: shopHashtag(shop, lang),
      rating: shop.naverRating != null ? String(shop.naverRating) : '',
      instagram: '',
      blogReviews: shop.naverLink ?? '',
    });
    controller.navigate('detail', `도와줘 '휴' 상세`);
  }

  return (
    <div className={styles.root}>
      <div className={styles.bgBase} />
      {hwaseongIconUrl('bg') && (
        <img src={hwaseongIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      <HwaseongHeader controller={controller} title="도와줘 '휴'" />

      <div className={styles.results} style={noScroll ? { overflowY: 'visible' } : undefined}>
        {/* Filter tabs — 2 rows × 5 (Figma 4167-172026) */}
        <div className={styles.filterBlock}>
          {[TABS_ROW1, TABS_ROW2].map((row, i) => (
            <div key={i} className={styles.tabRow}>
              {row.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`${styles.filterTab} ${cat === activeTab ? styles.filterTabActive : ''}`}
                  onClick={() => setActiveTab(cat)}
                >
                  {facilityLabel(cat, lang)}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Facility cards (live shop API). */}
        {visible.map((shop) => (
          <HelpCard key={shop.id} shop={shop} lang={lang} noImg={noImg} onOpen={() => openDetail(shop)} />
        ))}
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

/** Single facility card — photo left, info right, QR bottom-right (if a link). */
function HelpCard({
  shop,
  lang,
  noImg,
  onOpen,
}: {
  shop: Shop;
  lang: Lang;
  noImg: string | undefined;
  onOpen: () => void;
}): JSX.Element {
  const photoSrc = shopImages(shop)[0] ?? noImg;
  const category = facilityLabel(facilityCategory(shop.shopNameKr), lang);
  const tags = firstTags(shopHashtag(shop, lang));

  return (
    <button type="button" className={styles.card} onClick={onOpen}>
      {/* Photo */}
      <div className={styles.cardPhoto}>
        {photoSrc ? (
          <img src={photoSrc} alt="" className={styles.cardPhotoImg} draggable={false} loading="lazy" />
        ) : (
          <div className={styles.cardPhotoPlaceholder} />
        )}
      </div>

      {/* Info */}
      <div className={styles.cardInfo}>
        <div className={styles.cardTitleRow}>
          <span className={styles.cardTitle}>{shopName(shop, lang)}</span>
          <div className={styles.cardCat}>
            <span className={styles.cardDot} />
            <span className={styles.cardCatLabel}>{category}</span>
          </div>
        </div>
        {shopAddress(shop, lang) && <span className={styles.cardAddress}>{shopAddress(shop, lang)}</span>}
        {shop.openTime && <span className={styles.cardHours}>{shop.openTime}</span>}
        {tags && <span className={styles.cardTags}>{tags}</span>}
      </div>

      {/* QR only when the facility has a real link. */}
      {shop.naverLink && (
        <div className={styles.cardQr}>
          <QRCodeSVG value={shop.naverLink} level="M" style={{ width: '100%', height: '100%' }} />
        </div>
      )}
    </button>
  );
}
