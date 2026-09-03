/**
 * Geometry for the 제주 keypad's arrow navigation.
 *
 * Pure functions over DOMRects, deliberately free of React and of the DOM's
 * focus machinery, so the "which button is up from here" decision can be
 * reasoned about (and later tested) on its own.
 *
 * Why spatial and not DOM order: the 제주 screens are absolutely positioned on a
 * 2160×3840 artboard, and source order does not reliably match what the eye
 * sees — the home grid, the header's 홈/뒤로 pair and the left nav rail are all
 * authored in the order Figma emitted them, not in reading order. Tab-order
 * traversal would jump around the screen. Nearest-in-direction does not.
 *
 * NOTE on units: every rect here is in VIEWPORT pixels, i.e. artboard px scaled
 * by --kiosk-scale (0.25-ish on a dev laptop, 1.0 on the kiosk's own 4K panel).
 * Comparisons are all relative so the scale cancels out; the two absolute
 * thresholds below are the exception and are commented where they are used.
 */

/** Direction of an arrow-key move. */
export type Dir = 'up' | 'down' | 'left' | 'right';

/** A candidate the pad can land on, with its measured position. */
export interface Target {
  el: HTMLElement;
  rect: DOMRect;
}

/**
 * What counts as a landing spot.
 *
 * `[role="button"]` earns its place: the 제주 home screen builds its weather
 * panel and search field as divs with that role rather than real `<button>`s
 * (see JejuHome), and they are as tappable as anything else on the screen. They
 * are not natively focusable, which is handled at focus time, not here.
 */
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[role="button"]',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Tags the browser will focus without help. Anything else needs a tabindex. */
const NATIVELY_FOCUSABLE = /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/;

/** True when `el` needs a tabindex before `.focus()` will do anything. */
export function needsTabIndex(el: HTMLElement): boolean {
  return !NATIVELY_FOCUSABLE.test(el.tagName) && !el.hasAttribute('tabindex');
}

/**
 * Every reachable landing spot under `root`, unordered.
 *
 * The filtering matters more than the selector does. Three kinds of element
 * match the selector but must never be landed on:
 *
 *  - **Anything under `[data-keypad-inert]`.** JejuKiosk keeps the WIT Store,
 *    탐나오 and 기부 webview layers mounted from boot so their guest processes
 *    are warm, collapsing the inactive ones to 0×0. Their own chrome (header,
 *    tab row) still has layout inside that clipped box and still reports a real
 *    rect, so without this the pad would walk into the headers of three screens
 *    the visitor cannot see. JejuKiosk marks them; see that file.
 *  - **Zero-sized elements**, the ordinary case of "not rendered right now".
 *  - **`visibility: hidden` / `pointer-events: none`**, which have layout but
 *    are not there for the visitor either.
 */
export function collectTargets(root: ParentNode): Target[] {
  const out: Target[] = [];
  const seen = new Set<Element>();

  for (const el of root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
    // A div that is both [role="button"] and [tabindex] matches twice.
    if (seen.has(el)) continue;
    seen.add(el);

    if (el.closest('[data-keypad-inert]')) continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;

    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;

    out.push({ el, rect });
  }

  return out;
}

function centreX(r: DOMRect): number {
  return r.left + r.width / 2;
}

function centreY(r: DOMRect): number {
  return r.top + r.height / 2;
}

/**
 * How far `b` lies from `a` along the direction of travel.
 *
 * Measured centre-to-centre. Zero or negative means `b` is level with `a` or
 * behind it, so it is not a candidate for this move at all.
 */
function forwardDist(a: DOMRect, b: DOMRect, dir: Dir): number {
  switch (dir) {
    case 'up':
      return centreY(a) - centreY(b);
    case 'down':
      return centreY(b) - centreY(a);
    case 'left':
      return centreX(a) - centreX(b);
    case 'right':
      return centreX(b) - centreX(a);
  }
}

/**
 * Gap between the two rects on the axis PERPENDICULAR to the move — 0 when they
 * overlap at all on that axis.
 *
 * Edge-to-edge rather than centre-to-centre on purpose. Pressing ▼ from a
 * narrow tile onto a full-width row below it should feel like a straight move
 * down; by centres, the wide row's centre could be far off to one side and lose
 * to something diagonal. Overlap means "lined up", whatever the widths.
 */
function crossGap(a: DOMRect, b: DOMRect, dir: Dir): number {
  const overlap =
    dir === 'up' || dir === 'down'
      ? Math.min(a.right, b.right) - Math.max(a.left, b.left)
      : Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return overlap > 0 ? 0 : -overlap;
}

/**
 * How much drifting sideways costs, relative to distance travelled forward.
 *
 * Above 1 so a straight-ahead neighbour beats a closer diagonal one — the whole
 * point of the arrow keys is that ▼ goes down. Tuned by feel on the home grid:
 * lower and ▼ starts sliding into the next column, much higher and a genuinely
 * offset next row becomes unreachable.
 */
const CROSS_PENALTY = 2.5;

/**
 * Ignore candidates less than this far ahead (viewport px).
 *
 * Guards against elements that share a centre line — a label stacked exactly on
 * its own button, say — where floating-point noise decides the winner. One
 * viewport pixel is sub-artboard-pixel at every scale we run at, so this only
 * ever rejects true ties.
 */
const MIN_ADVANCE = 1;

/**
 * The best landing spot from `current` in `dir`, or null at the edge.
 *
 * Deliberately does NOT wrap around. On a kiosk, a ▶ that silently teleports
 * back to the left-hand column reads as a glitch; nothing happening reads as
 * "that is the edge", which is the truth.
 */
export function pickNext(
  current: DOMRect,
  targets: readonly Target[],
  dir: Dir,
): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const t of targets) {
    const forward = forwardDist(current, t.rect, dir);
    if (forward <= MIN_ADVANCE) continue;

    const score = forward + crossGap(current, t.rect, dir) * CROSS_PENALTY;
    if (score < bestScore) {
      bestScore = score;
      best = t.el;
    }
  }

  return best;
}

/**
 * Rows tolerance for {@link readingOrder}, in viewport px.
 *
 * Two elements within this much of each other vertically count as the same row
 * and sort left-to-right. At the kiosk's own scale that is 12 artboard px, well
 * under the smallest gap between 제주's stacked rows and well over the
 * sub-pixel differences between tiles that are meant to be level.
 */
const ROW_TOLERANCE = 12;

/** Targets in reading order — top to bottom, then left to right within a row. */
export function readingOrder(targets: readonly Target[]): Target[] {
  return [...targets].sort((a, b) => {
    const dy = a.rect.top - b.rect.top;
    if (Math.abs(dy) > ROW_TOLERANCE) return dy;
    return a.rect.left - b.rect.left;
  });
}
