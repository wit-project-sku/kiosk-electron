import { useEffect, useRef, useState } from 'react';
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { t } from '@renderer/lib/loc';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useTaxfreeBodyLayout } from '@renderer/hooks/useTaxfreeBodyLayout';
import { TAXFREE_PAGE_BASES, taxfreePageImg } from '@renderer/lib/taxfreePages';
import { taxfreeUrl } from '@shared/constants/webEmbeds';
import { InsadongHeader } from './InsadongHeader';
import headerStyles from './InsadongHeader.module.css';
import { InsadongLeftNav } from './InsadongLeftNav';
import styles from './InsadongTaxfree.module.css';
import { useFitText } from '@layouts/components/fitText';

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
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  /* Korean tab names fit the tab on one line; the other languages do not.
     See "Other languages" in the CSS. */
  const wide = lang !== 'ko';
  const tabsRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>('refund');
  const rootRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const bodyLayout = useTaxfreeBodyLayout(rootRef, subtitleRef, lang, lowReach, lowReach);
  /* ♿ drops the promo and parks the tabs at y3435 (Jeju 7058:20102). The card
     starts under the real subtitle — the standing y760 cap would cut it — and
     runs down to 64px above those tabs, which is the space the promo left. */
  const bodyTop = bodyLayout.top;
  const bodyHeight = lowReach ? Math.max(0, 3371 - bodyTop) : bodyLayout.height;

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

  useFitText(tabsRef, styles.tab, wide, 0.72, lang);

  return (
    <div ref={rootRef} className={styles.root}>
      {iconUrl('bg') && <img className={styles.bgImage} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader
        title="TAX-FREE"
        /* SubHeader_TaxFree left the sheet; each tab now has its own line. 소개 shares the
           refund tab's (Taxfree_desc1 is the same sentence). */
        subtitle={t(activeTab === 'merchant' ? 'Taxfree_Subtitle2' : 'Taxfree_Subtitle1', lang)}
        onHome={goHome}
        subtitleClassName={`${headerStyles.subtitleBelowGap} ${headerStyles.subtitleWide}`}
        subtitleRef={subtitleRef}
      />

      <div className={styles.body} style={{ top: bodyTop, height: bodyHeight }}>
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

      <div ref={tabsRef} className={lowReach ? `${styles.tabs} ${styles.tabsLow}` : styles.tabs}>
        {(['refund', 'intro', 'merchant'] as TabId[]).map((tab, i) => (
          <button
            key={tab}
            type="button"
            className={`${styles.tab} ${wide ? styles.tabLong : ''} ${activeTab === tab ? styles.tabSelected : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {t(TAB_KEYS[i]!, lang)}
          </button>
        ))}
      </div>

      <InsadongLeftNav onHome={goHome} />

      {banner && !lowReach && (
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
