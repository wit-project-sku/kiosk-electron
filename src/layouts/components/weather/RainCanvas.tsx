import { useEffect, useRef } from 'react';
import {
  createGlassDropletTexture,
  createRainStreakTexture,
  createSplashTexture,
} from './weatherTextures';
import { createObstacleTracker, type ObstacleRect } from './screenObstacles';
import styles from './WeatherEffects.module.css';

/** A falling rain streak. `depth` 0..1 — far rain is short/slow/dim. */
interface RainStreak {
  x: number;
  y: number;
  py: number; // previous head y, for edge-crossing tests
  vx: number;
  vy: number;
  len: number;
  thick: number;
  opacity: number;
  depth: number;
}

/** Tiny droplet thrown up by an impact (the splash crown). */
interface SplashDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
}

/** Expanding impact ring on a surface. */
interface Ripple {
  x: number;
  y: number;
  age: number;
  max: number;
}

/**
 * A drop that landed ON a UI element and behaves like water on a real object:
 * it beads, slides along the top toward the nearest edge, tips over the corner,
 * runs down the side face, and finally falls free.
 */
interface SlipDrop {
  state: 'slide' | 'side' | 'free';
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dir: -1 | 1;
  rect: ObstacleRect;
  wobble: number;
  trail: { x: number; y: number }[];
}

/** Static bead clinging to the glass; the finger-wipe interaction layer. */
interface GlassDrop {
  x: number;
  y: number;
  r: number;
  sliding: boolean;
  vy: number;
  slideSpeed: number;
  stutterTimer: number;
}

interface RainCanvasProps {
  intense?: boolean;
}

const GRAVITY = 2400;

/**
 * Real falling rain with physical UI collisions.
 * - Three parallax layers of wind-tilted motion streaks (the actual rain).
 * - Every button / tile on screen is a solid object: a drop that hits one
 *   throws a splash crown, and some drops bead up, slip along the top to the
 *   nearer left/right edge, run down the side and drop off — like water on a
 *   real box.
 * - Ground splashes along the bottom of the screen.
 * - A light rain-on-glass bead layer that a finger can wipe away.
 */
export function RainCanvas({ intense = false }: RainCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    let disposed = false;

    const streakTex = createRainStreakTexture(12, 256);
    const glassDropTex = createGlassDropletTexture(128);
    const rippleTex = createSplashTexture(128);

    const streaks: RainStreak[] = [];
    const splashes: SplashDrop[] = [];
    const ripples: Ripple[] = [];
    const slips: SlipDrop[] = [];
    const glassDrops: GlassDrop[] = [];

    const obstacles = createObstacleTracker(canvas, () => ({ w, h }));

    // Wind in px/s at full depth, gusting.
    let wind = 120;
    let targetWind = wind;

    const streakCount = intense ? 280 : 170;
    const glassCount = intense ? 26 : 16;
    const maxSlips = intense ? 16 : 10;

    const pointer = { down: false };

    const toLocal = (cx: number, cy: number): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((cx - rect.left) / rect.width) * w,
        y: ((cy - rect.top) / rect.height) * h,
      };
    };

    const spawnStreak = (anywhere = false): void => {
      const depth = Math.random();
      // Perspective: near rain is long, fast, more opaque.
      const speed = 1500 + depth * 1900 + (intense ? 500 : 0);
      streaks.push({
        x: Math.random() * (w + 400) - 200,
        y: anywhere ? Math.random() * h : -60 - Math.random() * h * 0.3,
        py: 0,
        vx: 0,
        vy: speed,
        len: (34 + depth * 110) * (intense ? 1.25 : 1),
        thick: 1.6 + depth * 3.2,
        opacity: 0.3 + depth * (intense ? 0.6 : 0.5),
        depth,
      });
      const s = streaks[streaks.length - 1]!;
      s.py = s.y;
    };

    const spawnSplash = (x: number, y: number, scale: number): void => {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        splashes.push({
          x: x + (Math.random() - 0.5) * 6,
          y,
          vx: (Math.random() - 0.5) * 240 * scale,
          vy: -(90 + Math.random() * 200) * scale,
          r: (1 + Math.random() * 1.6) * scale,
          life: 0.25 + Math.random() * 0.22,
        });
      }
      if (ripples.length < 40) {
        ripples.push({ x, y, age: 0, max: (26 + Math.random() * 26) * scale });
      }
    };

    /** A streak hit the top face of `rect` at x — maybe leave a slipping bead. */
    const maybeSlip = (x: number, rect: ObstacleRect, depth: number): void => {
      if (slips.length >= maxSlips) return;
      if (depth < 0.45) return; // only near rain leaves visible beads
      if (Math.random() > (intense ? 0.3 : 0.22)) return;
      const dir: -1 | 1 = x < rect.x + rect.w / 2 ? -1 : 1;
      slips.push({
        state: 'slide',
        x,
        y: rect.y - 2,
        vx: 0,
        vy: 0,
        r: 4 + Math.random() * 5,
        dir,
        rect,
        wobble: Math.random() * Math.PI * 2,
        trail: [],
      });
    };

    const spawnGlassDrop = (anywhere = false): void => {
      glassDrops.push({
        x: Math.random() * (w - 60) + 30,
        y: anywhere ? Math.random() * (h * 0.9) + 20 : -20,
        r: 2.5 + Math.random() * (intense ? 4 : 3),
        sliding: false,
        vy: 0,
        slideSpeed: 90 + Math.random() * 120,
        stutterTimer: 1 + Math.random() * 4,
      });
    };

    const resize = (): void => {
      const parent = canvas.parentElement;
      if (!parent) return;
      w = parent.clientWidth;
      h = parent.clientHeight;
      if (w < 2 || h < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (streaks.length === 0) {
        for (let i = 0; i < streakCount; i++) spawnStreak(true);
        for (let i = 0; i < glassCount; i++) spawnGlassDrop(true);
      }
      obstacles.refresh();
    };

    // Finger wipe clears clinging beads.
    const wipeAt = (x: number, y: number, radius = 85): void => {
      for (let i = glassDrops.length - 1; i >= 0; i--) {
        const d = glassDrops[i]!;
        if (Math.hypot(d.x - x, d.y - y) < radius + d.r) glassDrops.splice(i, 1);
      }
    };

    const onPointerDown = (e: PointerEvent): void => {
      pointer.down = true;
      const p = toLocal(e.clientX, e.clientY);
      wipeAt(p.x, p.y);
    };
    const onPointerMove = (e: PointerEvent): void => {
      if (!pointer.down && e.pointerType === 'mouse') return;
      const p = toLocal(e.clientX, e.clientY);
      wipeAt(p.x, p.y, 75);
    };
    const onPointerUp = (): void => {
      pointer.down = false;
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    let glassAcc = 0;

    const step = (now: number): void => {
      if (disposed) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (w < 2 || h < 2) {
        raf = requestAnimationFrame(step);
        return;
      }

      // Gusting wind.
      if (Math.random() < dt * 0.5) {
        targetWind = (intense ? 220 : 110) + (Math.random() - 0.5) * (intense ? 420 : 260);
      }
      wind += (targetWind - wind) * Math.min(1, dt * 0.8);

      ctx.clearRect(0, 0, w, h);

      // ── 1. Cool storm-light wash ──
      const mist = ctx.createLinearGradient(0, 0, 0, h);
      mist.addColorStop(0, intense ? 'rgba(28, 44, 66, 0.14)' : 'rgba(40, 60, 85, 0.07)');
      mist.addColorStop(1, 'rgba(35, 55, 80, 0.05)');
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, w, h);

      const rects = obstacles.rects;

      // ── 2. Falling rain streaks with collisions ──
      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i]!;
        s.py = s.y;
        s.vx = wind * (0.4 + s.depth * 0.6);
        s.x += s.vx * dt;
        s.y += s.vy * dt;

        // Impact against the top face of a solid UI object — near rain only,
        // far rain reads as "behind" the interface.
        let hit = false;
        if (s.depth > 0.35) {
          for (const r of rects) {
            if (s.x >= r.x && s.x <= r.x + r.w && s.py <= r.y && s.y >= r.y) {
              spawnSplash(s.x, r.y, 0.5 + s.depth * 0.6);
              maybeSlip(s.x, r, s.depth);
              hit = true;
              break;
            }
          }
        }

        // Ground splash at the bottom edge.
        if (!hit && s.y - s.len * 0.2 > h) {
          if (s.depth > 0.3) spawnSplash(s.x, h - 2 - Math.random() * 6, 0.4 + s.depth * 0.7);
          hit = true;
        }

        if (hit) {
          streaks.splice(i, 1);
          continue;
        }

        // Draw the streak aligned to its velocity (wind tilts the rain).
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(-Math.atan2(s.vx, s.vy));
        ctx.globalAlpha = s.opacity;
        ctx.drawImage(streakTex, -s.thick / 2, -s.len, s.thick, s.len);
        ctx.restore();
      }
      while (streaks.length < streakCount) spawnStreak(false);

      // ── 3. Splash crowns & impact ripples ──
      for (let i = splashes.length - 1; i >= 0; i--) {
        const p = splashes[i]!;
        p.life -= dt;
        if (p.life <= 0) {
          splashes.splice(i, 1);
          continue;
        }
        p.vy += GRAVITY * 0.55 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life * 2.4) * 0.85;
        ctx.fillStyle = 'rgba(140, 175, 215, 0.95)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]!;
        r.age += dt;
        const t = r.age / 0.4;
        if (t >= 1) {
          ripples.splice(i, 1);
          continue;
        }
        const size = r.max * (0.3 + t * 0.7) * 2;
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.7;
        ctx.drawImage(rippleTex, r.x - size / 2, r.y - size * 0.28, size, size * 0.55);
        ctx.restore();
      }

      // ── 4. Beads slipping off buttons like water on a real object ──
      for (let i = slips.length - 1; i >= 0; i--) {
        const d = slips[i]!;
        d.wobble += dt * 9;

        if (d.state === 'slide') {
          // Accelerate along the top face toward the nearer edge, meandering
          // slightly the way surface tension makes real beads stutter.
          d.vx += d.dir * 620 * dt;
          d.x += d.vx * dt + Math.sin(d.wobble) * 14 * dt;
          d.y = d.rect.y - 2 + Math.sin(d.wobble * 0.6) * 0.8;
          const edgeX = d.dir < 0 ? d.rect.x : d.rect.x + d.rect.w;
          if ((d.dir < 0 && d.x <= edgeX) || (d.dir > 0 && d.x >= edgeX)) {
            // Tip over the corner and run down the side face.
            d.state = 'side';
            d.x = edgeX + d.dir * 2;
            d.vx = 0;
            d.vy = 60;
          }
        } else if (d.state === 'side') {
          // Clinging to the vertical face: slower than free fall.
          d.vy = Math.min(d.vy + GRAVITY * 0.35 * dt, 900);
          d.y += d.vy * dt;
          const edgeX = d.dir < 0 ? d.rect.x : d.rect.x + d.rect.w;
          d.x += (edgeX + d.dir * 2 - d.x) * Math.min(1, dt * 10);
          if (d.y >= d.rect.y + d.rect.h) {
            d.state = 'free';
            d.vx = d.dir * 40;
          }
        } else {
          d.vy = Math.min(d.vy + GRAVITY * dt, 2400);
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          if (d.y > h + 20) {
            spawnSplash(d.x, h - 2, 0.9);
            slips.splice(i, 1);
            continue;
          }
        }

        d.trail.push({ x: d.x, y: d.y });
        if (d.trail.length > 10) d.trail.shift();

        // Wet trail.
        if (d.trail.length > 1) {
          ctx.beginPath();
          for (let ti = 0; ti < d.trail.length; ti++) {
            const pt = d.trail[ti]!;
            if (ti === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.strokeStyle = 'rgba(235, 245, 255, 0.3)';
          ctx.lineWidth = Math.max(1.5, d.r * 0.5);
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        const dw = d.r * 2.8;
        ctx.drawImage(glassDropTex, d.x - dw / 2, d.y - dw / 2, dw, dw);
      }

      // ── 5. Rain-on-glass beads (finger-wipeable) ──
      glassAcc += dt;
      const glassInterval = intense ? 0.25 : 0.5;
      while (glassAcc >= glassInterval) {
        glassAcc -= glassInterval;
        if (glassDrops.length < glassCount) spawnGlassDrop(false);
      }

      for (let i = glassDrops.length - 1; i >= 0; i--) {
        const d = glassDrops[i]!;
        if (!d.sliding) {
          d.stutterTimer -= dt;
          if (d.stutterTimer <= 0) {
            if (Math.random() < 0.35) {
              d.sliding = true;
              d.vy = d.slideSpeed;
            } else {
              d.stutterTimer = 2 + Math.random() * 4;
            }
          }
        } else {
          d.y += d.vy * dt;
        }
        const dw = d.r * 2.8;
        ctx.drawImage(glassDropTex, d.x - dw / 2, d.y - dw / 2, dw, dw);
        if (d.y > h + 40) glassDrops.splice(i, 1);
      }

      raf = requestAnimationFrame(step);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    raf = requestAnimationFrame(step);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      obstacles.dispose();
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [intense]);

  return <canvas ref={canvasRef} className={styles.fxCanvas} aria-hidden />;
}
