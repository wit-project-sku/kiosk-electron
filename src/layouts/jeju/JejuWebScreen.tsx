/**
 * Embeds an existing website in the 제주 body region — Figma node 6050:149556
 * (위드마켓_01_상품 목록, "WIT Store").
 *
 * The Figma renders the store site as a static mockup; at runtime it is a live
 * <webview>, so none of the product grid / cart / 결제 UI is reimplemented here.
 * That UI belongs to witteria.com and changing it is a change to that site.
 *
 * Reusable for every 제주 webview screen (WIT Store today, 제주도 이벤트 next),
 * mirroring OsanWebScreen / HwaseongWebScreen.
 */
import { useEffect, useRef } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { pick } from '@renderer/lib/i18n';
import { JejuPageFrame } from './JejuPageFrame';
import styles from './JejuWebScreen.module.css';

/** The slice of Electron's WebviewTag this screen drives. */
type WebviewEl = HTMLElement & {
  insertCSS?: (css: string) => Promise<string>;
};

/**
 * Chrome injected into every embedded site.
 *
 * The scrollbar is drawn to match the kiosk's own lists (JejuEvents' .listScroll
 * is a 34.32px track with a #ff7f0f thumb) instead of Chromium's 15px grey bar,
 * which reads as a desktop artefact on a 4K touch panel.
 *
 * There is deliberately NO `overflow-x: hidden` here. It was tried, and it does
 * not prevent horizontal overflow — it only makes the overflowing content
 * unreachable, which is far worse on a kiosk with no keyboard: tamnao's 렌트카
 * page wants 1900px against this panel's 1820 and simply vanished past the
 * right edge, with no scrollbar to hint that anything was missing. A styled
 * horizontal bar on the pages that need one is the correct outcome.
 */
const EMBED_CHROME_CSS = [
  '::-webkit-scrollbar{width:26px;height:26px}',
  '::-webkit-scrollbar-track{background:transparent}',
  '::-webkit-scrollbar-thumb{background:#ff7f0f;border-radius:13px}',
  '::-webkit-scrollbar-corner{background:transparent}',
].join('');

interface Props {
  controller: KioskController;
  /** Header title (Korean id — localized by JejuHeader). */
  title: string;
  /** Header subtitle; omit to fall back to the sheet. */
  subtitle?: string;
  url: string;
  /** Subtitle colour — WIT Store uses the store's brown. */
  subtitleColor?: string;
  /** Draw the ★ before the subtitle (WIT Store omits it). */
  subtitleStar?: boolean;
}

const NO_URL = {
  ko: '웹사이트 주소가 설정되지 않았습니다',
  en: 'No website address is configured',
  ja: 'ウェブサイトのアドレスが設定されていません',
  zh: '未设置网站地址',
  vi: 'Chưa cấu hình địa chỉ trang web',
  th: 'ยังไม่ได้ตั้งค่าที่อยู่เว็บไซต์',
  ru: 'Адрес сайта не настроен',
  id: 'Alamat situs web belum diatur',
};

export function JejuWebScreen({
  controller,
  title,
  subtitle,
  url,
  subtitleColor,
  subtitleStar,
}: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const webviewRef = useRef<WebviewEl | null>(null);

  // Re-applied per document: insertCSS lives only for the document that was
  // loaded when it ran. `did-navigate-in-page` covers the in-app routes these
  // sites use, which never fire `did-navigate`.
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const apply = (): void => {
      wv.insertCSS?.(EMBED_CHROME_CSS)?.catch(() => {});
    };
    wv.addEventListener('dom-ready', apply);
    wv.addEventListener('did-navigate', apply);
    wv.addEventListener('did-navigate-in-page', apply);
    return () => {
      wv.removeEventListener('dom-ready', apply);
      wv.removeEventListener('did-navigate', apply);
      wv.removeEventListener('did-navigate-in-page', apply);
    };
  }, []);

  return (
    <JejuPageFrame
      controller={controller}
      title={title}
      subtitle={subtitle}
      subtitleColor={subtitleColor}
      subtitleStar={subtitleStar}
      bannerFallback="banner-detail"
      onBack={() => controller.navigate('home', '뒤로')}
    >
      <div className={styles.body}>
        {url ? (
          // `partition` keeps embedded sites in one persistent session, so a
          // cart/login survives navigating away and back.
          // eslint-disable-next-line react/no-unknown-property
          <webview
            ref={webviewRef as unknown as React.Ref<HTMLElement>}
            src={url}
            partition="persist:embeds"
            className={styles.embed}
          />
        ) : (
          <div className={styles.placeholder}>
            <p className={styles.placeholderTitle}>{title}</p>
            <p className={styles.placeholderHint}>{pick(NO_URL, lang)}</p>
          </div>
        )}
      </div>
    </JejuPageFrame>
  );
}
