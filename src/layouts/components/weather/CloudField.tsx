import { useEffect, useRef } from 'react';
import { createCloudTexture } from './weatherTextures';
import styles from './WeatherEffects.module.css';

interface CloudInstance {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeY: number;
  scale: number;
  opacity: number;
  variant: 0 | 1 | 2 | 3;
  poke: number;
  tilt: number;
  phase: number;
  isDragging: boolean;
  ox: number;
  oy: number;
}

interface CloudFieldProps {
  light?: boolean;
}

/**
 * Realistic Textured Cloud Layer.
 * Renders volumetric cumulus billows with directional sunlight rims, shaded bellies,
 * multi-depth parallax, thermal float, and fluid touch squash/stretch interaction.
 */
export function CloudField({ light = false }: CloudFieldProps): JSX.Element {
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

    // Pre-render 4 cloud archetype textures
    const textures: HTMLCanvasElement[] = [
      createCloudTexture(768, 0), // Hero cumulus billow
      createCloudTexture(768, 1), // Wind-swept cumulus
      createCloudTexture(768, 2), // Fluffy cloud cluster
      createCloudTexture(768, 3), // High-altitude cirrus veil
    ];

    const clouds: CloudInstance[] = [];
    const dragTarget = { id: -1, ox: 0, oy: 0, moved: false };

    // Seed realistic multi-layered clouds
    const seed = (): void => {
      clouds.length = 0;
      // High-altitude background wisps (slower, softer, distant)
      const distantCount = light ? 2 : 3;
      for (let i = 0; i < distantCount; i++) {
        const scale = 0.28 + (i % 2) * 0.08;
        const homeY = 0.03 + i * 0.06;
        clouds.push({
          id: i,
          x: ((i * 0.45 + 0.1) % 1) * w,
          y: homeY * h,
          vx: (0.003 + (i % 2) * 0.002) * w,
          vy: 0,
          homeY,
          scale,
          opacity: light ? 0.45 : 0.60,
          variant: 3, // cirrus
          poke: 0,
          tilt: 0,
          phase: i * 2.1,
          isDragging: false,
          ox: 0,
          oy: 0,
        });
      }

      // Midground volumetric cumulus clouds (main feature clouds)
      const midCount = light ? 3 : 5;
      for (let i = 0; i < midCount; i++) {
        const id = distantCount + i;
        const variant = (i % 3) as 0 | 1 | 2;
        const scale = light ? 0.32 + (i % 3) * 0.06 : 0.38 + (i % 3) * 0.08;
        const homeY = 0.05 + (i % 3) * 0.065 + (i >= 3 ? 0.07 : 0);
        const speed = 0.007 + (i % 3) * 0.0035;
        clouds.push({
          id,
          x: ((i * 0.26 + 0.05) % 1.1) * w,
          y: homeY * h,
          vx: speed * w,
          vy: 0,
          homeY,
          scale,
          opacity: light ? 0.78 : 0.92,
          variant,
          poke: 0,
          tilt: 0,
          phase: id * 1.5,
          isDragging: false,
          ox: 0,
          oy: 0,
        });
      }
    };

    const toLocal = (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * w,
        y: ((clientY - rect.top) / rect.height) * h,
      };
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
      if (clouds.length === 0) seed();
    };

    // Pointer events for tactile cloud drag, squash, and puff
    const onPointerDown = (e: PointerEvent): void => {
      const p = toLocal(e.clientX, e.clientY);
      // Check top-down (foreground clouds first)
      for (let i = clouds.length - 1; i >= 0; i--) {
        const c = clouds[i]!;
        const tex = textures[c.variant]!;
        const cw = c.scale * w;
        const ch = cw * (tex.height / tex.width);
        const left = c.x - cw * 0.5;
        const top = c.y - ch * 0.5;
        if (p.x >= left && p.x <= left + cw && p.y >= top && p.y <= top + ch) {
          dragTarget.id = c.id;
          dragTarget.ox = p.x - c.x;
          dragTarget.oy = p.y - c.y;
          dragTarget.moved = false;
          c.isDragging = true;
          c.poke = 1.0;
          c.vx *= 0.15;
          return;
        }
      }
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (dragTarget.id < 0) return;
      const p = toLocal(e.clientX, e.clientY);
      const c = clouds.find((item) => item.id === dragTarget.id);
      if (!c) return;

      const newX = p.x - dragTarget.ox;
      const newY = Math.max(h * 0.02, Math.min(h * 0.55, p.y - dragTarget.oy));
      if (Math.hypot(newX - c.x, newY - c.y) > 4) dragTarget.moved = true;
      c.tilt = Math.max(-0.15, Math.min(0.15, (newX - c.x) * 0.005));
      c.x = newX;
      c.y = newY;
    };

    const onPointerUp = (): void => {
      if (dragTarget.id >= 0) {
        const c = clouds.find((item) => item.id === dragTarget.id);
        if (c) {
          c.isDragging = false;
          c.poke = 1.0;
          // Impart gentle fling velocity
          const baseSpeed = (c.variant === 3 ? 0.004 : 0.009) * w;
          c.vx = dragTarget.moved ? baseSpeed * 1.5 : baseSpeed * 1.8;
        }
      }
      dragTarget.id = -1;
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    const step = (now: number): void => {
      if (disposed) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (w < 2 || h < 2) {
        raf = requestAnimationFrame(step);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      for (const c of clouds) {
        const tex = textures[c.variant]!;
        const cw = c.scale * w;
        const ch = cw * (tex.height / tex.width);

        if (!c.isDragging) {
          // Horizontal drift with subtle speed modulation
          c.x += c.vx * dt;
          // Gentle thermal bobbing (sine oscillation + home pull)
          c.y += Math.sin(now * 0.0006 + c.phase) * 6 * dt;
          c.y += (c.homeY * h - c.y) * 0.14 * dt;
          c.tilt *= Math.pow(0.1, dt);

          // Wrap around canvas edges with smooth entry
          if (c.x > w + cw * 0.55) {
            c.x = -cw * 0.55;
          }
        }

        // Decay poke squash/stretch
        if (c.poke > 0) {
          c.poke = Math.max(0, c.poke - dt * 2.2);
        }

        const squash = 1 - c.poke * 0.08;
        const stretch = 1 + c.poke * 0.06;

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.tilt);
        ctx.scale(stretch, squash);
        ctx.globalAlpha = c.opacity;

        // Subtle soft drop-shadow for depth separation over light background
        ctx.shadowColor = 'rgba(70, 95, 130, 0.12)';
        ctx.shadowBlur = Math.round(cw * 0.05);
        ctx.shadowOffsetY = Math.round(cw * 0.025);

        ctx.drawImage(tex, -cw * 0.5, -ch * 0.5, cw, ch);
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
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [light]);

  return <canvas ref={canvasRef} className={styles.cloudCanvas} aria-hidden />;
}
