/**
 * Embeds an existing website in the 제주 body region — Figma node 6050:149556
 * (위드마켓_01_상품 목록, "WIT Store") and 6493:118287 (탐나오&제주큐랑).
 *
 * The Figma renders each site as a static mockup; at runtime it is a live
 * <webview>, so none of the product grid / cart / 결제 UI is reimplemented here.
 * That UI belongs to witteria.com and changing it is a change to that site.
 *
 * Two shapes, one component: one site filling the panel (WIT Store), or several
 * behind a tab row (탐나오 / 제주큐랑). See `tabs`.
 *
 * Reusable for every 제주 webview screen, mirroring OsanWebScreen /
 * HwaseongWebScreen.
 */
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { pick } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { trackEvent } from '@renderer/lib/analytics';
import { JejuPageFrame } from './JejuPageFrame';
import { belowModeBar } from './lowReach';
import styles from './JejuWebScreen.module.css';

/** The slice of Electron's WebviewTag this screen drives. */
type WebviewEl = HTMLElement & {
  insertCSS?: (css: string) => Promise<string>;
  removeInsertedCSS?: (key: string) => Promise<void>;
};

/**
 * Chrome injected into every embedded site.
 *
 * The scrollbar is drawn to match the kiosk's own lists instead of Chromium's
 * grey bar, which reads as a desktop artefact on a 4K touch panel.
 *
 * There is deliberately NO `overflow-x: hidden` here. It was tried, and it does
 * not prevent horizontal overflow — it only makes the overflowing content
 * unreachable, which is far worse on a kiosk with no keyboard: tamnao's 렌트카
 * page wants 1900px against this panel's 1820 and simply vanished past the
 * right edge, with no scrollbar to hint that anything was missing. A styled
 * horizontal bar on the pages that need one is the correct outcome.
 *
 * `zoom` (탐나오&제주큐랑 only) enlarges the guest page. CSS `zoom` also scales
 * scrollbar thickness, so zoomed panes inject a smaller CSS width that lands
 * near the intended on-screen size after zoom.
 */
const SCROLLBAR_CSS = (widthPx: number): string =>
  [
    `::-webkit-scrollbar{width:${widthPx}px !important;height:${widthPx}px !important}`,
    '::-webkit-scrollbar-track{background:transparent !important}',
    `::-webkit-scrollbar-thumb{background:#ff7f0f !important;border-radius:${Math.round(widthPx / 2)}px !important}`,
    '::-webkit-scrollbar-corner{background:transparent !important}',
  ].join('');

/** WIT Store — house track (no page zoom). */
const EMBED_CHROME_CSS = SCROLLBAR_CSS(26);

/** 탐나오&제주큐랑 page zoom. */
const TAMNAO_ZOOM = 2.3;
/** Desired on-screen scrollbar thickness after zoom. */
const TAMNAO_SCROLLBAR_SCREEN_PX = 18;
const TAMNAO_SCROLLBAR_CSS_PX = Math.max(6, Math.round(TAMNAO_SCROLLBAR_SCREEN_PX / TAMNAO_ZOOM));

const EMBED_CHROME_CSS_ZOOMED = `html{zoom:${TAMNAO_ZOOM} !important}${SCROLLBAR_CSS(TAMNAO_SCROLLBAR_CSS_PX)}`;

/** One embedded site. A screen draws a tab per entry once it has more than one. */
export interface EmbedTab {
  id: string;
  /**
   * Korean fallback label. Prefer `labelKey` (Localization_Jeju) when the sheet
   * has a row — Tamnao_Tab / JejuQurang_Tab for this screen.
   */
  label: string;
  /** Localization_Jeju key for the tab label. */
  labelKey?: string;
  url: string;
}

interface Props {
  controller: KioskController;
  /** Header title (Korean id — localized by JejuHeader). */
  title: string;
  /** Header subtitle; omit to fall back to the sheet. */
  subtitle?: string;
  /** The single embedded site. Ignored when `tabs` is given. */
  url: string;
  /** Subtitle colour — WIT Store uses the store's brown. */
  subtitleColor?: string;
  /** Draw the ★ before the subtitle (WIT Store omits it). */
  subtitleStar?: boolean;
  /**
   * 탐나오&제주큐랑 only (6516:71785): the "모바일에서 확인하기" QR row under the
   * panel, plus that frame's own panel metrics. One flag for both — see
   * `.bodyTamnao`. The QR is generated from the ACTIVE tab's url, so it always
   * sends the phone to the site the visitor is looking at.
   */
  showMobileQr?: boolean;
  /**
   * Two or more sites behind a tab row (6493:118322 — 탐나오 / 제주큐랑). The
   * first entry is the landing tab. Omit for a one-site screen: WIT Store draws
   * no row and its panel starts where its own frame puts it.
   */
  tabs?: readonly EmbedTab[];
  /**
   * Draw the bottom page banner. Off for the 탐나오&제주큐랑 frame, whose panel
   * and QR row run to y3592 — past the y3267 the banner occupies.
   */
  showBanner?: boolean;
}

/**
 * 6352:144530. Two lines, ragged right against the QR — the break is authored
 * here rather than left to wrapping, because the frame's second line is the
 * longer one and auto-wrap would put the arrow in the wrong place.
 */
const MOBILE_QR = {
  ko: ' QR 클릭! ←\n모바일에서 확인하기',
  en: ' Scan the QR ←\nOpen it on your phone',
  ja: ' QRはこちら ←\nスマホで見る',
  zh: ' 扫描二维码 ←\n在手机上查看',
  vi: ' Quét mã QR ←\nXem trên điện thoại',
  th: ' สแกน QR ←\nดูบนมือถือ',
  ru: ' Сканируйте QR ←\nОткрыть на телефоне',
  id: ' Pindai QR ←\nBuka di ponsel',
};

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

/**
 * One site's <webview>, with the chrome injection that has to be re-applied per
 * document. Split out of JejuWebScreen so each tab owns its own element and its
 * own effect — the alternative, swapping `src` on a single webview, makes the
 * guest boot, fetch and repaint on every tab press while the visitor watches.
 */
function EmbedPane({
  url,
  active,
  zoomed = false,
}: {
  url: string;
  active: boolean;
  zoomed?: boolean;
}): JSX.Element {
  const webviewRef = useRef<WebviewEl | null>(null);
  const css = zoomed ? EMBED_CHROME_CSS_ZOOMED : EMBED_CHROME_CSS;

  // Re-applied per document: insertCSS lives only for the document that was
  // loaded when it ran. `did-navigate-in-page` covers the in-app routes these
  // sites use, which never fire `did-navigate`. Also re-run immediately when
  // `css` changes (HMR / zoom tweak) — listeners alone would leave the old
  // thickness until the next navigation.
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    let cssKey: string | undefined;
    let cancelled = false;

    const apply = (): void => {
      void (async () => {
        try {
          if (cssKey && wv.removeInsertedCSS) {
            await wv.removeInsertedCSS(cssKey);
          }
          const next = await wv.insertCSS?.(css);
          if (!cancelled && next) cssKey = next;
        } catch {
          /* guest may not be ready yet — next navigate event retries */
        }
      })();
    };

    apply();
    wv.addEventListener('dom-ready', apply);
    wv.addEventListener('did-navigate', apply);
    wv.addEventListener('did-navigate-in-page', apply);
    return () => {
      cancelled = true;
      wv.removeEventListener('dom-ready', apply);
      wv.removeEventListener('did-navigate', apply);
      wv.removeEventListener('did-navigate-in-page', apply);
      if (cssKey && wv.removeInsertedCSS) {
        void wv.removeInsertedCSS(cssKey).catch(() => {});
      }
    };
  }, [css]);

  return (
    <div className={active ? styles.pane : styles.paneHidden}>
      {/* `partition` keeps embedded sites in one persistent session, so a
          cart/login survives navigating away and back. */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <webview
        ref={webviewRef as unknown as React.Ref<HTMLElement>}
        src={url}
        partition="persist:embeds"
        className={styles.embed}
      />
    </div>
  );
}

export function JejuWebScreen({
  controller,
  title,
  subtitle,
  url,
  subtitleColor,
  subtitleStar,
  showMobileQr = false,
  tabs,
  showBanner = true,
}: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  /*
   * ♿ is scoped to the 탐나오&제주큐랑 composition (6778:69905), which is the
   * only shape with a low-reach frame — the same flag that already selects this
   * screen's other 탐나오-specific metrics. WIT Store keeps ♿ as the no-op it
   * has always been here: it has no low-reach frame yet, and inventing one would
   * mean guessing where its panel goes.
   */
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const lowTamnao = lowReach && showMobileQr;
  /* One code path for both shapes: a screen without `tabs` is a screen with one
     unlabelled site, and the row below only draws when there is a choice. */
  const landing: EmbedTab = tabs?.[0] ?? { id: 'main', label: '', url };
  const sites: readonly EmbedTab[] = tabs?.length ? tabs : [landing];
  const [tab, setTab] = useState(landing.id);
  /* Guard the id against a `tabs` list that changed under a stale selection, so
     a mismatch falls back to the landing tab instead of hiding every pane. */
  const active = sites.some((t) => t.id === tab) ? tab : landing.id;
  /* What the 모바일에서 확인하기 QR encodes: the site currently on screen. */
  const activeUrl = sites.find((t) => t.id === active)?.url ?? '';

  /* `screen: 'tamnao'` because that is the only screen with a tab row — the row
     does not draw at all without `tabs`. Give this a prop if a second one lands. */
  const select = (id: string): void => {
    trackEvent({
      name: 'button_clicked',
      payload: { screen: 'tamnao', tab: id, kioskId: controller.kioskId },
    });
    setTab(id);
  };

  return (
    <JejuPageFrame
      controller={controller}
      title={title}
      subtitle={subtitle}
      subtitleColor={subtitleColor}
      subtitleStar={subtitleStar}
      showBanner={showBanner}
      bannerFallback="banner-detail"
      onBack={() => controller.navigate('home', '뒤로')}
      /* Header flush under the bar (the frame's y146), and the body left
         unshifted — the three blocks below carry the frame's own absolute
         tops rather than riding a single offset, because two of them swap
         ends between the layouts. */
      lowReachModeBar={showMobileQr}
      lowReachShift={belowModeBar()}
    >
      {sites.length > 1 && (
        <div className={`${styles.tabs} ${lowTamnao ? styles.tabsLow : ''}`}>
          {sites.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.tab} ${t.id === active ? styles.tabActive : ''}`}
              onClick={() => select(t.id)}
            >
              {t.labelKey ? sheetText(t.labelKey, lang, { ko: t.label }) : t.label}
            </button>
          ))}
        </div>
      )}

      <div
        className={[styles.body, showMobileQr ? styles.bodyTamnao : '', lowTamnao ? styles.bodyTamnaoLow : '']
          .filter(Boolean)
          .join(' ')}
      >
        {sites.some((t) => t.url) ? (
          sites.map((t) => (
            <EmbedPane
              key={t.id}
              url={t.url}
              active={t.id === active}
              /* 탐나오&제주큐랑 패널만 1.5× 확대 — WIT Store는 원 배율 유지. */
              zoomed={showMobileQr}
            />
          ))
        ) : (
          <div className={styles.placeholder}>
            <p className={styles.placeholderTitle}>{title}</p>
            <p className={styles.placeholderHint}>{pick(NO_URL, lang)}</p>
          </div>
        )}
      </div>

      {showMobileQr && activeUrl && (
        <div className={`${styles.qrRow} ${lowTamnao ? styles.qrRowLow : ''}`}>
          <div className={styles.qrDivider} />
          <p className={styles.qrText}>{pick(MOBILE_QR, lang)}</p>
          <div className={styles.qrBox}>
            {/* Generated per tab rather than a fixed export: the row sits under
                whichever site is showing, so 탐나오 hands over tamnao.com and
                제주큐랑 hands over jejuqrang.com. `key` forces a fresh SVG on a
                tab change. 150px is the frame's own QR size — see .qrImg. */}
            <QRCodeSVG
              key={activeUrl}
              className={styles.qrImg}
              value={activeUrl}
              size={150}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
            />
          </div>
        </div>
      )}
    </JejuPageFrame>
  );
}
