import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useDetailStore } from '@renderer/store/detailStore';
import { provinceLabel, useLang } from '@renderer/lib/i18n';
import { firstTags } from '@renderer/lib/shops';
import { NATIONWIDE_MARKETS, type NationwideMarket } from '@renderer/data/nationwideMarkets.generated';
import { pickText } from '@renderer/data/types';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongMarketScreen.module.css';

interface Props {
  controller: KioskController;
  /** Header title id (e.g. '전국시장' or '전국 휴게소'). */
  title: string;
  /** Province keys (sheet `province.ko` values) that get a tab, in order. */
  provinces: string[];
}

/**
 * Shared 전국시장/전국휴게소 list — nationwide markets from the bundled sheet,
 * filtered to the given provinces (전국시장 = 시/cities, 전국휴게소 = 도/provinces).
 * Tabs + cards match Figma node 4167-173323. No images in the sheet → shared
 * no-image placeholder; QR only when a market has a real link.
 */
export function HwaseongMarketList({ controller, title, provinces }: Props): JSX.Element {
  const banner = useRotatingBanner(hwaseongIconUrl('fg-banner'));
  const lang = useLang();
  const setDetail = useDetailStore((s) => s.setItem);
  const [activeKr, setActiveKr] = useState(provinces[0] ?? '');

  const visible = useMemo(
    () => NATIONWIDE_MARKETS.filter((m) => m.province.ko.trim() === activeKr),
    [activeKr],
  );

  const noImg = hwaseongIconUrl('noimage');

  const openDetail = (m: NationwideMarket): void => {
    setDetail({
      from: 'market',
      title: '전국시장',
      name: pickText(m.name, lang),
      category: pickText(m.district, lang),
      photos: noImg ? [noImg] : [],
      address: pickText(m.address, lang),
      hours: pickText(m.openTime, lang),
      phone: m.tel,
      description: pickText(m.description, lang),
      tags: pickText(m.hashtag, lang),
      rating: '',
      instagram: '',
      blogReviews: m.naverLink,
    });
    controller.navigate('detail', '전국시장 상세');
  };

  return (
    <div className={styles.root}>
      <div className={styles.bgBase} />
      {hwaseongIconUrl('bg') && (
        <img src={hwaseongIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      <HwaseongHeader controller={controller} title={title} />

      <div className={styles.results}>
        {/* Province tabs (from sheet) */}
        <div className={styles.tabs}>
          {provinces.map((prov) => (
            <button
              key={prov}
              type="button"
              className={`${styles.tab} ${prov === activeKr ? styles.tabSelected : ''}`}
              onClick={() => setActiveKr(prov)}
            >
              {provinceLabel(prov, lang)}
            </button>
          ))}
        </div>

        {/* Market cards */}
        {visible.map((m, i) => {
          const name = pickText(m.name, lang);
          return (
            <button type="button" key={`${name}-${i}`} className={styles.card} onClick={() => openDetail(m)}>
              <div className={styles.cardInner}>
                <div className={styles.thumb}>
                  {noImg ? <img src={noImg} alt="" draggable={false} loading="lazy" /> : <div className={styles.thumbEmpty} />}
                </div>
                <div className={styles.info}>
                  <div className={styles.nameRow}>
                    <span className={styles.name}>{name}</span>
                    <span className={styles.region}>
                      <span className={styles.dot} />
                      {pickText(m.district, lang) || provinceLabel(activeKr, lang)}
                    </span>
                  </div>
                  <p className={styles.address}>{pickText(m.address, lang)}</p>
                  <p className={styles.hours}>{pickText(m.openTime, lang)}</p>
                  <p className={styles.tags}>{firstTags(pickText(m.hashtag, lang))}</p>
                </div>
              </div>
              {/* QR only when the market has a real link (no empty bordered box). */}
              {m.naverLink && (
                <div className={styles.qr}>
                  <QRCodeSVG value={m.naverLink} level="M" style={{ width: '100%', height: '100%' }} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.leftNav}>
        {hwaseongIconUrl('fg-leftnav') && (
          <img src={hwaseongIconUrl('fg-leftnav')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button type="button" className={styles.leftNavZoneHome} onClick={() => controller.navigate('home')} aria-label="홈" />
        <button type="button" className={styles.leftNavZoneBack} onClick={() => controller.navigate('home')} aria-label="뒤로" />
      </div>

      <div className={styles.banner}>
        {banner && (
          <img src={banner} alt="" className={styles.bannerImg} draggable={false} />
        )}
      </div>
    </div>
  );
}
