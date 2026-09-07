import { useEffect, useRef } from 'react';
import {
  createBokehDiscTexture,
  createFrostBorderTexture,
  createSnowflakeTexture,
  createSnowPuffTexture,
} from './weatherTextures';
import styles from './WeatherEffects.module.css';

interface Snowflake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  spin: number;
  depth: number;
  flutterPhase: number;
  flutterSpeed: number;
  opacity: number;
}

/**
 * Photorealistic Snow & Frost Simulation.
 * Features:
 * - Macro-photographic 6-fold dendritic ice crystal snowflakes spinning in 3D.
 * - Foreground optical bokeh defocus discs and soft snow clumps.
 * - Background winter flurry creating deep atmospheric dimension.
 * - Subtle frost crystallization along the kiosk borders.
 * - Interactive pointer wake stirring a swirling snow vortex.
 */
export function SnowCanvas(): JSX.Element {
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

    // Pre-generate crystalline textures
    const crystalTex0 = createSnowflakeTexture(192, 0);
    const crystalTex1 = createSnowflakeTexture(192, 1);
    const puffTex = createSnowPuffTexture(128);
    const bokehTex = createBokehDiscTexture(160, 'rgba(215, 235, 255, 0.75)');
    const frostCorner = createFrostBorderTexture(600);

    const flakes: Snowflake[] = [];
    const count = 460;
    let wind = 10;
    let targetWind = wind;

    const ptr = { x: 0, y: 0, px: 0, py: 0, down: false, vortexX: 0, vortexY: 0 };

    const toLocal = (cx: number, cy: number): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((cx - rect.left) / rect.width) * w,
        y: ((cy - rect.top) / rect.height) * h,
      };
    };

    const spawnFlake = (anywhere = false): void => {
      const depth = Math.random();
      let r = 4;
      let vy = 40;

      if (depth > 0.88) {
        // Foreground optical bokeh blur
        r = 20 + Math.random() * 26;
        vy = 75 + Math.random() * 65;
      } else if (depth >= 0.35) {
        // Crisp macro hexagonal dendritic crystal
        r = 9 + Math.random() * 15;
        vy = 45 + Math.random() * 50;
      } else {
        // Distant powder flurry
        r = 3.5 + Math.random() * 5;
        vy = 30 + Math.random() * 40;
      }

      flakes.push({
        x: Math.random() * (w + 200) - 100,
        y: anywhere ? Math.random() * h : -Math.random() * 60,
        vx: (Math.random() - 0.5) * 20,
        vy,
        r,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 1.5,
        depth,
        flutterPhase: Math.random() * Math.PI * 2,
        flutterSpeed: 1.5 + Math.random() * 2.5,
        opacity: 0.65 + depth * 0.35,
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

      if (flakes.length === 0) {
        for (let i = 0; i < count; i++) {
          spawnFlake(true);
        }
      }
    };

    const onPointerDown = (e: PointerEvent): void => {
      const p = toLocal(e.clientX, e.clientY);
      ptr.down = true;
      ptr.x = ptr.px = p.x;
      ptr.y = ptr.py = p.y;
    };

    const onPointerMove = (e: PointerEvent): void => {
      const p = toLocal(e.clientX, e.clientY);
      ptr.px = ptr.x;
      ptr.py = ptr.y;
      ptr.x = p.x;
      ptr.y = p.y;

      if (ptr.down || e.pointerType === 'touch') {
        const dx = ptr.x - ptr.px;
        const dy = ptr.y - ptr.py;
        ptr.vortexX += dx * 6;
        ptr.vortexY += dy * 6;
      }
    };

    const onPointerUp = (): void => {
      ptr.down = false;
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    const step = (now: number): void => {
      if (disposed) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (w < 2 || h < 2) {
        raf = requestAnimationFrame(step);
        return;
      }

      if (Math.random() < dt * 0.4) {
        targetWind = 12 + (Math.random() - 0.4) * 35;
      }
      wind += (targetWind - wind) * Math.min(1, dt * 1.2);
      ptr.vortexX *= Math.pow(0.08, dt);
      ptr.vortexY *= Math.pow(0.08, dt);

      while (flakes.length < count) {
        spawnFlake(false);
      }

      ctx.clearRect(0, 0, w, h);

      // ── 1. Winter Atmospheric Chill Wash ──
      const winterTint = ctx.createLinearGradient(0, 0, 0, h);
      winterTint.addColorStop(0, 'rgba(215, 232, 248, 0.06)');
      winterTint.addColorStop(1, 'rgba(195, 218, 240, 0.04)');
      ctx.fillStyle = winterTint;
      ctx.fillRect(0, 0, w, h);

      // ── 2. Delicate Screen Border Frost Crystallization ──
      ctx.save();
      ctx.globalAlpha = 0.45;
      // Top-Left corner
      ctx.drawImage(frostCorner, 0, 0, 450, 450);
      // Top-Right corner (flipped horizontally)
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(frostCorner, 0, 0, 450, 450);
      ctx.restore();
      ctx.restore();

      // ── 3. Update & Draw Snowflakes ──
      for (let i = flakes.length - 1; i >= 0; i--) {
        const f = flakes[i]!;

        f.flutterPhase += f.flutterSpeed * dt;
        const flutterX = Math.sin(f.flutterPhase) * (20 + f.r * 1.2);

        f.y += f.vy * dt;
        f.x += (wind + flutterX + ptr.vortexX * f.depth) * dt;
        f.rot += f.spin * dt;

        // 3D axial tumble foreshortening
        const tiltX = Math.cos(now * 0.0012 + f.flutterPhase) * 0.35 + 0.65;

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.scale(tiltX, 1.0);
        ctx.globalAlpha = f.opacity;

        if (f.depth > 0.88) {
          // Large foreground optical bokeh defocus disc
          const size = f.r * 2.4;
          ctx.drawImage(bokehTex, -size * 0.5, -size * 0.5, size, size);
        } else if (f.depth >= 0.35) {
          // Sharp dendritic hexagonal ice crystal
          const size = f.r * 2.1;
          const tex = f.depth > 0.6 ? crystalTex0 : crystalTex1;
          ctx.drawImage(tex, -size * 0.5, -size * 0.5, size, size);
        } else {
          // Background soft snow speck
          const size = f.r * 2.0;
          ctx.drawImage(puffTex, -size * 0.5, -size * 0.5, size, size);
        }

        ctx.restore();

        if (f.y > h + 40 || f.x < -150 || f.x > w + 150) {
          flakes.splice(i, 1);
          spawnFlake(false);
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
  }, []);

  return <canvas ref={canvasRef} className={styles.fxCanvas} aria-hidden />;
}
