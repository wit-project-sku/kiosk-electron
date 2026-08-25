import { iconUrl } from '@renderer/assets/icons/insadong';
import styles from './InsadongLeftNav.module.css';

interface InsadongLeftNavProps {
  onHome: () => void;
  /** Back chevron handler; falls back to onHome when omitted. */
  onBack?: () => void;
}

/**
 * Sub-page left nav (home + back) shared across Insadong content screens.
 * Individual icons at left 21, top 1995.
 */
export function InsadongLeftNav({ onHome, onBack }: InsadongLeftNavProps): JSX.Element {
  return (
    <div className={styles.leftNav}>
      <button type="button" className={styles.leftNavBtn} onClick={onHome} aria-label="홈으로">
        {iconUrl('home-btn') && <img src={iconUrl('home-btn')} alt="" draggable={false} />}
      </button>
      <button type="button" className={styles.leftNavBtn} onClick={onBack ?? onHome} aria-label="뒤로">
        {iconUrl('back-arrow') && <img src={iconUrl('back-arrow')} alt="" draggable={false} />}
      </button>
    </div>
  );
}
