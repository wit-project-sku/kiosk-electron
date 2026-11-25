/**
 * The 롯데 scroll bar (Figma A-02 8723:1599 · Rectangle 4227): a 34.32-wide #DC3124 pill with
 * fully round ends and no track, flush against the artboard's right edge (x2125.68 on the
 * 2160 artboard — the frame's x2128 is measured in a 2162-wide frame).
 *
 * Drawn once by LottePageFrame instead of per scroller: the 롯데 bodies scroll inside their
 * 1820 content column, so a native bar would land at the column's edge (x1990) in the app's
 * grey 10px default — the "unstyled" bar — while the list/search/events screens drew their
 * own 28px red one. Native bars are hidden page-wide (LottePageFrame.module.css) and this
 * one follows whichever element on the page actually scrolls: it spans that element's
 * visible height, and the thumb is its viewport share of it.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import styles from './LotteScrollbar.module.css';

const ARTBOARD_WIDTH = 2160;
/** Shortest thumb, so a very long list still leaves something to see and read. */
const MIN_THUMB = 120;

interface Thumb {
  top: number;
  height: number;
}

const scrolls = (el: Element): boolean => {
  const { overflowY } = getComputedStyle(el);
  return (
    (overflowY === 'auto' || overflowY === 'scroll') &&
    (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight + 1
  );
};

/** The page's main scroller: the tallest element that overflows. */
function findScroller(root: HTMLElement): HTMLElement | null {
  let best: HTMLElement | null = null;
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    if (el.clientHeight > (best?.clientHeight ?? 0) && scrolls(el)) best = el;
  }
  return best;
}

export function LotteScrollbar({ rootRef }: { rootRef: RefObject<HTMLElement | null> }): JSX.Element | null {
  const [thumb, setThumb] = useState<Thumb | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = (): void => {
      frame.current = 0;
      const el = findScroller(root);
      if (!el) {
        setThumb(null);
        return;
      }
      const rootBox = root.getBoundingClientRect();
      const scale = rootBox.width / ARTBOARD_WIDTH || 1;
      const box = el.getBoundingClientRect();
      const trackTop = (box.top - rootBox.top) / scale;
      const track = box.height / scale;
      const height = Math.max(MIN_THUMB, (track * el.clientHeight) / el.scrollHeight);
      const range = el.scrollHeight - el.clientHeight;
      const top = trackTop + (range > 0 ? ((track - height) * el.scrollTop) / range : 0);
      setThumb((prev) =>
        prev && Math.abs(prev.top - top) < 0.5 && Math.abs(prev.height - height) < 0.5
          ? prev
          : { top, height },
      );
    };
    const schedule = (): void => {
      if (!frame.current) frame.current = requestAnimationFrame(measure);
    };

    schedule();
    root.addEventListener('scroll', schedule, { capture: true, passive: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(root);
    /* Lists filter, load and swap tabs without resizing the page. */
    const mutate = new MutationObserver(schedule);
    mutate.observe(root, { childList: true, subtree: true });
    return () => {
      root.removeEventListener('scroll', schedule, { capture: true });
      resize.disconnect();
      mutate.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [rootRef]);

  if (!thumb) return null;
  return <div className={styles.thumb} style={{ top: thumb.top, height: thumb.height }} aria-hidden />;
}
