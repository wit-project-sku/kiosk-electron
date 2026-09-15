import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import styles from './OsanLeftNav.module.css';

interface OsanLeftNavProps {
  onHome: () => void;
  /** Back chevron handler; falls back to onHome when omitted. */
  onBack?: () => void;
  /** Home screen: the rail sits at 제주's y2163 (♿ y2403). */
  low?: boolean;
}

/**
 * Left rail shared across Osan screens — home, back and the ♿ 베리어프리
 * toggle, 85×85 on a 120 step, at the 제주 rail position (x50, y2043).
 */
export function OsanLeftNav({ onHome, onBack, low = false }: OsanLeftNavProps): JSX.Element {
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const toggleLowReach = useAccessibilityStore((s) => s.toggleLowReach);

  return (
    <div className={`${styles.leftNav} ${low ? styles.leftNavLow : ''}`}>
      <button type="button" className={styles.leftNavBtn} onClick={onHome} aria-label="홈으로">
        {osanIconUrl('home-btn') && <img src={osanIconUrl('home-btn')} alt="" draggable={false} />}
      </button>
      <button type="button" className={styles.leftNavBtn} onClick={onBack ?? onHome} aria-label="뒤로">
        {osanIconUrl('back-arrow') && <img src={osanIconUrl('back-arrow')} alt="" draggable={false} />}
      </button>
      <button
        type="button"
        className={`${styles.leftNavBtn} ${styles.accessibility} ${lowReach ? styles.accessibilityOn : ''}`}
        onClick={toggleLowReach}
        aria-label="저상 화면"
        aria-pressed={lowReach}
      >
        {/* Wheelchair glyph (Material "accessible"), drawn in currentColor so it
            takes the Osan brand colour from the stylesheet. */}
        <svg className={styles.accessibilityIcon} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="4" r="2" />
          <path d="M19 13v-2c-1.54.02-3.09-.75-4.07-1.83l-1.29-1.43c-.17-.19-.38-.34-.61-.45-.01 0-.01-.01-.02-.01H13c-.35-.2-.75-.3-1.19-.26C10.76 7.11 10 8.04 10 9.09V15c0 1.1.9 2 2 2h5v5h2v-5.5c0-1.1-.9-2-2-2h-3v-3.45c1.29 1.07 3.25 1.94 5 1.95zm-6.17 5c-.41 1.16-1.52 2-2.83 2-1.66 0-3-1.34-3-3 0-1.31.84-2.41 2-2.83V12.1c-2.28.46-4 2.48-4 4.9 0 2.76 2.24 5 5 5 2.42 0 4.44-1.72 4.9-4h-2.07z" />
        </svg>
      </button>
    </div>
  );
}
