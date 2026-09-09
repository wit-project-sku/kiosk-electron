/**
 * Tracks the screen-space rectangles of tappable UI (buttons, role="button"
 * cards) so the weather layers can treat them as PHYSICAL objects — rain
 * splashes on a tile and slips off its edge, snow piles up along its top.
 *
 * Rects are converted into the fx canvas' local coordinate space (which may be
 * CSS-transform scaled on the kiosk), refreshed on a slow poll — home layouts
 * are static, so 800ms is plenty — and keyed by element so per-obstacle state
 * (a snow pile) survives a refresh.
 */

export interface ObstacleRect {
  el: Element;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ObstacleTracker {
  /** Current rects, canvas-local. Mutated in place on each poll. */
  rects: ObstacleRect[];
  refresh: () => void;
  dispose: () => void;
}

const POLL_MS = 800;

export function createObstacleTracker(
  canvas: HTMLCanvasElement,
  getSize: () => { w: number; h: number },
): ObstacleTracker {
  const rects: ObstacleRect[] = [];

  const refresh = (): void => {
    const { w, h } = getSize();
    rects.length = 0;
    if (w < 2 || h < 2) return;
    const cr = canvas.getBoundingClientRect();
    if (cr.width < 2 || cr.height < 2) return;

    const sx = w / cr.width;
    const sy = h / cr.height;
    const candidates = document.querySelectorAll('button, [role="button"], [data-weather-solid]');

    for (const el of candidates) {
      // The fx layer's own switcher buttons are not part of the scene.
      if (el.closest('[data-weather-fx-layer]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue; // hidden / collapsed

      const x = (r.left - cr.left) * sx;
      const y = (r.top - cr.top) * sy;
      const rw = r.width * sx;
      const rh = r.height * sy;

      // On-screen, plausibly object-sized. Full-screen invisible dismiss
      // targets (e.g. the weather panel's backdrop button) are not objects.
      if (x + rw < 0 || x > w || y + rh < 0 || y > h) continue;
      if (rw < 40 || rh < 40) continue;
      if (rw * rh > w * h * 0.5) continue;

      rects.push({ el, x, y, w: rw, h: rh });
    }
  };

  const id = window.setInterval(refresh, POLL_MS);
  refresh();

  return {
    rects,
    refresh,
    dispose: () => window.clearInterval(id),
  };
}
