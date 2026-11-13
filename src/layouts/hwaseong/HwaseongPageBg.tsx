import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import styles from './HwaseongPageBg.module.css';

/**
 * The one 화성휴게소 page background: the watercolour `page-bg` art at 60% over
 * white, covering the full 2160×3840 artboard. Every Hwaseong page draws this
 * same component — no page brings its own background image.
 */
export function HwaseongPageBg(): JSX.Element {
  const src = hwaseongIconUrl('page-bg');
  return (
    <div className={styles.bg} aria-hidden>
      {src && <img className={styles.img} src={src} alt="" draggable={false} />}
    </div>
  );
}
