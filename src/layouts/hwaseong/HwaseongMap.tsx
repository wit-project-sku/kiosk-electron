import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useLang } from '@renderer/lib/i18n';
import { ui } from '@renderer/lib/uiText';
import { HwaseongHeader } from './HwaseongHeader';
import { ZoomableImage } from '../insadong/ZoomableImage';
import styles from './HwaseongMap.module.css';

interface Props {
  controller: KioskController;
}

/**
 * 화성휴게소 지도 — floor plan + legend. The full map (floor plan and the
 * 5-category legend) is a single uploaded image (`map-full`); only the subtitle
 * above it is rendered/localized in code.
 */
export function HwaseongMap({ controller }: Props): JSX.Element {
  const banner = useRotatingBanner(hwaseongIconUrl('fg-banner'));
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
          <p className={styles.cardSubtitle}>{ui('hwaseongMapSubtitle', lang)}</p>

          {/* Full floor-plan + legend map image — pinch/double-tap to zoom,
              drag to pan (same touch-friendly viewer as the transport maps). */}
          {mapSrc ? (
            <ZoomableImage src={mapSrc} alt="화성휴게소 지도" className={styles.mapViewport} />
          ) : (
            <div className={styles.mapPlaceholder}>
              <span className={styles.mapPlaceholderText}>{ui('hwaseongFloorPlan', lang)}</span>
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
        {banner && (
          <img src={banner} alt="" className={styles.bannerImg} draggable={false} />
        )}
      </div>
    </div>
  );
}
