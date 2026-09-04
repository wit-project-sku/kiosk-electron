import { useEffect, useRef } from 'react';
import styles from './WeatherEffects.module.css';

interface Flake {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  spin: number;
  rot: number;
  opacity: number;
  ax: number;
  ay: number;
  /** 6-point crystal vs soft blob. */
  crystal: boolean;
  settled: boolean;
}

/**
 * Large visible snow with drift physics + touch wind/scatter.
 * Passive pointer listeners — does not block home UI.
 */
export function SnowCanvas(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const flakes: Flake[] = [];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = performance.now();
    let disposed = false;
    let spawnAcc = 0;

    const ptr = { x: 0, y: 0, px: 0, py: 0, down: false, inside: false };
    const maxFlakes = 120;

    const toLocal = (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
      return {
        x: ((clientX - rect.left) / rect.width) * w,
        y: ((clientY - rect.top) / rect.height) * h,
      };
    };

    const resize = (): void => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const nw = parent.clientWidth;
      const nh = parent.clientHeight;
      if (nw < 2 || nh < 2) return;
      const first = w < 2;
      w = nw;
      h = nh;
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (first) {
        flakes.length = 0;
        for (let i = 0; i < 80; i++) spawn(Math.random() * h);
      }
    };

    const spawn = (y?: number): void => {
      if (flakes.length >= maxFlakes || w < 2) return;
      const r = 6 + Math.random() * 14;
      flakes.push({
        x: Math.random() * w,
        y: y ?? -20 - Math.random() * 40,
        r,
        vy: 22 + Math.random() * 36,
        vx: (Math.random() - 0.5) * 24,
        spin: (Math.random() - 0.5) * 1.4,
        rot: Math.random() * Math.PI,
        opacity: 0.75 + Math.random() * 0.25,
        ax: 0,
        ay: 0,
        crystal: Math.random() > 0.35,
        settled: false,
      });
    };

    const onPointerDown = (e: PointerEvent): void => {
      const p = toLocal(e.clientX, e.clientY);
      ptr.down = true;
      ptr.inside = p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;
      ptr.x = ptr.px = p.x;
      ptr.y = ptr.py = p.y;
      if (!ptr.inside) return;
      for (const f of flakes) {
        const dist = Math.hypot(f.x - p.x, f.y - p.y);
        if (dist < 110 + f.r) {
          const force = (1 - dist / 130) * 220;
          const ang = Math.atan2(f.y - p.y, f.x - p.x);
          f.ax += Math.cos(ang) * force;
          f.ay += Math.sin(ang) * force - 40;
          f.settled = false;
        }
      }
    };

    const onPointerMove = (e: PointerEvent): void => {
      const p = toLocal(e.clientX, e.clientY);
      ptr.px = ptr.x;
      ptr.py = ptr.y;
      ptr.x = p.x;
      ptr.y = p.y;
      ptr.inside = p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;
      if (!ptr.inside) return;
      if (!ptr.down && e.pointerType === 'mouse' && e.buttons === 0) return;

      const mx = ptr.x - ptr.px;
      const my = ptr.y - ptr.py;
      if (Math.hypot(mx, my) < 0.4) return;

      for (const f of flakes) {
        const dist = Math.hypot(f.x - ptr.x, f.y - ptr.y);
        const radius = 160;
        if (dist > radius) continue;
        const falloff = 1 - dist / radius;
        f.ax += mx * 22 * falloff;
        f.ay += my * 18 * falloff;
        f.settled = false;
      }
    };

    const onPointerUp = (): void => {
      ptr.down = false;
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    const drawFlake = (f: Flake): void => {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.globalAlpha = f.opacity;

      if (f.crystal) {
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = Math.max(1.2, f.r * 0.12);
        ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * f.r, Math.sin(a) * f.r);
          ctx.stroke();
          // Side branches
          const bx = Math.cos(a) * f.r * 0.55;
          const by = Math.sin(a) * f.r * 0.55;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(a + 0.7) * f.r * 0.28, by + Math.sin(a + 0.7) * f.r * 0.28);
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(a - 0.7) * f.r * 0.28, by + Math.sin(a - 0.7) * f.r * 0.28);
          ctx.stroke();
        }
        const core = ctx.createRadialGradient(0, 0, 0, 0, 0, f.r * 0.35);
        core.addColorStop(0, 'rgba(255,255,255,1)');
        core.addColorStop(1, 'rgba(220,235,255,0)');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(0, 0, f.r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, f.r);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.45, 'rgba(240,248,255,0.75)');
        g.addColorStop(1, 'rgba(200,220,240,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, f.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    const step = (now: number): void => {
      if (disposed) return;
      const dt = Math.min((now - last) / 1000, 0.048);
      last = now;

      if (w < 2 || h < 2) {
        raf = requestAnimationFrame(step);
        return;
      }

      spawnAcc += dt;
      while (spawnAcc >= 0.07) {
        spawnAcc -= 0.07;
        if (flakes.length < maxFlakes) spawn();
      }

      ctx.clearRect(0, 0, w, h);
      // Soft cool wash so snow reads even on light backgrounds.
      ctx.fillStyle = 'rgba(200, 220, 240, 0.04)';
      ctx.fillRect(0, 0, w, h);

      for (let i = flakes.length - 1; i >= 0; i--) {
        const f = flakes[i]!;
        f.vx += f.ax * dt;
        f.vy += f.ay * dt;
        f.ax *= Math.pow(0.05, dt);
        f.ay *= Math.pow(0.05, dt);

        if (!f.settled) {
          f.vy += 18 * dt;
          f.vy = Math.min(f.vy, 70 + f.r);
          f.vx += Math.sin(now * 0.0008 + f.x * 0.01) * 14 * dt;
          f.vx *= 0.99;
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.rot += f.spin * dt;

          // Settle near the bottom with a soft land.
          if (f.y > h - 8 - f.r * 0.3) {
            f.y = h - 6 - Math.random() * 10;
            f.vy = 0;
            f.vx *= 0.3;
            f.settled = Math.random() > 0.4;
            if (f.settled) f.opacity *= 0.85;
          }
        } else {
          f.opacity -= dt * 0.08;
        }

        if (f.opacity <= 0.05 || f.x < -40 || f.x > w + 40 || f.y > h + 40) {
          flakes.splice(i, 1);
          continue;
        }
        drawFlake(f);
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

  return <canvas ref={canvasRef} className={styles.rainCanvas} aria-hidden />;
}
