import { useCallback, useEffect, useRef } from 'react';
import styles from './WeatherEffects.module.css';

interface CloudState {
  id: number;
  homeY: number;
  scale: number;
  speed: number;
  variant: 0 | 1 | 2;
  opacity: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  poke: number;
  el: HTMLDivElement | null;
}

interface CloudFieldProps {
  /** Fewer / softer clouds for partly-cloudy (`sun_cloud`). */
  light?: boolean;
}

function seedClouds(light: boolean, w: number, h: number): CloudState[] {
  const count = light ? 4 : 6;
  return Array.from({ length: count }, (_, i) => {
    const scale = light ? 0.24 + (i % 3) * 0.05 : 0.28 + (i % 4) * 0.06;
    const homeY = 0.03 + (i % 3) * 0.065 + (i > 3 ? 0.09 : 0);
    const speed = 0.007 + (i % 3) * 0.0035 + Math.random() * 0.003;
    return {
      id: i,
      homeY,
      scale,
      speed,
      variant: (i % 3) as 0 | 1 | 2,
      // Bumped visibility vs the original soft wash.
      opacity: light ? 0.72 + (i % 2) * 0.1 : 0.8 + (i % 3) * 0.08,
      px: ((i * 0.19 + 0.04) % 1.05) * w,
      py: homeY * h,
      vx: speed * w,
      vy: (Math.random() - 0.5) * 4,
      poke: 0,
      el: null,
    };
  });
}

function paintCloud(c: CloudState, w: number): void {
  if (!c.el) return;
  const width = c.scale * w;
  const squash = 1 - c.poke * 0.1;
  const stretch = 1 + c.poke * 0.07;
  c.el.style.width = `${width}px`;
  c.el.style.height = `${width * 0.48}px`;
  c.el.style.opacity = String(c.opacity);
  c.el.style.transform = `translate(${c.px}px, ${c.py}px) scale(${stretch}, ${squash})`;
}

/**
 * Soft layered CSS clouds (original design) — drift, drag, tap-to-puff.
 * Slightly more opaque than the first pass so they read clearly on busy home art.
 */
export function CloudField({ light = false }: CloudFieldProps): JSX.Element {
  const layerRef = useRef<HTMLDivElement>(null);
  const cloudsRef = useRef<CloudState[]>([]);
  const sizeRef = useRef({ w: 2160, h: 3840 });
  const dragRef = useRef<{
    id: number;
    ox: number;
    oy: number;
    lastAx: number;
    lastAy: number;
    moved: boolean;
  } | null>(null);

  const artboardPoint = useCallback((clientX: number, clientY: number) => {
    const layer = layerRef.current;
    if (!layer) return { ax: 0, ay: 0 };
    const rect = layer.getBoundingClientRect();
    return {
      ax: (clientX - rect.left) * (layer.clientWidth / rect.width),
      ay: (clientY - rect.top) * (layer.clientHeight / rect.height),
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const rebuild = (): void => {
      const w = layer.clientWidth || 2160;
      const h = layer.clientHeight || 3840;
      sizeRef.current = { w, h };
      layer.replaceChildren();
      cloudsRef.current = seedClouds(light, w, h);
      for (const c of cloudsRef.current) {
        const el = document.createElement('div');
        const variantClass =
          c.variant === 0 ? styles.cloudV0 : c.variant === 1 ? styles.cloudV1 : styles.cloudV2;
        el.className = `${styles.cloud ?? ''} ${variantClass ?? ''}`;
        el.setAttribute('role', 'presentation');
        for (const name of [styles.puffA, styles.puffB, styles.puffC, styles.puffD, styles.puffE]) {
          if (!name) continue;
          const puff = document.createElement('span');
          puff.className = name;
          el.appendChild(puff);
        }
        el.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          el.setPointerCapture(e.pointerId);
          const { ax, ay } = artboardPoint(e.clientX, e.clientY);
          dragRef.current = {
            id: c.id,
            ox: ax - c.px,
            oy: ay - c.py,
            lastAx: ax,
            lastAy: ay,
            moved: false,
          };
          c.poke = 1;
          c.vx *= 0.15;
          c.vy = 0;
        });
        el.addEventListener('pointermove', (e) => {
          const drag = dragRef.current;
          if (!drag || drag.id !== c.id) return;
          e.stopPropagation();
          const { ax, ay } = artboardPoint(e.clientX, e.clientY);
          if (Math.hypot(ax - drag.lastAx, ay - drag.lastAy) > 3) drag.moved = true;
          drag.lastAx = ax;
          drag.lastAy = ay;
          c.px = ax - drag.ox;
          c.py = Math.max(0, Math.min(sizeRef.current.h * 0.55, ay - drag.oy));
          c.vx = 0;
          c.vy = 0;
          paintCloud(c, sizeRef.current.w);
        });
        const endDrag = (e: PointerEvent): void => {
          const drag = dragRef.current;
          if (!drag || drag.id !== c.id) return;
          e.stopPropagation();
          dragRef.current = null;
          const base = c.speed * sizeRef.current.w;
          c.vx = drag.moved ? base * (0.7 + Math.random() * 0.9) : base * 1.85;
          c.vy = drag.moved ? (Math.random() - 0.5) * 22 : (Math.random() - 0.5) * 32;
          if (!drag.moved) c.poke = 1;
        };
        el.addEventListener('pointerup', endDrag);
        el.addEventListener('pointercancel', endDrag);
        c.el = el;
        layer.appendChild(el);
        paintCloud(c, w);
      }
    };

    rebuild();
    const ro = new ResizeObserver(rebuild);
    ro.observe(layer);

    let raf = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const { w, h } = sizeRef.current;
      for (const c of cloudsRef.current) {
        if (!dragRef.current || dragRef.current.id !== c.id) {
          c.px += c.vx * dt;
          c.py += c.vy * dt;
          c.vy += Math.sin(now * 0.0006 + c.id) * 2 * dt;
          c.vy *= 0.995;
          const margin = c.scale * w * 0.5;
          if (c.px > w + margin) c.px = -margin;
          if (c.px < -margin * 1.1) c.px = w + margin * 0.2;
          c.py += (c.homeY * h - c.py) * 0.15 * dt;
        }
        if (c.poke > 0) c.poke = Math.max(0, c.poke - dt * 2.4);
        paintCloud(c, w);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      layer.replaceChildren();
      cloudsRef.current = [];
    };
  }, [light, artboardPoint]);

  return <div ref={layerRef} className={styles.cloudLayer} aria-hidden />;
}
