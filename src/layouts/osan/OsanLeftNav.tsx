import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import styles from './OsanLeftNav.module.css';

interface OsanLeftNavProps {
  onHome: () => void;
  /** Back chevron handler; falls back to onHome when omitted. */
  onBack?: () => void;
}

/**
 * Left nav shared by the Osan home and every content screen — Figma
 * `R>좌측네비-인사` (7894:57614 on 오산>홈, 7812:105899 on 오산>언어선택):
 * home · back · ♿, 85×85 each, 35 apart, at (48, 2043).
 *
 * ♿ is drawn as the frame has it but does nothing: 오산 has no low-reach
 * layout, so there is no mode for it to switch to.
 */
export function OsanLeftNav({ onHome, onBack }: OsanLeftNavProps): JSX.Element {
  const home = osanIconUrl('home-nav-home');
  const back = osanIconUrl('home-nav-back');
  const a11y = osanIconUrl('home-accessibility');
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
      {/* ♿ toggles the low-reach (베리어프리) layout, as on 인사동. */}
      <button type="button" className={styles.leftNavBtn} onClick={toggleLowReach} aria-pressed={lowReach} aria-label="베리어프리 모드">
        {a11y && <img src={a11y} alt="" draggable={false} />}
      </button>
    </div>
  );
}
