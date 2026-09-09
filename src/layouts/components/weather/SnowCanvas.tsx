import { useEffect, useRef } from 'react';
import {
  createFrostBorderTexture,
  createSnowClumpTexture,
  createSnowflakeTexture,
  createSnowPuffTexture,
} from './weatherTextures';
import { createObstacleTracker } from './screenObstacles';
import styles from './WeatherEffects.module.css';

interface Snowflake {
  x: number;
  y: number;
  py: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  spin: number;
  depth: number;
  flutterPhase: number;
  flutterSpeed: number;
  opacity: number;
  tex: number; // index into the flake texture set
}

/** Loose snow kicked up when a flake settles or a finger brushes a pile. */
interface SnowPuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
}

/** Accumulated snow lying on top of one UI element, as a column heightmap. */
interface SnowPile {
  heights: Float32Array;
  colW: number;
}

const COL_W = 12;
const MAX_PILE = 24;

/**
 * Real snowfall.
 * - Flakes are irregular multi-lobed clumps (with the occasional dendritic
 *   crystal), not circles: three parallax depths, gusty wind, per-flake
 *   fluttering descent and tumbling.
 * - Snow is PHYSICAL: flakes that land on a button or tile settle and build a
 *   soft pile along its top edge, which slowly melts; brushing a finger across
 *   a pile sweeps the snow off in a puff.
 * - A swipe still stirs the whole flurry (wind vortex).
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

    // Texture set: 0-3 irregular clumps, 4 distant powder puff, 5-6 crystals.
    const flakeTex: HTMLCanvasElement[] = [
      createSnowClumpTexture(96, 1),
      createSnowClumpTexture(96, 2),
      createSnowClumpTexture(96, 3),
      createSnowClumpTexture(96, 4),
      createSnowPuffTexture(96),
      createSnowflakeTexture(160, 0),
      createSnowflakeTexture(160, 1),
    ];
    const puffTex = createSnowPuffTexture(96);
    const frostCorner = createFrostBorderTexture(600);

    const flakes: Snowflake[] = [];
    const puffs: SnowPuff[] = [];
    const count = 420;
    let wind = 10;
    let targetWind = wind;

    const obstacles = createObstacleTracker(canvas, () => ({ w, h }));
    const piles = new Map<Element, SnowPile>();

    const ptr = { x: 0, y: 0, px: 0, py: 0, down: false, vortexX: 0, vortexY: 0 };

    const toLocal = (cx: number, cy: number): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((cx - rect.left) / rect.width) * w,
        y: ((cy - rect.top) / rect.height) * h,
      };
    };

    const pileFor = (el: Element, width: number): SnowPile => {
      const cols = Math.max(2, Math.ceil(width / COL_W));
      let pile = piles.get(el);
      if (!pile || pile.heights.length !== cols) {
        pile = { heights: new Float32Array(cols), colW: width / cols };
        piles.set(el, pile);
      } else {
        pile.colW = width / cols;
      }
      return pile;
    };

    const spawnFlake = (anywhere = false): void => {
      const depth = Math.random();
      let r: number;
      let vy: number;
      let tex: number;

      if (depth > 0.82) {
        // Near, big soft clumps drifting past the "camera".
        r = 9 + Math.random() * 8;
        vy = 110 + Math.random() * 70;
        tex = Math.floor(Math.random() * 4);
      } else if (depth >= 0.35) {
        // Mid field: clumps, with a rare crisp crystal for detail.
        r = 5 + Math.random() * 6;
        vy = 65 + Math.random() * 55;
        tex = Math.random() < 0.08 ? 5 + Math.floor(Math.random() * 2) : Math.floor(Math.random() * 4);
      } else {
        // Distant powder.
        r = 2 + Math.random() * 3.5;
        vy = 35 + Math.random() * 35;
        tex = 4;
      }

      const flake: Snowflake = {
        x: Math.random() * (w + 200) - 100,
        y: anywhere ? Math.random() * h : -30 - Math.random() * 60,
        py: 0,
        vx: (Math.random() - 0.5) * 20,
        vy,
        r,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 1.6,
        depth,
        flutterPhase: Math.random() * Math.PI * 2,
        flutterSpeed: 1.2 + Math.random() * 2.2,
        opacity: 0.55 + depth * 0.45,
        tex,
      };
      flake.py = flake.y;
      flakes.push(flake);
    };

    const spawnPuff = (x: number, y: number, vx: number, vy: number): void => {
      if (puffs.length > 90) return;
      puffs.push({
        x,
        y,
        vx: vx + (Math.random() - 0.5) * 90,
        vy: vy - Math.random() * 60,
        r: 3 + Math.random() * 5,
        life: 0.5 + Math.random() * 0.4,
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
        for (let i = 0; i < count; i++) spawnFlake(true);
      }
      obstacles.refresh();
    };

    /** Brush accumulated snow off any pile under the finger. */
    const brushPiles = (x: number, y: number, dx: number, dy: number): void => {
      for (const rect of obstacles.rects) {
        if (x < rect.x - 20 || x > rect.x + rect.w + 20) continue;
        const pile = piles.get(rect.el);
        if (!pile) continue;
        const col = Math.floor((x - rect.x) / pile.colW);
        if (col < 0 || col >= pile.heights.length) continue;
        const surf = rect.y - pile.heights[col]!;
        if (Math.abs(y - surf) > 60) continue;
        for (let c = Math.max(0, col - 3); c <= Math.min(pile.heights.length - 1, col + 3); c++) {
          const removed = Math.min(pile.heights[c]!, 10);
          if (removed > 1 && Math.random() < 0.5) {
            spawnPuff(rect.x + (c + 0.5) * pile.colW, rect.y - pile.heights[c]!, dx * 4, dy * 4);
          }
          pile.heights[c] = pile.heights[c]! - removed;
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
        brushPiles(ptr.x, ptr.y, dx, dy);
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
        targetWind = 12 + (Math.random() - 0.4) * 60;
      }
      wind += (targetWind - wind) * Math.min(1, dt * 1.2);
      ptr.vortexX *= Math.pow(0.08, dt);
      ptr.vortexY *= Math.pow(0.08, dt);

      while (flakes.length < count) spawnFlake(false);

      ctx.clearRect(0, 0, w, h);

      // ── 1. Winter atmospheric wash — a cool overcast veil that dims the
      // scene just enough for white snow to read against light backgrounds. ──
      const winterTint = ctx.createLinearGradient(0, 0, 0, h);
      winterTint.addColorStop(0, 'rgba(96, 122, 158, 0.13)');
      winterTint.addColorStop(0.5, 'rgba(120, 145, 178, 0.09)');
      winterTint.addColorStop(1, 'rgba(140, 162, 190, 0.07)');
      ctx.fillStyle = winterTint;
      ctx.fillRect(0, 0, w, h);

      // ── 2. Border frost crystallization — kept faint: at full strength the
      // fern branches read as cobwebs on the light kiosk background. ──
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.drawImage(frostCorner, 0, 0, 450, 450);
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(frostCorner, 0, 0, 450, 450);
      ctx.restore();
      ctx.restore();

      const rects = obstacles.rects;

      // ── 3. Update & draw snowflakes (with settling) ──
      for (let i = flakes.length - 1; i >= 0; i--) {
        const f = flakes[i]!;
        f.py = f.y;

        f.flutterPhase += f.flutterSpeed * dt;
        const flutterX = Math.sin(f.flutterPhase) * (16 + f.r * 1.4);

        f.y += f.vy * dt;
        f.x += (wind * (0.4 + f.depth * 0.8) + flutterX + ptr.vortexX * f.depth) * dt;
        f.rot += f.spin * dt;

        // Settle onto UI objects: near/mid flakes land on the current snow
        // surface (button top minus pile height) and become part of the pile.
        if (f.depth >= 0.35) {
          let settled = false;
          for (const rect of rects) {
            if (f.x < rect.x || f.x > rect.x + rect.w) continue;
            const pile = pileFor(rect.el, rect.w);
            const col = Math.min(
              pile.heights.length - 1,
              Math.max(0, Math.floor((f.x - rect.x) / pile.colW)),
            );
            const surf = rect.y - pile.heights[col]!;
            if (f.py <= surf && f.y >= surf) {
              const add = f.r * 0.4;
              pile.heights[col] = Math.min(MAX_PILE, pile.heights[col]! + add);
              if (col > 0) {
                pile.heights[col - 1] = Math.min(MAX_PILE, pile.heights[col - 1]! + add * 0.4);
              }
              if (col < pile.heights.length - 1) {
                pile.heights[col + 1] = Math.min(MAX_PILE, pile.heights[col + 1]! + add * 0.4);
              }
              if (f.r > 8) spawnPuff(f.x, surf, f.vx * 0.3, -20);
              settled = true;
              break;
            }
          }
          if (settled) {
            flakes.splice(i, 1);
            continue;
          }
        }

        // 3D axial tumble foreshortening.
        const tiltX = Math.cos(now * 0.0012 + f.flutterPhase) * 0.3 + 0.7;

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.scale(tiltX, 1.0);
        ctx.globalAlpha = f.opacity;

        const tex = flakeTex[f.tex]!;
        if (f.depth > 0.82) {
          // Near clumps render slightly enlarged & translucent — cheap defocus.
          const size = f.r * 2.8;
          ctx.globalAlpha = f.opacity * 0.85;
          ctx.drawImage(tex, -size / 2, -size / 2, size, size);
        } else {
          const size = f.r * 2.2;
          ctx.drawImage(tex, -size / 2, -size / 2, size, size);
        }
        ctx.restore();

        if (f.y > h + 40 || f.x < -150 || f.x > w + 150) {
          flakes.splice(i, 1);
          spawnFlake(false);
        }
      }

      // ── 4. Snow piles resting on the UI ──
      for (const rect of rects) {
        const pile = piles.get(rect.el);
        if (!pile) continue;

        // Slow melt keeps piles alive but never lets them cake permanently.
        let maxH = 0;
        for (let c = 0; c < pile.heights.length; c++) {
          pile.heights[c] = Math.max(0, pile.heights[c]! - (0.3 + pile.heights[c]! * 0.012) * dt);
          if (pile.heights[c]! > maxH) maxH = pile.heights[c]!;
        }
        if (maxH < 0.8) continue;

        // Smooth heightmap outline along the element's top edge. The crest
        // polyline is traced twice: once closed for the fill, once open for a
        // cool crest stroke that keeps the drift visible on white tiles.
        const traceCrest = (): void => {
          ctx.moveTo(rect.x, rect.y - pile.heights[0]! * 0.4);
          for (let c = 0; c < pile.heights.length; c++) {
            const cx = rect.x + (c + 0.5) * pile.colW;
            const cy = rect.y - pile.heights[c]!;
            const nx = rect.x + Math.min(pile.heights.length, c + 1.5) * pile.colW;
            const ncy = rect.y - (pile.heights[Math.min(pile.heights.length - 1, c + 1)] ?? 0);
            ctx.quadraticCurveTo(cx, cy, (cx + nx) / 2, (cy + ncy) / 2);
          }
        };

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(rect.x, rect.y + 3);
        traceCrest();
        ctx.lineTo(rect.x + rect.w, rect.y + 3);
        ctx.closePath();

        const g = ctx.createLinearGradient(0, rect.y - MAX_PILE, 0, rect.y + 3);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
        g.addColorStop(0.7, 'rgba(242, 248, 255, 0.92)');
        g.addColorStop(1, 'rgba(205, 224, 245, 0.75)');
        ctx.fillStyle = g;
        ctx.shadowColor = 'rgba(105, 135, 175, 0.45)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.beginPath();
        traceCrest();
        ctx.strokeStyle = 'rgba(175, 200, 228, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // ── 5. Kicked-up snow dust ──
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i]!;
        p.life -= dt;
        if (p.life <= 0) {
          puffs.splice(i, 1);
          continue;
        }
        p.vy += 160 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const size = p.r * 2.4;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life * 2) * 0.8;
        ctx.drawImage(puffTex, p.x - size / 2, p.y - size / 2, size, size);
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
      obstacles.dispose();
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.fxCanvas} aria-hidden />;
}
