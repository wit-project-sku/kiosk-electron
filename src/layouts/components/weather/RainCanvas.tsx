import { useEffect, useRef } from 'react';
import { createGlassDropletTexture, createRaindropTexture } from './weatherTextures';
import styles from './WeatherEffects.module.css';

interface GlassDrop {
  x: number;
  y: number;
  r: number; // radius in px
  sliding: boolean;
  vy: number;
  vx: number;
  slideSpeed: number;
  stutterTimer: number;
  mass: number;
  trail: { x: number; y: number; r: number; alpha: number }[];
}

interface BackgroundDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  thick: number;
  opacity: number;
}

interface RainCanvasProps {
  intense?: boolean;
}

/**
 * Hyper-Realistic Rain on Glass Simulation.
 * Features:
 * - Real convex water droplets adhering to the glass screen with contact shadows and highlights.
 * - Trickling rivulets: heavy drops slide down slowly, leaving clear wet paths that dry gradually.
 * - Droplet absorption: sliding drops swallow static drops along their path and accelerate.
 * - Atmospheric falling rain streaks in the background behind the glass pane.
 * - Interactive finger wiping: dragging a finger physically wipes away water and condensation!
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

    const glassDropTex = createGlassDropletTexture(128);
    const bgRainTex = createRaindropTexture(160);

    const glassDrops: GlassDrop[] = [];
    const bgDrops: BackgroundDrop[] = [];

    // Pointer wipe state
    const pointer = { down: false, x: 0, y: 0 };

    const toLocal = (cx: number, cy: number): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((cx - rect.left) / rect.width) * w,
        y: ((cy - rect.top) / rect.height) * h,
      };
    };

    // Spawn a static or small droplet hitting the glass
    const spawnGlassDrop = (anywhere = false): void => {
      const r = 5 + Math.random() * (intense ? 12 : 9);
      const isInitialSliding = Math.random() < (intense ? 0.08 : 0.04);
      glassDrops.push({
        x: Math.random() * (w - 60) + 30,
        y: anywhere ? Math.random() * (h * 0.92) + 20 : -Math.random() * 40,
        r,
        sliding: isInitialSliding,
        vy: 0,
        vx: 0,
        slideSpeed: 80 + Math.random() * (intense ? 140 : 100),
        stutterTimer: Math.random() * 2,
        mass: r * r,
        trail: [],
      });
    };

    // Spawn background rain streaks falling outside the window
    const spawnBgDrop = (anywhere = false): void => {
      bgDrops.push({
        x: Math.random() * (w + 200) - 100,
        y: anywhere ? Math.random() * h : -Math.random() * 80,
        vx: (Math.random() - 0.25) * 60,
        vy: 1100 + Math.random() * 600,
        len: 25 + Math.random() * 50,
        thick: 1.5 + Math.random() * 2.5,
        opacity: 0.25 + Math.random() * 0.45,
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

      if (glassDrops.length === 0) {
        // Initial population of glass droplets
        const count = intense ? 140 : 90;
        for (let i = 0; i < count; i++) spawnGlassDrop(true);
      }
      if (bgDrops.length === 0) {
        const bgCount = intense ? 220 : 130;
        for (let i = 0; i < bgCount; i++) spawnBgDrop(true);
      }
    };

    // Wipe water off the glass with touch/mouse
    const wipeAt = (x: number, y: number, wipeRadius = 90) => {
      for (let i = glassDrops.length - 1; i >= 0; i--) {
        const d = glassDrops[i]!;
        if (Math.hypot(d.x - x, d.y - y) < wipeRadius + d.r) {
          glassDrops.splice(i, 1);
        }
      }
    };

    const onPointerDown = (e: PointerEvent): void => {
      pointer.down = true;
      const p = toLocal(e.clientX, e.clientY);
      pointer.x = p.x;
      pointer.y = p.y;
      wipeAt(p.x, p.y, 90);
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (!pointer.down && e.pointerType === 'mouse') return;
      const p = toLocal(e.clientX, e.clientY);
      pointer.x = p.x;
      pointer.y = p.y;
      wipeAt(p.x, p.y, 80);
    };

    const onPointerUp = (): void => {
      pointer.down = false;
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    let spawnAcc = 0;

    const step = (now: number): void => {
      if (disposed) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (w < 2 || h < 2) {
        raf = requestAnimationFrame(step);
        return;
      }

      // Continuous accumulation of new droplets hitting the glass
      spawnAcc += dt;
      const spawnInterval = intense ? 0.08 : 0.16;
      while (spawnAcc >= spawnInterval) {
        spawnAcc -= spawnInterval;
        if (glassDrops.length < (intense ? 220 : 140)) {
          spawnGlassDrop(false);
        }
      }

      ctx.clearRect(0, 0, w, h);

      // ── 1. Background Rain Streaks Falling Outside the Glass ──
      for (let i = bgDrops.length - 1; i >= 0; i--) {
        const d = bgDrops[i]!;
        d.x += d.vx * dt;
        d.y += d.vy * dt;

        ctx.save();
        ctx.globalAlpha = d.opacity;
        ctx.drawImage(bgRainTex, d.x, d.y, d.thick * 3, d.len);
        ctx.restore();

        if (d.y > h + 50) {
          bgDrops.splice(i, 1);
          spawnBgDrop(false);
        }
      }

      // ── 2. Glass Window Condensation / Misty Wash ──
      const mist = ctx.createLinearGradient(0, 0, 0, h);
      mist.addColorStop(0, intense ? 'rgba(30, 48, 72, 0.16)' : 'rgba(40, 62, 88, 0.09)');
      mist.addColorStop(0.5, intense ? 'rgba(40, 60, 85, 0.10)' : 'rgba(50, 72, 98, 0.05)');
      mist.addColorStop(1, 'rgba(35, 55, 80, 0.08)');
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, w, h);

      // ── 3. Wet Trickle Rivulets / Trail Paths ──
      for (const d of glassDrops) {
        if (d.trail.length > 1) {
          ctx.beginPath();
          for (let ti = 0; ti < d.trail.length; ti++) {
            const pt = d.trail[ti]!;
            if (ti === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.strokeStyle = 'rgba(230, 242, 255, 0.28)';
          ctx.lineWidth = Math.max(2.5, d.r * 0.7);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();

          // Wet specular center line
          ctx.beginPath();
          for (let ti = 0; ti < d.trail.length; ti++) {
            const pt = d.trail[ti]!;
            if (ti === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = Math.max(1.2, d.r * 0.25);
          ctx.stroke();
        }
      }

      // ── 4. Update & Draw Glass Water Droplets ──
      for (let i = glassDrops.length - 1; i >= 0; i--) {
        const d = glassDrops[i]!;

        // Trigger slide if droplet reaches critical mass or randomly after delay
        if (!d.sliding) {
          d.stutterTimer -= dt;
          if (d.mass > 120 || d.stutterTimer <= 0) {
            if (Math.random() < 0.4) {
              d.sliding = true;
              d.vy = d.slideSpeed;
            } else {
              d.stutterTimer = 2 + Math.random() * 4;
            }
          }
        }

        // Sliding physics (stuttering, gravity pull, meandering)
        if (d.sliding) {
          d.stutterTimer -= dt;
          // Water friction hesitation (drops slide, pause slightly, then surge)
          if (d.stutterTimer <= 0) {
            d.stutterTimer = 0.2 + Math.random() * 0.5;
            d.vy = d.slideSpeed * (0.6 + Math.random() * 0.9);
            // Slight horizontal meandering wiggle
            d.vx = (Math.random() - 0.5) * 20;
          }

          d.y += d.vy * dt;
          d.x += d.vx * dt;

          // Record wet trickle path
          d.trail.push({ x: d.x, y: d.y, r: d.r, alpha: 1.0 });
          if (d.trail.length > 25) {
            d.trail.shift();
          }

          // Swallow smaller static droplets along the path
          for (let j = glassDrops.length - 1; j >= 0; j--) {
            if (i === j) continue;
            const other = glassDrops[j]!;
            if (!other.sliding && Math.hypot(d.x - other.x, d.y - other.y) < d.r + other.r * 0.5) {
              // Absorb water mass
              d.mass += other.mass;
              d.r = Math.min(26, Math.sqrt(d.mass));
              d.slideSpeed = Math.min(320, d.slideSpeed * 1.15); // accelerate
              glassDrops.splice(j, 1);
              if (j < i) i--;
            }
          }
        }

        // Draw refractive convex water droplet
        const dw = d.r * 2.8;
        ctx.drawImage(glassDropTex, d.x - dw * 0.5, d.y - dw * 0.5, dw, dw);

        // Remove drops that slide off screen bottom
        if (d.y > h + 50) {
          glassDrops.splice(i, 1);
        }
      }

      // Decay trail path alpha over time
      for (const d of glassDrops) {
        for (let ti = d.trail.length - 1; ti >= 0; ti--) {
          const pt = d.trail[ti]!;
          pt.alpha -= dt * 0.15;
          if (pt.alpha <= 0) {
            d.trail.splice(ti, 1);
          }
        }
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
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [intense]);

  return <canvas ref={canvasRef} className={styles.fxCanvas} aria-hidden />;
}
