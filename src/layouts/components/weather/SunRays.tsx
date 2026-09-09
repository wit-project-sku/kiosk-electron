import { useEffect, useRef } from 'react';
import {
  createAnamorphicStreakTexture,
  createBokehDiscTexture,
  createHexagonalIrisTexture,
  createRayTexture,
  createStarburstTexture,
  createSunTexture,
} from './weatherTextures';
import styles from './WeatherEffects.module.css';

interface DustMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  r: number;
  phase: number;
  opacity: number;
}

/**
 * Photorealistic Optical Sun & Lens Flare Simulation.
 * Features:
 * - Natural solar disc with chromatic corona and atmospheric blooming wash.
 * - Starburst diffraction spikes and anamorphic horizontal glare streak.
 * - Multi-element optical lens flare ghosts (hexagonal aperture ghosts, chromatic halos)
 *   aligned along the camera optical axis.
 * - Volumetric crepuscular god-rays piercing through the atmosphere.
 * - Floating golden dust motes with optical defocus bokeh.
 * - Interactive touch drag and pointer deflection physics.
 */
export function SunRays({ vivid = false }: { vivid?: boolean }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const hit = hitRef.current;
    if (!canvas || !hit) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let disposed = false;
    const t0 = performance.now();

    // Generate optical assets
    const sunTex = createSunTexture(512);
    const starburstTex = createStarburstTexture(420);
    const streakTex = createAnamorphicStreakTexture(1200, 120);
    const rayTex = createRayTexture(240, 1000);
    const irisGold = createHexagonalIrisTexture(200, 'rgba(255, 215, 130, 0.35)');
    const irisCyan = createHexagonalIrisTexture(160, 'rgba(175, 235, 255, 0.28)');
    const irisViolet = createHexagonalIrisTexture(240, 'rgba(235, 195, 255, 0.25)');
    const bokehMote = createBokehDiscTexture(96, 'rgba(255, 235, 165, 0.7)');

    const sun = {
      x: 0,
      y: 0,
      homeX: 0,
      homeY: 0,
      dragging: false,
      ox: 0,
      oy: 0,
      vx: 0,
      vy: 0,
    };

    const motes: DustMote[] = [];
    const moteCount = vivid ? 55 : 38;

    const toLocal = (cx: number, cy: number): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((cx - rect.left) / rect.width) * w,
        y: ((cy - rect.top) / rect.height) * h,
      };
    };

    const placeHit = (): void => {
      const s = Math.min(w, h) * 0.18;
      hit.style.width = `${s}px`;
      hit.style.height = `${s}px`;
      hit.style.transform = `translate(${sun.x - s / 2}px, ${sun.y - s / 2}px)`;
    };

    const initMotes = (): void => {
      motes.length = 0;
      for (let i = 0; i < moteCount; i++) {
        motes.push({
          x: Math.random() * w,
          y: h * 0.05 + Math.random() * h * 0.45,
          vx: (Math.random() - 0.5) * 15,
          vy: -8 - Math.random() * 20,
          ax: 0,
          ay: 0,
          r: 3.5 + Math.random() * 6.5,
          phase: Math.random() * Math.PI * 2,
          opacity: 0.45 + Math.random() * 0.5,
        });
      }
    };

    /**
     * The sun's rest position sits EXACTLY on the weather card's icon: the home
     * screen marks that <img> with data-weather-sun-anchor and we read its live
     * rect (which tracks low-reach layout shifts and any kiosk CSS scaling).
     * Layouts without an anchor keep the old upper-right estimate.
     */
    const measureHome = (): void => {
      const anchor = document.querySelector('[data-weather-sun-anchor]');
      const cr = canvas.getBoundingClientRect();
      if (anchor && cr.width > 2 && cr.height > 2) {
        const r = anchor.getBoundingClientRect();
        if (r.width > 2) {
          sun.homeX = ((r.left + r.width / 2 - cr.left) / cr.width) * w;
          sun.homeY = ((r.top + r.height / 2 - cr.top) / cr.height) * h;
          return;
        }
      }
      sun.homeX = w * 0.82;
      sun.homeY = h * 0.085;
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

      measureHome();
      if (!sun.dragging) {
        sun.x = sun.homeX;
        sun.y = sun.homeY;
      }
      placeHit();
      if (motes.length === 0) initMotes();
    };

    const onDown = (e: PointerEvent): void => {
      e.stopPropagation();
      hit.setPointerCapture(e.pointerId);
      const p = toLocal(e.clientX, e.clientY);
      sun.dragging = true;
      sun.ox = p.x - sun.x;
      sun.oy = p.y - sun.y;
    };

    const onMove = (e: PointerEvent): void => {
      if (!sun.dragging) return;
      const p = toLocal(e.clientX, e.clientY);
      const nx = Math.max(w * 0.08, Math.min(w * 0.94, p.x - sun.ox));
      const ny = Math.max(h * 0.03, Math.min(h * 0.45, p.y - sun.oy));
      sun.vx = (nx - sun.x) * 0.4;
      sun.vy = (ny - sun.y) * 0.4;
      sun.x = nx;
      sun.y = ny;
      placeHit();

      // Stir dust motes away from touch
      for (const m of motes) {
        const dx = m.x - p.x;
        const dy = m.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 240) {
          const force = (1 - dist / 240) * 140;
          m.ax += (dx / (dist + 1)) * force;
          m.ay += (dy / (dist + 1)) * force;
        }
      }
    };

    const onUp = (): void => {
      sun.dragging = false;
    };

    hit.addEventListener('pointerdown', onDown);
    hit.addEventListener('pointermove', onMove);
    hit.addEventListener('pointerup', onUp);
    hit.addEventListener('pointercancel', onUp);

    let last = performance.now();
    let frame = 0;
    const step = (now: number): void => {
      if (disposed) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = (now - t0) / 1000;

      if (w < 2 || h < 2) {
        raf = requestAnimationFrame(step);
        return;
      }

      // Re-anchor to the weather icon about once a second — the card moves when
      // low-reach mode toggles, and the anchor may mount after this canvas does.
      if (frame++ % 60 === 0) measureHome();

      if (!sun.dragging) {
        sun.x += (sun.homeX - sun.x) * 0.03;
        sun.y += (sun.homeY - sun.y) * 0.03 + Math.sin(t * 0.6) * 0.25;
        placeHit();
      }

      ctx.clearRect(0, 0, w, h);

      const alpha = vivid ? 1.0 : 0.85;
      const pulse = 0.94 + Math.sin(t * 0.75) * 0.06;
      const sunSize = Math.min(w, h) * (vivid ? 0.25 : 0.21) * pulse;

      // ── 1. Warm Atmospheric Daylight Bloom Wash ──
      const bloom = ctx.createRadialGradient(
        sun.x,
        sun.y,
        0,
        sun.x,
        sun.y,
        Math.max(w, h) * 0.65,
      );
      bloom.addColorStop(0, `rgba(255, 238, 175, ${0.34 * alpha * pulse})`);
      bloom.addColorStop(0.35, `rgba(255, 218, 135, ${0.13 * alpha})`);
      bloom.addColorStop(0.75, `rgba(255, 195, 95, ${0.04 * alpha})`);
      bloom.addColorStop(1, 'rgba(255, 180, 80, 0)');
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, w, h);

      // ── 2. Rotating Volumetric Crepuscular Rays ──
      const rayCount = 8;
      const rayLen = Math.max(w, h) * 0.7;
      const rayWidth = w * 0.13;
      for (let i = 0; i < rayCount; i++) {
        const ang = (i * Math.PI * 2) / rayCount + t * 0.02;
        const rayPulse = 0.8 + Math.sin(t * 1.1 + i) * 0.2;

        ctx.save();
        ctx.translate(sun.x, sun.y);
        ctx.rotate(ang);
        ctx.globalAlpha = 0.35 * alpha * rayPulse;
        ctx.drawImage(rayTex, -rayWidth * 0.5, 0, rayWidth, rayLen);
        ctx.restore();
      }

      // ── 3. Anamorphic Horizontal Glare Streak ──
      ctx.save();
      ctx.globalAlpha = 0.55 * alpha * pulse;
      const streakW = w * 0.85;
      const streakH = 70 * pulse;
      ctx.drawImage(streakTex, sun.x - streakW * 0.5, sun.y - streakH * 0.5, streakW, streakH);
      ctx.restore();

      // ── 4. Starburst Diffraction Spikes ──
      ctx.save();
      ctx.translate(sun.x, sun.y);
      ctx.rotate(t * 0.015);
      ctx.globalAlpha = 0.7 * alpha * pulse;
      const sbSize = sunSize * 1.9;
      ctx.drawImage(starburstTex, -sbSize * 0.5, -sbSize * 0.5, sbSize, sbSize);
      ctx.restore();

      // ── 5. Radiant Sun Disc (Core & Corona) ──
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(sunTex, sun.x - sunSize * 0.5, sun.y - sunSize * 0.5, sunSize, sunSize);
      ctx.restore();

      // ── 6. Optical Lens Flare Ghosts Along Lens Axis ──
      const viewCX = w * 0.5;
      const viewCY = h * 0.5;
      const axisX = viewCX - sun.x;
      const axisY = viewCY - sun.y;

      type FlareGhost = { dist: number; tex: HTMLCanvasElement; size: number; alpha: number };
      const ghosts: FlareGhost[] = [
        { dist: 0.35, tex: irisGold, size: sunSize * 0.65, alpha: 0.45 },
        { dist: 0.65, tex: irisCyan, size: sunSize * 0.45, alpha: 0.38 },
        { dist: 0.95, tex: irisViolet, size: sunSize * 0.85, alpha: 0.32 },
        { dist: 1.35, tex: irisGold, size: sunSize * 0.5, alpha: 0.25 },
        { dist: -0.25, tex: irisCyan, size: sunSize * 0.35, alpha: 0.4 },
      ];

      for (const g of ghosts) {
        const gx = sun.x + axisX * g.dist;
        const gy = sun.y + axisY * g.dist;
        ctx.save();
        ctx.globalAlpha = g.alpha * alpha * pulse;
        ctx.drawImage(g.tex, gx - g.size * 0.5, gy - g.size * 0.5, g.size, g.size);
        ctx.restore();
      }

      // ── 7. Floating Golden Defocus Bokeh Dust Motes ──
      for (const m of motes) {
        m.vx += m.ax * dt;
        m.vy += m.ay * dt;
        m.ax *= Math.pow(0.08, dt);
        m.ay *= Math.pow(0.08, dt);

        const toSunX = sun.x - m.x;
        const toSunY = sun.y - m.y;
        m.vx += toSunX * 0.0006 * dt * 60;
        m.vy += toSunY * 0.0003 * dt * 60 - 8 * dt;
        m.vx += Math.sin(t * 0.8 + m.phase) * 6 * dt;

        m.x += m.vx * dt;
        m.y += m.vy * dt;

        if (m.y < -30 || m.x < -30 || m.x > w + 30 || m.y > h * 0.6) {
          m.x = Math.random() * w;
          m.y = h * 0.2 + Math.random() * h * 0.35;
          m.vx = (Math.random() - 0.5) * 12;
          m.vy = -8 - Math.random() * 16;
        }

        const twinkle = 0.65 + Math.sin(t * 2.8 + m.phase) * 0.35;
        const ms = m.r * (vivid ? 4.5 : 3.5);

        ctx.save();
        ctx.globalAlpha = m.opacity * twinkle * alpha;
        ctx.drawImage(bokehMote, m.x - ms * 0.5, m.y - ms * 0.5, ms, ms);
        ctx.restore();
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
      hit.removeEventListener('pointerdown', onDown);
      hit.removeEventListener('pointermove', onMove);
      hit.removeEventListener('pointerup', onUp);
      hit.removeEventListener('pointercancel', onUp);
    };
  }, [vivid]);

  return (
    <>
      <canvas ref={canvasRef} className={styles.fxCanvas} aria-hidden />
      <div ref={hitRef} className={styles.sunHit} role="presentation" />
    </>
  );
}
