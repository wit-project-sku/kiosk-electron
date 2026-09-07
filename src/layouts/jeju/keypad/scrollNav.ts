/**
 * Scrolling for the 제주 keypad, for the screens spatial navigation cannot help
 * with on its own.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * spatialNav moves a ring between things that can be PRESSED. That is the whole
 * story on the home grid, but it is not the story on 항공편, 여객선 or any other
 * board whose content is data rather than controls: the flight list is `<div>`
 * rows of `<span>` cells inside an `overflow-y: auto` box, and there is not one
 * focusable element among them. Arrows found no candidate, `pickNext` returned
 * null, and the pad did nothing at all — on precisely the screen a visitor is
 * most likely to be standing in front of, reading.
 *
 * A sighted visitor drags the list with a finger. The pad has to be able to do
 * the same thing, so ▲▼ fall back to scrolling whatever box holds the content.
 *
 * ── What counts as the box ──────────────────────────────────────────────────
 * Found by measurement, never by class name: 제주 has thirteen screens with
 * their own scroll container, each a hashed CSS-module class, and a list keyed
 * on those would rot the first time one was renamed. An element scrolls if its
 * computed overflow allows it AND its content actually overflows.
 */

import type { Dir } from './spatialNav';

/** Overflow values that let the box scroll rather than clip or grow. */
const SCROLLABLE_OVERFLOW = /^(auto|scroll|overlay)$/;

/**
 * Slack, in px, before an overflow counts as real.
 *
 * Sub-pixel rounding at the kiosk's scale routinely leaves scrollHeight a
 * fraction over clientHeight on boxes that are not meant to scroll at all;
 * without this the pad would "scroll" them by nothing and swallow the press.
 */
const OVERFLOW_SLACK = 2;

function axisOf(dir: Dir): 'y' | 'x' {
  return dir === 'up' || dir === 'down' ? 'y' : 'x';
}

/** True when `el` is a box that can actually be scrolled on `axis`. */
function isScrollable(el: HTMLElement, axis: 'y' | 'x'): boolean {
  const cs = getComputedStyle(el);
  const overflow = axis === 'y' ? cs.overflowY : cs.overflowX;
  if (!SCROLLABLE_OVERFLOW.test(overflow)) return false;
  return axis === 'y'
    ? el.scrollHeight - el.clientHeight > OVERFLOW_SLACK
    : el.scrollWidth - el.clientWidth > OVERFLOW_SLACK;
}

/** The nearest scrollable box at or above `el`, or null. */
export function scrollableAncestor(el: Element | null, dir: Dir): HTMLElement | null {
  const axis = axisOf(dir);
  for (let node = el as HTMLElement | null; node; node = node.parentElement) {
    if (isScrollable(node, axis)) return node;
  }
  return null;
}

/**
 * The scrollable box the visitor is most likely to mean, when the ring is not
 * inside one.
 *
 * The biggest visible one wins. On every 제주 screen that has more than one —
 * a long list beside a short chip rail — the content box is by far the larger,
 * and "the big panel of stuff" is what someone pressing ▼ is looking at.
 */
export function largestScroller(root: ParentNode, dir: Dir): HTMLElement | null {
  const axis = axisOf(dir);
  let best: HTMLElement | null = null;
  let bestArea = 0;

  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    // Cheap rejections first: this walks the whole screen on every arrow press.
    if (el.closest('[data-keypad-inert]')) continue;
    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area <= bestArea) continue;
    if (!isScrollable(el, axis)) continue;
    best = el;
    bestArea = area;
  }

  return best;
}

/** True when `el` still has somewhere to go in `dir`. */
export function canScroll(el: HTMLElement, dir: Dir): boolean {
  switch (dir) {
    case 'up':
      return el.scrollTop > OVERFLOW_SLACK;
    case 'down':
      return el.scrollTop < el.scrollHeight - el.clientHeight - OVERFLOW_SLACK;
    case 'left':
      return el.scrollLeft > OVERFLOW_SLACK;
    case 'right':
      return el.scrollLeft < el.scrollWidth - el.clientWidth - OVERFLOW_SLACK;
  }
}

/**
 * How long to wait before deciding a smooth scroll is not going to happen.
 *
 * Long enough that a real animation has visibly started (it advances within a
 * frame or two), short enough that the instant fallback still reads as the
 * response to the key that was pressed rather than as a second, later jump.
 */
const SMOOTH_GRACE_MS = 150;

/** Movement below this is indistinguishable from an animation that never ran. */
const MOVED_EPSILON = 1;

/**
 * Ask for a smooth scroll, and take an instant one if it does not happen.
 *
 * `behavior: 'smooth'` is not a promise. Chromium runs it on the compositor,
 * and where the compositor is not producing frames for this document the call
 * is silently dropped — the scroll position simply never changes, with no error
 * and no fallback. Measured here: in a Chromium surface whose frames are
 * throttled, `scrollBy({ behavior: 'smooth' })` moved a box by nothing while
 * the identical call with `behavior: 'auto'` moved it correctly.
 *
 * On a kiosk that is not an animation glitch, it is a dead key: the visitor
 * presses ▼ on the flight board and the machine does nothing. So the smooth
 * scroll is asked for first — it is the better experience, and it is what
 * happens on the panel in normal operation — and if the box has not moved a
 * short moment later, the same distance is applied instantly.
 */
function scrollWithFallback(el: HTMLElement, top: number, left: number): void {
  const axis: 'y' | 'x' = top !== 0 ? 'y' : 'x';
  const read = (): number => (axis === 'y' ? el.scrollTop : el.scrollLeft);
  const before = read();

  el.scrollBy({ top, left, behavior: 'smooth' });

  // A timer rather than rAF: the case being covered is a document whose frames
  // are not being produced, and rAF is exactly what stops in that case.
  window.setTimeout(() => {
    if (Math.abs(read() - before) > MOVED_EPSILON) return;
    el.scrollBy({ top, left, behavior: 'auto' });
  }, SMOOTH_GRACE_MS);
}

/**
 * Bring `el` into view, as little as possible, with the same guarantee.
 *
 * The ring is only useful if the visitor can see it, and walking a long list
 * moves it below the fold within a few presses. `scrollIntoView` carries the
 * identical dropped-animation risk as {@link scrollStep} — measured: a ring
 * walked nine rows down a 60-row box while the box never scrolled at all, so
 * the ring the whole scheme depends on was sitting off-screen.
 *
 * `stillWanted` guards the fallback against a visitor who kept pressing: by the
 * time it fires the ring may have moved on, and yanking the view back to where
 * it used to be would be worse than the dropped animation.
 */
export function reveal(el: HTMLElement, stillWanted: () => boolean): void {
  const options: ScrollIntoViewOptions = { block: 'nearest', inline: 'nearest' };
  const top = (): number => el.getBoundingClientRect().top;
  const before = top();

  el.scrollIntoView({ ...options, behavior: 'smooth' });

  window.setTimeout(() => {
    if (!stillWanted()) return;
    if (Math.abs(top() - before) > MOVED_EPSILON) return;
    el.scrollIntoView({ ...options, behavior: 'auto' });
  }, SMOOTH_GRACE_MS);
}

/**
 * Scroll `el` by `fraction` of its own visible size. Returns false when it was
 * already at that end, so the caller can fall through to something else.
 *
 * Measured against the box rather than the window because the box IS what the
 * visitor is reading; a fraction of a 3840px panel would overshoot a list
 * occupying a third of it.
 */
export function scrollStep(el: HTMLElement, dir: Dir, fraction: number): boolean {
  if (!canScroll(el, dir)) return false;

  const amount =
    axisOf(dir) === 'y' ? el.clientHeight * fraction : el.clientWidth * fraction;

  scrollWithFallback(
    el,
    dir === 'up' ? -amount : dir === 'down' ? amount : 0,
    dir === 'left' ? -amount : dir === 'right' ? amount : 0,
  );
  return true;
}
