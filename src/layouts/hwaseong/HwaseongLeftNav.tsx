import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import styles from './HwaseongLeftNav.module.css';

interface HwaseongLeftNavProps {
  onHome: () => void;
  /** Back chevron handler; falls back to onHome when omitted. */
  onBack?: () => void;
}

/**
 * Left nav shared by the 화성휴게소 home and every content screen — Figma
 * `R>좌측네비-인사` (7904:104962 on 화성 홈, 7904:105951 on 언어선택):
 * home · back · ♿, 85×85 each, 35 apart, at (48, 2043).
 *
 * ♿ toggles the barrier-free (low-reach) mode: HwaseongKiosk draws the mode
 * bar and the pages take their low layouts (7904:104975 home).
 */
export function HwaseongLeftNav({ onHome, onBack }: HwaseongLeftNavProps): JSX.Element {
  const home = hwaseongIconUrl('home-nav-home');
  const back = hwaseongIconUrl('home-nav-back');
  const a11y = hwaseongIconUrl('home-accessibility');
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const toggleLowReach = useAccessibilityStore((s) => s.toggleLowReach);
  return (
    <div className={styles.leftNav}>
      <button type="button" className={styles.leftNavBtn} onClick={onHome} aria-label="홈으로">
        {home && <img src={home} alt="" draggable={false} />}
      </button>
      <button type="button" className={styles.leftNavBtn} onClick={onBack ?? onHome} aria-label="뒤로">
        {back && <img src={back} alt="" draggable={false} />}
      </button>
      <button type="button" className={styles.leftNavBtn} onClick={toggleLowReach} aria-pressed={lowReach} aria-label="베리어프리 모드">
        {a11y && <img src={a11y} alt="" draggable={false} />}
      </button>
    </div>
  );
}
