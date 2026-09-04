import { useEffect, useRef } from 'react';
import styles from './WeatherEffects.module.css';

interface Mote {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  phase: number;
  opacity: number;
}

/**
 * Sunny day: a warm, draggable sun with floating light-dust motes.
 * Touch scatters motes; drag the sun across the sky. Passive listeners
 * for motes; sun disc uses pointer-events on a small hit target only.
 */
export function SunRays({ vivid = false }: { vivid?: boolean }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sunHitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const sunHit = sunHitRef.current;
    if (!canvas || !sunHit) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const motes: Mote[] = [];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let disposed = false;
    let t0 = performance.now();
    let last = t0;

    const sun = {
      x: 0,
      y: 0,
      homeX: 0,
      homeY: 0,
      vx: 0,
      vy: 0,
      dragging: false,
      ox: 0,
      oy: 0,
    };

    const ptr = { x: 0, y: 0, px: 0, py: 0, down: false, inside: false };

    const toLocal = (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
      return {
        x: ((clientX - rect.left) / rect.width) * w,
        y: ((clientY - rect.top) / rect.height) * h,
      };
    };

    const placeSunHit = (): void => {
      const size = Math.min(w, h) * 0.14;
      sunHit.style.width = `${size}px`;
      sunHit.style.height = `${size}px`;
      sunHit.style.transform = `translate(${sun.x - size / 2}px, ${sun.y - size / 2}px)`;
    };

    const resize = (): void => {
      const parent = canvas.parentElement;
      if (!parent) return;
      w = parent.clientWidth;
      h = parent.clientHeight;
      if (w < 2 || h < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sun.homeX = w * 0.78;
      sun.homeY = h * 0.1;
      if (!sun.dragging) {
        sun.x = sun.homeX;
        sun.y = sun.homeY;
      }
      placeSunHit();
      if (motes.length === 0) {
        for (let i = 0; i < 55; i++) {
          motes.push({
            x: Math.random() * w,
            y: Math.random() * h * 0.7,
            r: 2 + Math.random() * 5,
            vx: (Math.random() - 0.5) * 12,
            vy: -8 - Math.random() * 18,
            ax: 0,
            ay: 0,
            phase: Math.random() * Math.PI * 2,
            opacity: 0.35 + Math.random() * 0.5,
          });
        }
      }
    };

    const onSunDown = (e: PointerEvent): void => {
      e.stopPropagation();
      sunHit.setPointerCapture(e.pointerId);
      const p = toLocal(e.clientX, e.clientY);
      sun.dragging = true;
      sun.ox = p.x - sun.x;
      sun.oy = p.y - sun.y;
      sun.vx = 0;
      sun.vy = 0;
    };
    const onSunMove = (e: PointerEvent): void => {
      if (!sun.dragging) return;
      e.stopPropagation();
      const p = toLocal(e.clientX, e.clientY);
      sun.x = Math.max(w * 0.1, Math.min(w * 0.92, p.x - sun.ox));
      sun.y = Math.max(h * 0.04, Math.min(h * 0.35, p.y - sun.oy));
      placeSunHit();
    };
    const endSunDrag = (e: PointerEvent): void => {
      if (!sun.dragging) return;
      e.stopPropagation();
      sun.dragging = false;
      sun.vx = (sun.homeX - sun.x) * 0.15;
      sun.vy = (sun.homeY - sun.y) * 0.15;
    };
    sunHit.addEventListener('pointerdown', onSunDown);
    sunHit.addEventListener('pointermove', onSunMove);
    sunHit.addEventListener('pointerup', endSunDrag);
    sunHit.addEventListener('pointercancel', endSunDrag);

    const onPointerDown = (e: PointerEvent): void => {
      const p = toLocal(e.clientX, e.clientY);
      ptr.down = true;
      ptr.inside = p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;
      ptr.x = ptr.px = p.x;
      ptr.y = ptr.py = p.y;
      if (!ptr.inside) return;
      for (const m of motes) {
        const dist = Math.hypot(m.x - p.x, m.y - p.y);
        if (dist < 100) {
          const ang = Math.atan2(m.y - p.y, m.x - p.x);
          const force = (1 - dist / 100) * 260;
          m.ax += Math.cos(ang) * force;
          m.ay += Math.sin(ang) * force - 30;
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
      if (!ptr.inside || (!ptr.down && e.pointerType === 'mouse' && e.buttons === 0)) return;
      const mx = ptr.x - ptr.px;
      const my = ptr.y - ptr.py;
      if (Math.hypot(mx, my) < 0.4) return;
      for (const m of motes) {
        const dist = Math.hypot(m.x - ptr.x, m.y - ptr.y);
        if (dist > 130) continue;
        const falloff = 1 - dist / 130;
        m.ax += mx * 20 * falloff;
        m.ay += my * 16 * falloff;
      }
    };

    const onPointerUp = (): void => {
      ptr.down = false;
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    const draw = (now: number): void => {
      if (disposed) return;
      const dt = Math.min((now - last) / 1000, 0.048);
      last = now;
      const t = (now - t0) / 1000;

      if (w < 2 || h < 2) {
        raf = requestAnimationFrame(draw);
        return;
      }

      if (!sun.dragging) {
        sun.vx += (sun.homeX - sun.x) * 0.4 * dt;
        sun.vy += (sun.homeY - sun.y) * 0.4 * dt;
        sun.vx *= 0.92;
        sun.vy *= 0.92;
        sun.x += sun.vx * dt * 60;
        sun.y += sun.vy * dt * 60;
        // Idle bob
        sun.y += Math.sin(t * 0.6) * 0.15;
        placeSunHit();
      }

      ctx.clearRect(0, 0, w, h);
      const a = vivid ? 1 : 0.9;
      const pulse = 0.94 + Math.sin(t * 0.8) * 0.06;

      // Warm ambient from sun position
      const wash = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, Math.max(w, h) * 0.65);
      wash.addColorStop(0, `rgba(255, 230, 160, ${0.28 * a * pulse})`);
      wash.addColorStop(0.3, `rgba(255, 210, 120, ${0.1 * a})`);
      wash.addColorStop(1, 'rgba(255, 190, 100, 0)');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);

      // Soft rotating shafts (fewer, subtler)
      ctx.save();
      ctx.translate(sun.x, sun.y);
      ctx.rotate(t * 0.03);
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2;
        ctx.save();
        ctx.rotate(ang);
        const ray = ctx.createLinearGradient(0, 0, 0, h * 0.55);
        ray.addColorStop(0, `rgba(255, 245, 200, ${0.14 * a * pulse})`);
        ray.addColorStop(1, 'rgba(255, 220, 140, 0)');
        ctx.fillStyle = ray;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-w * 0.06, h * 0.55);
        ctx.lineTo(w * 0.06, h * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // Sun core
      const coreR = Math.min(w, h) * 0.06;
      const core = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, coreR * 2.6);
      core.addColorStop(0, `rgba(255, 255, 250, ${0.98 * a})`);
      core.addColorStop(0.2, `rgba(255, 240, 170, ${0.85 * a})`);
      core.addColorStop(0.5, `rgba(255, 200, 90, ${0.35 * a})`);
      core.addColorStop(1, 'rgba(255, 170, 60, 0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, coreR * 2.6, 0, Math.PI * 2);
      ctx.fill();

      // Light dust motes
      for (const m of motes) {
        m.vx += m.ax * dt;
        m.vy += m.ay * dt;
        m.ax *= Math.pow(0.06, dt);
        m.ay *= Math.pow(0.06, dt);

        // Drift upward toward the sun's warmth + side sway
        const toSunX = sun.x - m.x;
        const toSunY = sun.y - m.y;
        m.vx += toSunX * 0.0008 * dt * 60;
        m.vy += toSunY * 0.0004 * dt * 60 - 6 * dt;
        m.vx += Math.sin(t * 0.7 + m.phase) * 8 * dt;
        m.vx *= 0.99;
        m.vy *= 0.995;
        m.x += m.vx * dt;
        m.y += m.vy * dt;

        if (m.y < -20 || m.x < -30 || m.x > w + 30 || m.y > h + 30) {
          m.x = Math.random() * w;
          m.y = h * 0.3 + Math.random() * h * 0.5;
          m.vx = (Math.random() - 0.5) * 10;
          m.vy = -10 - Math.random() * 15;
        }

        const twinkle = 0.7 + Math.sin(t * 3 + m.phase) * 0.3;
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 2);
        g.addColorStop(0, `rgba(255, 250, 220, ${m.opacity * twinkle})`);
        g.addColorStop(0.5, `rgba(255, 220, 140, ${0.35 * m.opacity * twinkle})`);
        g.addColorStop(1, 'rgba(255, 200, 100, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    raf = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      sunHit.removeEventListener('pointerdown', onSunDown);
      sunHit.removeEventListener('pointermove', onSunMove);
      sunHit.removeEventListener('pointerup', endSunDrag);
      sunHit.removeEventListener('pointercancel', endSunDrag);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [vivid]);

  return (
    <>
      <canvas ref={canvasRef} className={styles.rainCanvas} aria-hidden />
      <div ref={sunHitRef} className={styles.sunHit} role="presentation" />
    </>
  );
}
