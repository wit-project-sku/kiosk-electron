import { useLayoutEffect, useState, type RefObject } from 'react';

/** Tab row at y=2999; 64px gap above it → body bottom edge. */
const BODY_BOTTOM = 2935;

/** Figma layout: subtitle starts y≈564, 2 lines × (60.06×1.3) + 40px margin. */
const BODY_TOP_MAX_TWO_LINES = 760;

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
 * Positions the TAX-FREE white card / webview under the subtitle.
 * Measured per language for 1–2 lines; capped at two lines so a third
 * wrapped line does not push the webview further down.
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
      const measured = Math.ceil((subRect.bottom - rootRect.top) / scale + marginBottom);
      const top = Math.min(measured, BODY_TOP_MAX_TWO_LINES);
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
