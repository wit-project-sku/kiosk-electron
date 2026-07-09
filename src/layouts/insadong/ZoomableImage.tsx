import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ZoomableImage.module.css';

interface ZoomableImageProps {
  src: string;
  /** Class applied to the (fixed-size) viewport that clips the image. */
  className?: string;
  alt?: string;
  /** Maximum zoom multiplier. Default 4×. */
  maxScale?: number;
}

interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

const IDENTITY: Transform = { scale: 1, tx: 0, ty: 0 };
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 24; // px of finger movement still counted as a tap
const DOUBLE_TAP_SCALE = 2.5;

/**
 * Pinch-to-zoom + drag-to-pan image for kiosk maps.
 *
 * - Two-finger pinch zooms about the gesture midpoint.
 * - One-finger drag pans, but only while zoomed in (so a tap on a 1× map never
 *   shifts it).
 * - Double-tap toggles between fit (1×) and a 2.5× zoom centred on the tap.
 * - Mouse wheel zooms about the cursor (dev/desktop convenience).
 *
 * Edge cases handled: translation is always clamped so the image edges can
 * never pull inside the viewport (no white gutters); scale is clamped to
 * [1, maxScale]; lifting one finger of a pinch re-bases the pan smoothly;
 * pointer-capture + touch-action:none stop the OS hijacking the gesture; a lost
 * pointer (cancel/leave) is cleaned up so the gesture can't get stuck.
 */
export function ZoomableImage({
  src,
  className,
  alt = '',
  maxScale = 4,
}: ZoomableImageProps): JSX.Element {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<Transform>(IDENTITY);

  // Live pointer positions (local viewport coords), keyed by pointerId.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  // Baseline captured at the start of the active gesture.
  const gesture = useRef<{
    startDist: number;
    start: Transform;
    panFrom: { x: number; y: number } | null;
  } | null>(null);
  // Double-tap tracking.
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const tapStart = useRef<{ x: number; y: number } | null>(null);

  const size = useCallback((): { w: number; h: number } => {
    const r = viewportRef.current?.getBoundingClientRect();
    return { w: r?.width ?? 0, h: r?.height ?? 0 };
  }, []);

  /** Clamp a transform so the image always fully covers the viewport. */
  const clamp = useCallback(
    (next: Transform): Transform => {
      const scale = Math.min(maxScale, Math.max(1, next.scale));
      const { w, h } = size();
      const minTx = w * (1 - scale);
      const minTy = h * (1 - scale);
      const tx = Math.min(0, Math.max(minTx, next.tx));
      const ty = Math.min(0, Math.max(minTy, next.ty));
      return { scale, tx, ty };
    },
    [maxScale, size],
  );

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const r = viewportRef.current?.getBoundingClientRect();
    return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) };
  }, []);

  /** Zoom by `factor` keeping the world point under `(px,py)` anchored. */
  const zoomAt = useCallback(
    (factor: number, px: number, py: number) => {
      setT((prev) => {
        const scale = Math.min(maxScale, Math.max(1, prev.scale * factor));
        const ratio = scale / prev.scale;
        return clamp({
          scale,
          tx: px - (px - prev.tx) * ratio,
          ty: py - (py - prev.ty) * ratio,
        });
      });
    },
    [clamp, maxScale],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const p = toLocal(e.clientX, e.clientY);
      pointers.current.set(e.pointerId, p);
      tapStart.current = p;

      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        gesture.current = {
          startDist: Math.hypot(a!.x - b!.x, a!.y - b!.y),
          start: t,
          panFrom: null,
        };
      } else if (pointers.current.size === 1) {
        gesture.current = { startDist: 0, start: t, panFrom: p };
      }
    },
    [t, toLocal],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      const p = toLocal(e.clientX, e.clientY);
      pointers.current.set(e.pointerId, p);
      const g = gesture.current;
      if (!g) return;

      if (pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (g.startDist > 0) {
          const mid = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
          const scale = Math.min(
            maxScale,
            Math.max(1, (g.start.scale * dist) / g.startDist),
          );
          const ratio = scale / g.start.scale;
          setT(
            clamp({
              scale,
              tx: mid.x - (mid.x - g.start.tx) * ratio,
              ty: mid.y - (mid.y - g.start.ty) * ratio,
            }),
          );
        }
      } else if (g.panFrom) {
        const from = g.panFrom;
        // Gate on the FRESH scale (prev.scale), never the render-closure `t`.
        // On a touchscreen a pinch-zoom flows straight into a one-finger pan in
        // the same continuous gesture — before React re-renders this handler —
        // so a closure `t.scale` would still read 1 and silently skip the pan.
        setT((prev) => {
          if (prev.scale <= 1) return prev;
          return clamp({
            scale: prev.scale,
            tx: prev.tx + (p.x - from.x),
            ty: prev.ty + (p.y - from.y),
          });
        });
        g.panFrom = p;
      }
    },
    [clamp, maxScale, toLocal],
  );

  const endPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      const released = pointers.current.get(e.pointerId);
      pointers.current.delete(e.pointerId);

      // Double-tap detection — only when the pointer barely moved.
      const start = tapStart.current;
      const moved =
        start && released
          ? Math.hypot(released.x - start.x, released.y - start.y)
          : Infinity;
      if (released && moved <= DOUBLE_TAP_SLOP && pointers.current.size === 0) {
        const now = Date.now();
        const prev = lastTap.current;
        if (
          prev &&
          now - prev.time < DOUBLE_TAP_MS &&
          Math.hypot(released.x - prev.x, released.y - prev.y) <= DOUBLE_TAP_SLOP
        ) {
          if (t.scale > 1) {
            setT(IDENTITY);
          } else {
            zoomAt(DOUBLE_TAP_SCALE, released.x, released.y);
          }
          lastTap.current = null;
        } else {
          lastTap.current = { time: now, x: released.x, y: released.y };
        }
      }

      // Re-base the gesture for any remaining fingers.
      if (pointers.current.size === 1) {
        const [only] = [...pointers.current.values()];
        gesture.current = { startDist: 0, start: t, panFrom: only! };
      } else if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        gesture.current = {
          startDist: Math.hypot(a!.x - b!.x, a!.y - b!.y),
          start: t,
          panFrom: null,
        };
      } else {
        gesture.current = null;
      }
    },
    [t, zoomAt],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const p = toLocal(e.clientX, e.clientY);
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
    },
    [toLocal, zoomAt],
  );

  // Reset when the source changes (e.g. switching tabs reuses the component).
  useEffect(() => {
    setT(IDENTITY);
    pointers.current.clear();
    gesture.current = null;
  }, [src]);

  return (
    <div
      ref={viewportRef}
      className={`${styles.viewport} ${className ?? ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={onWheel}
      data-zoomed={t.scale > 1 ? 'true' : 'false'}
    >
      <img
        className={styles.image}
        src={src}
        alt={alt}
        draggable={false}
        style={{
          transform: `translate(${t.tx}px, ${t.ty}px) scale(${t.scale})`,
        }}
      />
    </div>
  );
}
