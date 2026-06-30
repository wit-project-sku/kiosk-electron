/**
 * Embeds an external website in the body region while keeping the shared
 * 화성휴게소 chrome (background, header, left nav, banner). Used for pages whose
 * content is a live site — e.g. 전국도로교통상황 → https://www.its.go.kr/.
 */
import { useEffect, useRef } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongWebScreen.module.css';

/** Minimal subset of Electron's WebviewTag we use for CSS injection. */
type WebviewEl = HTMLElement & {
  insertCSS: (css: string) => Promise<string>;
  addEventListener(event: string, listener: () => void): void;
  removeEventListener(event: string, listener: () => void): void;
};

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

  return (
    <div className={styles.root}>
      {/* Background */}
      <div className={styles.bgBase} />
      {hwaseongIconUrl('bg') && (
        <img src={hwaseongIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      {/* Shared header */}
      <HwaseongHeader controller={controller} title={title} />

      {/* Webview body — 1820 × 2250 (height overridable to crop a site's footer gap) */}
      <div className={styles.body} style={bodyHeight ? { height: bodyHeight } : undefined}>
        <webview
          /* eslint-disable-next-line react/no-unknown-property */
          ref={webviewRef as unknown as React.Ref<HTMLElement>}
          src={url}
          partition="persist:embeds"
          className={styles.embed}
        />
      </div>

      {/* Left nav */}
      <div className={styles.leftNav}>
        {hwaseongIconUrl('fg-leftnav') && (
          <img src={hwaseongIconUrl('fg-leftnav')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button type="button" className={styles.leftNavZoneHome} onClick={() => controller.navigate('home')} aria-label="홈" />
        <button type="button" className={styles.leftNavZoneBack} onClick={() => controller.navigate('home')} aria-label="뒤로" />
      </div>

      {/* Bottom banner */}
      <div className={styles.banner}>
        {hwaseongIconUrl('fg-banner') && (
          <img src={hwaseongIconUrl('fg-banner')} alt="" className={styles.bannerImg} draggable={false} />
        )}
      </div>
    </div>
  );
}
