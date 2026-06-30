import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { pick, useLang } from '@renderer/lib/i18n';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongMap.module.css';

interface Props {
  controller: KioskController;
}

/** Card subtitle shown above the map image. */
const SUBTITLE = {
  ko: '화성휴게소: 먹거리랑 지역 특색 체험까지 가능한 작은 복합공간',
  en: 'Hwaseong SA: a compact complex for food and local specialties',
  ja: '華城SA：グルメから地域の特色体験まで楽しめる小さな複合空間',
  zh: '华城休息站：可以体验美食和地方特色的小型综合空间',
};

/**
 * 화성휴게소 지도 — floor plan + legend. The full map (floor plan and the
 * 5-category legend) is a single uploaded image (`map-full`); only the subtitle
 * above it is rendered/localized in code.
 */
export function HwaseongMap({ controller }: Props): JSX.Element {
  const lang = useLang();
  const mapSrc = hwaseongIconUrl('map-full');

  return (
    <div className={styles.root}>
      <div className={styles.bgBase} />
      {hwaseongIconUrl('bg') && (
        <img src={hwaseongIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      <HwaseongHeader controller={controller} title="화성휴게소 지도" />

      <div className={styles.results}>
        <div className={styles.card}>
          {/* Card subtitle (title above the map) */}
          <p className={styles.cardSubtitle}>{pick(SUBTITLE, lang)}</p>

          {/* Full floor-plan + legend map image */}
          {mapSrc ? (
            <img src={mapSrc} alt="화성휴게소 지도" className={styles.mapImg} draggable={false} />
          ) : (
            <div className={styles.mapPlaceholder}>
              <span className={styles.mapPlaceholderText}>화성휴게소 배치도</span>
            </div>
          )}
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
