import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import styles from './JejuSkyPlane.module.css';

/**
 * The little plane in the 제주 page background, flying.
 *
 * `bg-page.png` used to carry it baked into the sky at the end of its contrail
 * (x579 / y754 on the 2160×3840 artboard). It is now cut out of the artwork —
 * the sky behind it filled, the contrail kept — and drawn here as its own sprite
 * (`bg-plane.png`, the plane's exact pixels) so it alone can move: each pass it
 * enters off the left edge, follows its contrail through the spot the artwork
 * drew it at, rides a slow wave across the sky and leaves off the right edge,
 * with a gentle bob — see JejuSkyPlane.module.css for the path.
 *
 * Draw it IMMEDIATELY after the `bg-page` <img>, inside the same artboard root,
 * so it paints over the sky and under everything else. Only with `bg-page`:
 * the plain `bg` fallback never had a plane.
 */
export function JejuSkyPlane(): JSX.Element | null {
  const plane = jejuIconUrl('bg-plane');
  if (!plane) return null;
  return (
    <span className={styles.flight} aria-hidden>
      <img src={plane} alt="" className={styles.plane} draggable={false} />
    </span>
  );
}
