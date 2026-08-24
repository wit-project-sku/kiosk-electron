import { osanIconUrl } from '@renderer/assets/icons/osan';
import styles from './OsanLeftNav.module.css';

interface OsanLeftNavProps {
  onHome: () => void;
  /** Back chevron handler; falls back to onHome when omitted. */
  onBack?: () => void;
}

/**
 * Sub-page left nav (home + back) shared across Osan content screens.
 * Individual icons at left 21, top 1995.
 */
export function OsanLeftNav({ onHome, onBack }: OsanLeftNavProps): JSX.Element {
  return (
    <div className={styles.leftNav}>
      <button type="button" className={styles.leftNavBtn} onClick={onHome} aria-label="홈으로">
        {osanIconUrl('home-btn') && <img src={osanIconUrl('home-btn')} alt="" draggable={false} />}
      </button>
      <button type="button" className={styles.leftNavBtn} onClick={onBack ?? onHome} aria-label="뒤로">
        {osanIconUrl('back-arrow') && <img src={osanIconUrl('back-arrow')} alt="" draggable={false} />}
      </button>
    </div>
  );
}
