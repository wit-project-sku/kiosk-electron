/**
 * Embeds an external website in the body region while keeping the shared
 * 화성휴게소 chrome — Figma 7950:58002 (전국도로교통상황 → https://www.its.go.kr/):
 * page background, header, a 1820-wide webview at (171, 818), the frame's ▲/▼
 * scroll buttons at (2027, 2103 / 2223) and the left nav. The frame draws no
 * bottom banner.
 */
import { useEffect, useRef } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { HwaseongHeader } from './HwaseongHeader';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import { HwaseongPageBg } from './HwaseongPageBg';
import styles from './HwaseongWebScreen.module.css';

/** Minimal subset of Electron's WebviewTag we use. */
type WebviewEl = HTMLElement & {
  insertCSS: (css: string) => Promise<string>;
  executeJavaScript: (code: string) => Promise<unknown>;
  addEventListener(event: string, listener: () => void): void;
  removeEventListener(event: string, listener: () => void): void;
};

/** One ▲/▼ press scrolls the embedded page by this much (its own CSS px). */
const SCROLL_STEP = 600;

interface Props {
  controller: KioskController;
  title: string;
  url: string;
  /** CSS injected into the embedded site once it loads (e.g. to hide its own
   *  header/footer so only the content shows inside our kiosk chrome). */
  injectCss?: string;
  /** Override the webview body height (default 2250). Use a smaller value to
   *  crop the blank strip left at the bottom after hiding a site's footer. */
  bodyHeight?: number;
}

export function HwaseongWebScreen({ controller, title, url, injectCss, bodyHeight }: Props): JSX.Element {
  /* ♿ (전국도로교통상황 7986:94684): the page moves under the mode bar and the
     body grows back to the full 2250 (171, 964 → 3214), so a shortened body
     (bodyHeight) only applies outside the mode. */
  const low = useAccessibilityStore((st) => st.lowReach);
  const webviewRef = useRef<WebviewEl | null>(null);

  useEffect(() => {
    const el = webviewRef.current;
    if (!el || !injectCss) return;
    // Re-inject on every (in-page) navigation — insertCSS only lives for the
    // currently loaded document, and the ITS map is a single-page app.
    const apply = (): void => {
      void el.insertCSS(injectCss).catch(() => {});
    };
    el.addEventListener('dom-ready', apply);
    el.addEventListener('did-navigate', apply);
    el.addEventListener('did-navigate-in-page', apply);
    el.addEventListener('did-frame-finish-load', apply);
    return () => {
      el.removeEventListener('dom-ready', apply);
      el.removeEventListener('did-navigate', apply);
      el.removeEventListener('did-navigate-in-page', apply);
      el.removeEventListener('did-frame-finish-load', apply);
    };
  }, [injectCss]);

  // Scrolls the guest page; a page that does not scroll (the ITS map) ignores it.
  const scrollBy = (dir: 1 | -1): void => {
    void webviewRef.current
      ?.executeJavaScript(`window.scrollBy({ top: ${dir * SCROLL_STEP}, behavior: 'smooth' })`)
      .catch(() => {});
  };
  const arrow = hwaseongIconUrl('search-scroll-arrow');

  return (
    <div className={styles.root}>
      <HwaseongPageBg />

      <HwaseongHeader controller={controller} title={title} />

      {/* Webview body — 1820 × 2250 (height overridable to crop a site's footer gap) */}
      <div className={styles.body} style={bodyHeight && !low ? { height: bodyHeight } : undefined}>
        <webview
          ref={webviewRef as unknown as React.Ref<HTMLElement>}
          src={url}
          // eslint-disable-next-line react/no-unknown-property -- Electron <webview> attribute
          partition="persist:embeds"
          className={styles.embed}
        />
      </div>

      <button type="button" className={`${styles.scrollBtn} ${styles.scrollUp}`} onClick={() => scrollBy(-1)} aria-label="위로">
        {arrow && <img src={arrow} alt="" draggable={false} />}
      </button>
      <button type="button" className={`${styles.scrollBtn} ${styles.scrollDown}`} onClick={() => scrollBy(1)} aria-label="아래로">
        {arrow && <img src={arrow} alt="" draggable={false} />}
      </button>

      <HwaseongLeftNav onHome={() => controller.navigate('home', 'Back')} />
    </div>
  );
}
