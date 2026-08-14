import { useEffect, type RefObject } from 'react';

/**
 * Hide the scrollbars inside an embedded <webview>.
 *
 * The kiosk has no pointer, so a site's own scrollbar is both useless and
 * visibly wrong inside a card. `insertCSS` has to be re-applied on every
 * navigation — including in-page ones — because a fresh document drops it.
 *
 * Same CSS Osan and 화성 inject for the linktaxfree app; this is the one copy
 * new screens should use.
 */
const HIDE_SCROLLBARS =
  'html,body{overflow:hidden!important;scrollbar-width:none!important;-ms-overflow-style:none!important}' +
  '*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}';

type WebviewEl = HTMLElement & { insertCSS?: (css: string) => Promise<string> };

export function useHideEmbedScrollbars(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const wv = ref.current as WebviewEl | null;
    if (!wv?.insertCSS) return;

    const apply = (): void => {
      void wv.insertCSS?.(HIDE_SCROLLBARS);
    };
    wv.addEventListener('dom-ready', apply);
    wv.addEventListener('did-navigate-in-page', apply);
    return () => {
      wv.removeEventListener('dom-ready', apply);
      wv.removeEventListener('did-navigate-in-page', apply);
    };
  }, [ref]);
}
