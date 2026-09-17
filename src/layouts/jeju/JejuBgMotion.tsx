import type { CSSProperties } from 'react';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { JejuSkyPlane } from './JejuSkyPlane';
import styles from './JejuBgMotion.module.css';

/**
 * The 제주 page background, alive: the pieces of `bg-page.png` that move.
 *
 * `bg-page.png` is one flat illustration, so every moving piece was cut out of
 * it as its own sprite (`bg-anim-*.png`, the artwork's own pixels with soft
 * edges) and the illustration filled in behind it. Each sprite sits at its
 * exact place on the 2160×3840 artboard, so at rest the page looks as drawn:
 *
 *   · clouds drift slowly (the ones cut by the artboard edge only drift outward,
 *     so their cut side never shows);
 *   · the orange branch sways from the top-right corner it grows from;
 *   · the petals and the blossom keep falling — a fresh one fades in where the
 *     artwork drew it each time;
 *   · the four wind turbines turn, each at its own speed;
 *   · the orange tree by the beach sways from its trunk;
 *   · the lighthouse lamp blinks;
 *   · the plane crosses the sky (JejuSkyPlane).
 *
 * Only transform and opacity animate, so the kiosk runs it on the compositor,
 * and `prefers-reduced-motion` stops everything in place.
 *
 * Draw it IMMEDIATELY after the `bg-page` <img>, inside the same artboard root:
 * it paints over the illustration and under the page. Only with `bg-page` —
 * the plain `bg` fallback has none of these pieces.
 */
interface Piece {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'cloud' | 'branch' | 'petal' | 'blades' | 'tree';
  /** Per-piece timing and path, read by the keyframes. */
  vars?: Record<string, string>;
}

const PIECES: Piece[] = [
  // Clouds — furthest back.
  { name: 'cloud-1', x: 30, y: 512, w: 353, h: 111, kind: 'cloud', vars: { '--dur': '38s', '--from': '-30px', '--to': '30px' } },
  { name: 'cloud-2', x: 1942, y: 1307, w: 218, h: 160, kind: 'cloud', vars: { '--dur': '44s', '--from': '0px', '--to': '60px' } },
  { name: 'cloud-3', x: 0, y: 2117, w: 503, h: 272, kind: 'cloud', vars: { '--dur': '52s', '--from': '-60px', '--to': '0px' } },
  { name: 'cloud-4', x: 1851, y: 2217, w: 309, h: 91, kind: 'cloud', vars: { '--dur': '46s', '--from': '0px', '--to': '70px' } },
  { name: 'cloud-5', x: 388, y: 2656, w: 312, h: 79, kind: 'cloud', vars: { '--dur': '40s', '--from': '-35px', '--to': '35px' } },
  // Wind turbines — pivot is the hub, inside each blade sprite.
  { name: 'blades-1', x: 1923, y: 2736, w: 163, h: 160, kind: 'blades', vars: { '--dur': '10s', '--px': '84.5px', '--py': '104px' } },
  { name: 'blades-3', x: 1813, y: 2831, w: 128, h: 125, kind: 'blades', vars: { '--dur': '12s', '--px': '64.5px', '--py': '80px' } },
  { name: 'blades-4', x: 1899, y: 2973, w: 71, h: 75, kind: 'blades', vars: { '--dur': '8s', '--px': '34px', '--py': '38px' } },
  { name: 'blades-2', x: 2055, y: 2912, w: 69, h: 77, kind: 'blades', vars: { '--dur': '9s', '--px': '32.5px', '--py': '40.5px' } },
  // The orange tree by the beach — pivot at the foot of its trunk.
  { name: 'tree', x: 1664, y: 3348, w: 496, h: 444, kind: 'tree' },
  // The orange branch — pivot at the top-right corner it grows in from.
  { name: 'branch', x: 1188, y: 0, w: 972, h: 762, kind: 'branch' },
  // Falling petals and the blossom — in front of the branch they fall from.
  { name: 'petal-1', x: 1596, y: 638, w: 51, h: 40, kind: 'petal', vars: { '--dur': '11s', '--delay': '-2s', '--fall': '520px', '--sway': '40px', '--spin': '220deg' } },
  { name: 'petal-2', x: 1587, y: 875, w: 73, h: 71, kind: 'petal', vars: { '--dur': '13s', '--delay': '-7s', '--fall': '560px', '--sway': '-50px', '--spin': '-260deg' } },
  { name: 'petal-3', x: 1505, y: 1078, w: 38, h: 46, kind: 'petal', vars: { '--dur': '10s', '--delay': '-4s', '--fall': '480px', '--sway': '35px', '--spin': '300deg' } },
  { name: 'petal-4', x: 1649, y: 1426, w: 47, h: 54, kind: 'petal', vars: { '--dur': '12s', '--delay': '-9s', '--fall': '520px', '--sway': '-40px', '--spin': '240deg' } },
  { name: 'petal-5', x: 1860, y: 1576, w: 99, h: 68, kind: 'petal', vars: { '--dur': '14s', '--delay': '-1s', '--fall': '540px', '--sway': '45px', '--spin': '-200deg' } },
  { name: 'petal-6', x: 1709, y: 2449, w: 51, h: 41, kind: 'petal', vars: { '--dur': '9s', '--delay': '-5s', '--fall': '220px', '--sway': '30px', '--spin': '180deg' } },
  { name: 'petal-7', x: 383, y: 2598, w: 43, h: 31, kind: 'petal', vars: { '--dur': '8s', '--delay': '-3s', '--fall': '160px', '--sway': '-25px', '--spin': '-160deg' } },
  { name: 'petal-8', x: 1753, y: 2658, w: 42, h: 38, kind: 'petal', vars: { '--dur': '8.5s', '--delay': '-6s', '--fall': '120px', '--sway': '20px', '--spin': '140deg' } },
  { name: 'blossom', x: 1812, y: 865, w: 94, h: 113, kind: 'petal', vars: { '--dur': '16s', '--delay': '-11s', '--fall': '600px', '--sway': '-60px', '--spin': '160deg' } },
];

export function JejuBgMotion(): JSX.Element {
  return (
    <div className={styles.layer} aria-hidden>
      {PIECES.map((piece) => {
        const src = jejuIconUrl(`bg-anim-${piece.name}`);
        if (!src) return null;
        return (
          <img
            key={piece.name}
            src={src}
            alt=""
            draggable={false}
            className={`${styles.piece} ${styles[piece.kind]}`}
            style={{ left: piece.x, top: piece.y, width: piece.w, height: piece.h, ...piece.vars } as CSSProperties}
          />
        );
      })}
      <span className={styles.lighthouse} />
      <JejuSkyPlane />
    </div>
  );
}
