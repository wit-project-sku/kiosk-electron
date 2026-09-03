/**
 * 제주 bottom-right ▲▼ scroll control — the corner triangles the list frames
 * draw at (2040, 3543).
 *
 * The Figma draws them as two bare triangles with no button chrome, and they
 * shipped as a decorative `pointer-events: none` hint — which every tester
 * then pressed, because two arrows in a corner LOOK like a control ("why are
 * they not working?", 2026-08-24). So they are one now: the artwork stays the
 * frame's own single 80×179 export, with two padded tap zones over it, one per
 * triangle. The 80px art is far under a comfortable touch target, so each zone
 * is grown to ~130×120 around its triangle — the same treatment JejuHelp gives
 * its map pins.
 *
 * JejuRentcar is the only caller left: the three list screens (뭐먹지 / 뭐사지 /
 * 숙박안내) dropped it on 2026-09-03 because they also carry the right-hand ▲▼
 * circles at eye level and two scroll controls in two corners is one too many.
 * 렌트카 draws that same pair, so it has the same duplication and is a candidate
 * for the same removal — left alone here only because it was not asked for.
 *
 * The PARENT owns when to render it — 렌트카 drops it in low-reach, where the
 * controls move to the foot of the page.
 */
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import styles from './JejuScrollHint.module.css';

interface Props {
  /** ▲ — scroll one card up. */
  onUp: () => void;
  /** ▼ — scroll one card down. */
  onDown: () => void;
}

export function JejuScrollHint({ onUp, onDown }: Props): JSX.Element | null {
  const art = jejuIconUrl('scroll-hint');
  if (!art) return null;
  return (
    <div className={styles.hint}>
      <img src={art} alt="" className={styles.art} draggable={false} />
      <button type="button" className={styles.zoneUp} onClick={onUp} aria-label="위로" />
      <button type="button" className={styles.zoneDown} onClick={onDown} aria-label="아래로" />
    </div>
  );
}
