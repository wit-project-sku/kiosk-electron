/**
 * Shrink-to-fit for kiosk text blocks that have nowhere to grow.
 *
 * Every layout here is hand-placed on the fixed 2160×3840 artboard, and the
 * frames are drawn around Korean copy. Korean is the shortest language the
 * kiosk carries: a 340px category tab holds 한식 with room to spare, while the
 * same tab has to hold "Корейская кухня", and a 173px label band sized for
 * 교통안내 has to hold "ข้อมูลการเดินทาง". Those boxes cannot get bigger without
 * moving everything under them.
 *
 * So a fitted box WRAPS first (its CSS gives the text the whole box it has),
 * and this is only the last step, for copy that still outgrows the box after
 * wrapping.
 *
 * ── One factor per group ────────────────────────────────────────────────
 * The factor is shared by every box in the group, not worked out per box: a
 * grid where one tile's label is 38px and its neighbour's 29px reads as broken,
 * while twelve labels one step smaller read as a design. The factor lands on
 * the ROOT as `--fit` and the CSS multiplies each size by it
 * (`calc(38px * var(--fit, 1))`), so the numbers stay in the stylesheet next to
 * the frame values they scale.
 *
 * It never goes below `min`, and nothing is clamped or hidden: past the floor
 * the text simply keeps its full length at the smallest size allowed.
 *
 * Callers gate this on `lang !== 'ko'` (`enabled`), so the Korean screen is
 * drawn exactly as its stylesheet draws it — no measuring, no `--fit`.
 */
import { useLayoutEffect, type RefObject } from 'react';

/** How much the factor drops per try. 0.02 of 60px is ~1px of type. */
const STEP = 0.02;

/** Slack before an overflow counts — sub-pixel rounding at the kiosk's scale. */
const SLACK = 1;

/**
 * Which way a box is allowed to run out of room.
 *
 * `both` is the default and what most fitted blocks want: a box overflows when
 * its text is too TALL for it or too WIDE. Width matters because those blocks
 * never split a word (see the CSS) — a single word longer than the column,
 * "Мероприятие" in the 280 event card, would otherwise sit past the edge at
 * full size when one step smaller fits it.
 *
 * `height` is for a fixed-HEIGHT card whose bottom PADDING is part of the
 * design — the 안녕 card, the 지역화폐 cards. Two differences from `both`:
 *
 *  - Width is not checked. The 안녕 card's rows are drawn 1740 wide inside 1730
 *    of content box; a width check would read that permanent 10px as "still too
 *    big" at every step and drive the factor to its floor even for a language
 *    that fits at full size.
 *  - The content must stay above the bottom padding, not merely inside the
 *    border. Chrome leaves end padding out of `scrollHeight` while the content
 *    still ends inside the border box, so a scrollHeight test let copy run 45px
 *    into the card's 65px bottom padding and still call it a fit — the footer
 *    ended up 5px from the card edge where Korean leaves ~60.
 */
export type FitAxis = 'both' | 'height';

/** How far `b`'s content runs past the top edge of its bottom padding, in px. */
function paddingOverrun(b: HTMLElement): number {
  const style = getComputedStyle(b);
  const top = b.getBoundingClientRect().top + parseFloat(style.borderTopWidth);
  const limit = top + b.clientHeight - parseFloat(style.paddingBottom);
  let bottom = -Infinity;
  for (const child of b.children) bottom = Math.max(bottom, child.getBoundingClientRect().bottom);
  return bottom === -Infinity ? 0 : bottom - limit;
}

function fitGroup(
  root: HTMLElement,
  boxes: readonly HTMLElement[],
  min: number,
  axis: FitAxis,
): void {
  const set = (k: number): void => root.style.setProperty('--fit', String(k));
  const overflowing = (): boolean =>
    boxes.some((b) =>
      axis === 'height'
        ? b.scrollHeight > b.clientHeight + SLACK || paddingOverrun(b) > SLACK
        : b.scrollHeight > b.clientHeight + SLACK || b.scrollWidth > b.clientWidth + SLACK,
    );
  let k = 1;
  set(k);
  while (k > min && overflowing()) {
    k = Math.max(min, Math.round((k - STEP) * 1000) / 1000);
    set(k);
  }
}

/**
 * Fit every `.boxClass` under `rootRef` (and the root itself, when it carries
 * the class) to its own height, by one shared `--fit` on the root.
 *
 * `enabled: false` clears the factor, so a screen that switches back to a
 * layout that needs no fitting (Korean, on the home) is left exactly as its CSS
 * draws it. `contentKey` is whatever text and layout the boxes depend on — the
 * fit re-runs when it changes, and once more when the web fonts finish loading,
 * since a fallback face measures differently from Pretendard.
 */
export function useFitText(
  rootRef: RefObject<HTMLElement | null>,
  boxClass: string | undefined,
  enabled: boolean,
  min: number,
  contentKey: string,
  axis: FitAxis = 'both',
): void {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    if (!enabled || !boxClass) {
      root.style.removeProperty('--fit');
      return undefined;
    }
    const run = (): void => {
      const boxes = [...root.getElementsByClassName(boxClass)] as HTMLElement[];
      if (root.classList.contains(boxClass)) boxes.push(root);
      fitGroup(root, boxes, min, axis);
    };
    run();
    let live = true;
    void document.fonts.ready.then(() => {
      if (live) run();
    });
    // …and again whenever an image inside the group finishes loading. A box
    // that holds images (지역화폐's cards and QR boxes) measures as if they were
    // 0px tall until they decode, so the first run can conclude "it fits" and
    // leave the real content overflowing. `load` does not bubble, hence capture.
    const onLoad = (e: Event): void => {
      if (live && e.target instanceof HTMLImageElement) run();
    };
    root.addEventListener('load', onLoad, true);
    // `height` boxes are fixed cards whose height comes from the page, not from
    // their text — and the page can move them after this ran: a translated
    // header description that wraps pushes the page content down (and so makes
    // the card shorter) once its web font lands. Re-fit when the box resizes.
    // The fit itself never changes these boxes' size, so this cannot loop.
    let ro: ResizeObserver | undefined;
    if (axis === 'height') {
      ro = new ResizeObserver(() => {
        if (live) run();
      });
      for (const b of root.getElementsByClassName(boxClass)) ro.observe(b);
      if (root.classList.contains(boxClass)) ro.observe(root);
    }
    return () => {
      live = false;
      root.removeEventListener('load', onLoad, true);
      ro?.disconnect();
    };
  }, [rootRef, boxClass, enabled, min, contentKey, axis]);
}
