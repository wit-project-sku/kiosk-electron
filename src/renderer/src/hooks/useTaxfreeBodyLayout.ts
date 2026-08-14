import { useLayoutEffect, useState, type RefObject } from 'react';

/** Tab row at y=2999; 64px gap above it → body bottom edge. */
const BODY_BOTTOM = 2935;

/** Walk up to the KioskArtboard — getBoundingClientRect is scaled, layout CSS is not. */
function kioskScale(from: HTMLElement): number {
  let node: HTMLElement | null = from;
  while (node) {
    const raw = getComputedStyle(node).getPropertyValue('--kiosk-scale').trim();
    if (raw) {
      const s = parseFloat(raw);
      if (Number.isFinite(s) && s > 0) return s;
    }
    node = node.parentElement;
  }
  return 1;
}

/**
 * Positions the TAX-FREE white card / webview directly under the subtitle,
 * whatever line count the active language wraps to.
 */
export function useTaxfreeBodyLayout(
  rootRef: RefObject<HTMLElement | null>,
  subtitleRef: RefObject<HTMLElement | null>,
  lang: string,
): { top: number; height: number } {
  const [layout, setLayout] = useState({ top: 760, height: BODY_BOTTOM - 760 });

  useLayoutEffect(() => {
    const root = rootRef.current;
    const sub = subtitleRef.current;
    if (!root || !sub) return;

    const measure = (): void => {
      const scale = kioskScale(root);
      const rootRect = root.getBoundingClientRect();
      const subRect = sub.getBoundingClientRect();
      const marginBottom = parseFloat(getComputedStyle(sub).marginBottom) || 0;
      const top = Math.ceil((subRect.bottom - rootRect.top) / scale + marginBottom);
      setLayout({ top, height: BODY_BOTTOM - top });
    };

    measure();
    requestAnimationFrame(measure);

    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(sub);
    const text = sub.querySelector('span');
    if (text) ro.observe(text);

    return () => ro.disconnect();
  }, [rootRef, subtitleRef, lang]);

  return layout;
}
