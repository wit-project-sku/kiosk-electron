import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import styles from './HwaseongLeftNav.module.css';

interface HwaseongLeftNavProps {
  onHome: () => void;
  /** Back chevron handler; falls back to onHome when omitted. */
  onBack?: () => void;
}

/**
 * Sub-page left nav (home + back) shared across 화성휴게소 content screens.
 * Same button layout as Insadong/Osan: individual icons at left 21, top 1995.
 */
export function HwaseongLeftNav({ onHome, onBack }: HwaseongLeftNavProps): JSX.Element {
  return (
    <div className={styles.leftNav}>
      <button type="button" className={styles.leftNavBtn} onClick={onHome} aria-label="홈으로">
        {hwaseongIconUrl('home-btn') && (
          <img src={hwaseongIconUrl('home-btn')} alt="" draggable={false} />
        )}
      </button>
      <button type="button" className={styles.leftNavBtn} onClick={onBack ?? onHome} aria-label="뒤로">
        {hwaseongIconUrl('back-arrow') && (
          <img src={hwaseongIconUrl('back-arrow')} alt="" draggable={false} />
        )}
      </button>
    </div>
  );
}
