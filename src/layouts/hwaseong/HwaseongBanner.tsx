import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import styles from './HwaseongBanner.module.css';

interface HwaseongBannerProps {
  onClick: () => void;
}

/**
 * Bottom promo banner shared across all 화성휴게소 sub-pages.
 * Figma: R>하단배너 at top 3267, 2160×573.
 *
 * Shows the live banner from the witteria API when one is active, falling back
 * to the bundled fg-banner offline / when the API set is empty.
 */
export function HwaseongBanner({ onClick }: HwaseongBannerProps): JSX.Element | null {
  const src = useRotatingBanner(hwaseongIconUrl('fg-banner'));
  if (!src) return null;
  return (
    <button type="button" className={styles.banner} onClick={onClick} aria-label="가상 한복 체험">
      <img className={styles.bannerImg} src={src} alt="" draggable={false} />
    </button>
  );
}
