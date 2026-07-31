import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import styles from './OsanBanner.module.css';

interface OsanBannerProps {
  onClick: () => void;
}

/**
 * Bottom promo banner (오색시장 한복 체험) shared across all sub-pages.
 * Figma: R>하단배너=오색시장 at top 3267, 2160×573.
 *
 * Shows the live banner from the witteria API when one is active, falling back
 * to the bundled 오색시장 banner offline / when the API set is empty.
 */
export function OsanBanner({ onClick }: OsanBannerProps): JSX.Element | null {
  const src = useRotatingBanner(osanIconUrl('banner'));
  if (!src) return null;
  return (
    <button type="button" className={styles.banner} onClick={onClick} aria-label="가상 한복 체험">
      <img className={styles.bannerImg} src={src} alt="" draggable={false} />
    </button>
  );
}
