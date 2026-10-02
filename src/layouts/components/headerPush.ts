/**
 * Make room under a page header whose description (★ 페이지 설명문) wraps.
 *
 * Every Insadong / 오색 / 화성 sub-page is drawn on the fixed 2160×3840 artboard
 * with its content anchored at y=699: the header's description sits at y=564,
 * one 60px line ends at 642, and the frame leaves a 57px gap before the tabs or
 * list start. The frames are drawn around the Korean description, which is one
 * line. Translated, the same description is often two lines (every Russian
 * page, and ja/en/vi/th/id on several) — and each extra line was drawn straight
 * over the tabs and content underneath it.
 *
 * The header measures how much taller its description is than ONE line and
 * publishes that as `--header-push` on the element that holds the header AND
 * the page content (the header's parent). The pages anchor their content at
 * `calc(699px + var(--header-push, 0px))`, so everything under the header moves
 * down by exactly the extra lines and keeps the frame's 57px gap.
 *
 * Only for lang !== 'ko' (`enabled`): in Korean nothing is measured and the
 * variable is never set, so every `calc()` resolves to the frame's own value.
 *
 * The measurement is in LAYOUT pixels (`offsetHeight`), which the kiosk
 * artboard's scale transform does not touch, so it reads the same on any screen.
 */
import { useLayoutEffect, type RefObject } from 'react';

const VAR = '--header-push';

export function useHeaderPush(
  headerRef: RefObject<HTMLElement | null>,
  textRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  contentKey: string,
): void {
  useLayoutEffect(() => {
    const host = headerRef.current?.parentElement;
    if (!host) return undefined;
    const text = textRef.current;
    if (!enabled || !text) {
      host.style.removeProperty(VAR);
      return undefined;
    }
    const measure = (): void => {
      const line = parseFloat(getComputedStyle(text).lineHeight);
      const extra = Number.isFinite(line) ? Math.max(0, Math.ceil(text.offsetHeight - line)) : 0;
      host.style.setProperty(VAR, `${extra}px`);
    };
    measure();
    // Re-measure when the web fonts land (a fallback face wraps differently).
    const ro = new ResizeObserver(measure);
    ro.observe(text);
    return () => {
      ro.disconnect();
      host.style.removeProperty(VAR);
    };
  }, [headerRef, textRef, enabled, contentKey]);
}
