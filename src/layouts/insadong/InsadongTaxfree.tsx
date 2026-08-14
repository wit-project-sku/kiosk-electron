import { useEffect, useRef, useState } from 'react';
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { t } from '@renderer/lib/loc';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useTaxfreeBodyLayout } from '@renderer/hooks/useTaxfreeBodyLayout';
import { TAXFREE_PAGE_BASES, taxfreePageImg } from '@renderer/lib/taxfreePages';
import { taxfreeUrl } from '@shared/constants/webEmbeds';
import { InsadongHeader } from './InsadongHeader';
import headerStyles from './InsadongHeader.module.css';
import styles from './InsadongTaxfree.module.css';

type TabId = 'refund' | 'intro' | 'merchant';
/** Bottom tab labels, in tab order (refund / intro / merchant). Sourced from
 *  this location's Localization sheet so a copy edit needs no code change —
 *  `t()` resolves against the running kiosk's own table. */
const TAB_KEYS = ['Taxfree_Apply', 'Taxfree_Introduce', 'Taxfree_Enroll'] as const;

// ─── 텍스프리 소개 (intro tab) — two-page image carousel ─────────────────────
// The chevron arrows AND the blue "apply" CTA are painted into the page images.
// We don't draw our own buttons — we lay transparent hotspots over the drawn
// ones so they become tappable. The "apply" CTA jumps to the refund webview tab.
function TaxRefundInfo({
  lang,
  onGoToWebview,
}: {
  lang: SupportedLanguage;
  onGoToWebview: () => void;
}): JSX.Element {
  const [page, setPage] = useState(0);
  const p1Src = taxfreePageImg('tab1-p1', lang);
  const p2Src = taxfreePageImg('tab1-p2', lang);

  return (
    <div className={styles.refundInfo}>
      <div className={`${styles.infoPage} ${page === 0 ? styles.infoPageActive : styles.infoPageHidden}`}>
        {p1Src && <img src={p1Src} className={styles.pageImg} alt="" draggable={false} />}
        {/* drawn '›' on the right edge → next page */}
        <button
          type="button"
          className={`${styles.navHotspot} ${styles.navHotspotRight}`}
          onClick={() => setPage(1)}
          aria-label="Next page"
        />
      </div>
      <div className={`${styles.infoPage} ${page === 1 ? styles.infoPageActive : styles.infoPageHidden}`}>
        {p2Src && <img src={p2Src} className={styles.pageImg} alt="" draggable={false} />}
        {/* drawn '‹' on the left edge → previous page */}
        <button
          type="button"
          className={`${styles.navHotspot} ${styles.navHotspotLeft}`}
          onClick={() => setPage(0)}
          aria-label="Previous page"
        />
        {/* drawn blue "apply for tax refund" CTA → tax-free webview tab */}
        <button
          type="button"
          className={styles.applyHotspot}
          onClick={onGoToWebview}
          aria-label="Apply for tax refund"
        />
      </div>
    </div>
  );
}

// ─── Tab 3 — merchant image ──────────────────────────────────────────────────
function MerchantTab({ lang }: { lang: SupportedLanguage }): JSX.Element {
  const src = taxfreePageImg('tab3', lang);
  return (
    <div className={styles.merchant}>
      {src && <img src={src} className={styles.pageImg} alt="" draggable={false} />}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
interface InsadongTaxfreeProps {
  controller: KioskController;
  debug?: boolean;
}

export function InsadongTaxfree({ controller }: InsadongTaxfreeProps): JSX.Element {
  const banner = useRotatingBanner();
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLanguageStore((s) => s.currentLanguage);
  const [activeTab, setActiveTab] = useState<TabId>('refund');
  const rootRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const bodyLayout = useTaxfreeBodyLayout(rootRef, subtitleRef, lang);

  // Pre-decode every tab image for the active language so switching tabs (esp.
  // the merchant tab) is instant — the component is always mounted (pre-warmed),
  // so this runs before the user ever opens the screen.
  useEffect(() => {
    for (const base of TAXFREE_PAGE_BASES) {
      const src = taxfreePageImg(base, lang);
      if (src) {
        const img = new Image();
        img.src = src;
      }
    }
  }, [lang]);

  const webviewRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const wv = webviewRef.current as
      | (HTMLElement & { insertCSS?: (css: string) => Promise<string> })
      | null;
    if (!wv?.insertCSS) return;
    const stripScroll = (): void => {
      void wv.insertCSS?.(
        'html,body{overflow:hidden!important;scrollbar-width:none!important;-ms-overflow-style:none!important}' +
          '*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}',
      );
    };
    wv.addEventListener('dom-ready', stripScroll);
    wv.addEventListener('did-navigate-in-page', stripScroll);
    return () => {
      wv.removeEventListener('dom-ready', stripScroll);
      wv.removeEventListener('did-navigate-in-page', stripScroll);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.root}>
      {iconUrl('bg') && <img className={styles.bgImage} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader
        title="TAX-FREE"
        onHome={goHome}
        subtitleClassName={headerStyles.subtitleBelowGap}
        subtitleRef={subtitleRef}
      />

      <div className={styles.body} style={{ top: bodyLayout.top, height: bodyLayout.height }}>
        {/* 텍스프리 소개 (intro): the static two-page info carousel. */}
        {activeTab === 'intro' && (
          <TaxRefundInfo lang={lang} onGoToWebview={() => setActiveTab('refund')} />
        )}

        {/* 세금 환급 신청 (refund): the live tax-free webview — always mounted to pre-warm */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            visibility: activeTab === 'refund' ? 'visible' : 'hidden',
            pointerEvents: activeTab === 'refund' ? 'auto' : 'none',
          }}
        >
          {/* eslint-disable-next-line react/no-unknown-property */}
          <webview ref={webviewRef} src={taxfreeUrl(controller.kioskId)} partition="persist:embeds" className={styles.embed} />
        </div>

        {activeTab === 'merchant' && <MerchantTab lang={lang} />}
      </div>

      <div className={styles.tabs}>
        {(['refund', 'intro', 'merchant'] as TabId[]).map((tab, i) => (
          <button
            key={tab}
            type="button"
            className={`${styles.tab} ${activeTab === tab ? styles.tabSelected : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {t(TAB_KEYS[i]!, lang)}
          </button>
        ))}
      </div>

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="홈으로">
          {iconUrl('home-btn') && <img src={iconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="뒤로">
          {iconUrl('back-arrow') && <img src={iconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>

      {banner && (
        <button
          type="button"
          className={styles.banner}
          onClick={() => controller.startPhoto()}
          aria-label="가상 한복 체험"
        >
          <img src={banner} alt="" className={styles.bannerImg} draggable={false} />
        </button>
      )}
    </div>
  );
}
