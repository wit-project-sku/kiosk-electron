import { useEffect, useRef } from 'react';
import styles from './WeatherEffects.module.css';

/**
 * Atmospheric falling rain — not window condensation.
 *
 * Physics (screen-space, tuned for 2160×3840 kiosk):
 *  - Gravity pulls every drop down
 *  - Quadratic air drag → each drop approaches a size-based terminal velocity
 *    (bigger drops fall faster, like real rain)
 *  - Global wind + touch gusts add horizontal force that fades smoothly
 *  - Ground impact spawns a splash crown + secondary droplets
 *
 * Depth is layered: distant mist-streaks behind brighter near drops.
 */

interface Drop {
  x: number;
  y: number;
  /** Equivalent radius in px — drives mass, drag, and look. */
  r: number;
  vx: number;
  vy: number;
  /** 0 = far (dim/thin), 1 = near (bright/thick). */
  depth: number;
  opacity: number;
}

interface SplashBit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
}

interface RainCanvasProps {
  intense?: boolean;
}

/** Earth-ish gravity scaled to artboard px/s². */
const GRAVITY = 2200;
/** Air-drag coefficient — higher = quicker settle to terminal velocity. */
const DRAG = 0.0028;
/** Base terminal speed scale: v_t ≈ TERM * sqrt(r). */
const TERM = 340;

export function RainCanvas({ intense = false }: RainCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const drops: Drop[] = [];
    const bits: SplashBit[] = [];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = performance.now();
    let spawnAcc = 0;
    let disposed = false;

    /** Ambient wind (px/s² horizontal), gently wanders. */
    let wind = intense ? 90 : 35;
    let windTarget = wind;

    const ptr = { x: 0, y: 0, px: 0, py: 0, down: false, inside: false, gustX: 0, gustY: 0 };

    const density = intense ? 1.55 : 1;
    const maxDrops = Math.round(280 * density);
    const groundY = () => h * 0.985;

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
        drops.length = 0;
        for (let i = 0; i < Math.round(140 * density); i++) spawnDrop(true);
      }
    };

    const spawnDrop = (fillScreen = false): void => {
      if (drops.length >= maxDrops || w < 2) return;
      const depth = Math.random();
      // Size distribution: many small, fewer large (Marshall–Palmer-ish).
      const u = Math.random();
      const r = depth < 0.45
        ? 0.6 + u * 1.4 // far mist
        : 1.4 + Math.pow(u, 1.6) * (intense ? 5.5 : 4.2);
      const vTerm = TERM * Math.sqrt(r) * (0.55 + depth * 0.55);
      drops.push({
        x: Math.random() * (w + 80) - 40,
        y: fillScreen ? Math.random() * h : -20 - Math.random() * 80,
        r,
        vx: wind * 0.15 + (Math.random() - 0.5) * 30,
        vy: fillScreen ? vTerm * (0.7 + Math.random() * 0.3) : vTerm * (0.35 + Math.random() * 0.25),
        depth,
        opacity: 0.25 + depth * 0.55 + Math.random() * 0.15,
      });
    };

    const splash = (x: number, y: number, r: number, depth: number): void => {
      if (depth < 0.35) return; // far drops barely splash
      const n = 3 + Math.floor(r * 1.2) + (intense ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI + (Math.PI * i) / Math.max(1, n - 1) + (Math.random() - 0.5) * 0.35;
        const speed = 80 + r * 35 + Math.random() * 70;
        bits.push({
          x,
          y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed * 0.85 - 40,
          r: 0.8 + Math.random() * Math.min(2.8, r * 0.45),
          life: 0,
          maxLife: 0.22 + Math.random() * 0.28,
        });
      }
    };

    const onPointerDown = (e: PointerEvent): void => {
      const p = toLocal(e.clientX, e.clientY);
      ptr.down = true;
      ptr.inside = p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;
      ptr.x = ptr.px = p.x;
      ptr.y = ptr.py = p.y;
      if (!ptr.inside) return;
      // Punch a local gust — nearby drops get shoved.
      for (const d of drops) {
        const dx = d.x - p.x;
        const dy = d.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 160) {
          const f = (1 - dist / 160) * 420 * d.depth;
          d.vx += (dx / (dist + 1)) * f * 0.25;
          d.vy += f * 0.15;
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
      ptr.gustX += mx * 8;
      ptr.gustY += my * 5;
    };

    const onPointerUp = (): void => {
      ptr.down = false;
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    /** Draw one drop as a velocity-aligned rain streak (teardrop capsule). */
    const drawDrop = (d: Drop): void => {
      const speed = Math.hypot(d.vx, d.vy);
      if (speed < 1) return;

      const dirX = d.vx / speed;
      const dirY = d.vy / speed;
      // Streak length grows with speed — motion blur of a falling drop.
      const len = Math.min(14 + speed * 0.045 * (0.5 + d.depth), 90) * (0.55 + d.depth * 0.6);
      const thick = Math.max(0.6, d.r * (0.35 + d.depth * 0.55));

      const x0 = d.x - dirX * len;
      const y0 = d.y - dirY * len;
      const x1 = d.x + dirX * len * 0.15;
      const y1 = d.y + dirY * len * 0.15;

      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      const a = d.opacity * (0.4 + d.depth * 0.6);
      grad.addColorStop(0, `rgba(180, 205, 230, 0)`);
      grad.addColorStop(0.35, `rgba(200, 220, 240, ${a * 0.35})`);
      grad.addColorStop(0.75, `rgba(230, 240, 255, ${a * 0.85})`);
      grad.addColorStop(1, `rgba(255, 255, 255, ${a})`);

      ctx.strokeStyle = grad;
      ctx.lineWidth = thick;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      // Bright head (the actual droplet)
      if (d.depth > 0.4) {
        const head = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, thick * 1.8);
        head.addColorStop(0, `rgba(255,255,255,${a})`);
        head.addColorStop(0.5, `rgba(210,230,250,${a * 0.4})`);
        head.addColorStop(1, 'rgba(180,210,240,0)');
        ctx.fillStyle = head;
        ctx.beginPath();
        ctx.arc(d.x, d.y, thick * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = (now: number): void => {
      if (disposed) return;
      const dt = Math.min((now - last) / 1000, 0.04);
      last = now;

      if (w < 2 || h < 2) {
        raf = requestAnimationFrame(step);
        return;
      }

      // Wandering ambient wind
      if (Math.random() < dt * 0.4) {
        windTarget = (intense ? 60 : 15) + (Math.random() - 0.35) * (intense ? 160 : 90);
      }
      wind += (windTarget - wind) * Math.min(1, dt * 1.2);
      ptr.gustX *= Math.pow(0.05, dt);
      ptr.gustY *= Math.pow(0.05, dt);

      spawnAcc += dt;
      const spawnEvery = intense ? 0.008 : 0.014;
      while (spawnAcc >= spawnEvery) {
        spawnAcc -= spawnEvery;
        // Burst a few drops per tick for a continuous curtain.
        const burst = intense ? 3 : 2;
        for (let i = 0; i < burst; i++) spawnDrop(false);
      }

      ctx.clearRect(0, 0, w, h);

      // Cool rainy atmosphere wash
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, intense ? 'rgba(40,55,80,0.1)' : 'rgba(55,75,100,0.06)');
      sky.addColorStop(0.55, intense ? 'rgba(50,70,95,0.04)' : 'rgba(70,90,115,0.02)');
      sky.addColorStop(1, 'rgba(60,80,110,0.03)');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      const gY = groundY();
      const windForce = wind + ptr.gustX;

      // Integrate all drops first.
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]!;

        // Gravity
        d.vy += GRAVITY * dt;
        // Horizontal wind (stronger on lighter / smaller drops)
        const windInfluence = windForce / (1 + d.r * 0.35);
        d.vx += (windInfluence - d.vx * 0.15) * dt * 2.2;
        d.vx += ptr.gustY * 0.02 * dt;
        // Quadratic drag → terminal velocity ~ sqrt(r)
        const speed = Math.hypot(d.vx, d.vy);
        if (speed > 1) {
          const drag = DRAG * speed * (0.7 + d.r * 0.15);
          d.vx -= (d.vx / speed) * drag * speed * speed * dt;
          d.vy -= (d.vy / speed) * drag * speed * speed * dt;
        }
        const vTerm = TERM * Math.sqrt(Math.max(0.4, d.r)) * (0.5 + d.depth * 0.55);
        if (d.vy > vTerm) d.vy += (vTerm - d.vy) * Math.min(1, dt * 4);

        d.x += d.vx * dt;
        d.y += d.vy * dt;

        if (d.y >= gY) {
          splash(d.x, gY, d.r, d.depth);
          drops.splice(i, 1);
          continue;
        }
        if (d.x < -60) d.x = w + 40;
        if (d.x > w + 60) d.x = -40;
        if (d.y > h + 40) {
          drops.splice(i, 1);
        }
      }

      // Paint far layer then near layer (depth without sorting every frame).
      for (const d of drops) {
        if (d.depth < 0.5) drawDrop(d);
      }
      for (const d of drops) {
        if (d.depth >= 0.5) drawDrop(d);
      }

      // Splash secondary droplets
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i]!;
        b.life += dt;
        const t = b.life / b.maxLife;
        if (t >= 1) {
          bits.splice(i, 1);
          continue;
        }
        b.vy += GRAVITY * 0.85 * dt;
        b.vx *= 0.98;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230,240,255,${0.55 * (1 - t)})`;
        ctx.fill();
      }

      // Soft wet ground sheen
      const sheen = ctx.createLinearGradient(0, gY - 30, 0, h);
      sheen.addColorStop(0, 'rgba(180,200,220,0)');
      sheen.addColorStop(1, intense ? 'rgba(160,185,210,0.08)' : 'rgba(170,195,220,0.05)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, gY - 30, w, h - (gY - 30));

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

  return <canvas ref={canvasRef} className={styles.rainCanvas} aria-hidden />;
}
