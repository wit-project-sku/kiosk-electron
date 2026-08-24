import { useEffect, useRef, useState } from 'react';
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { t } from '@renderer/lib/loc';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useTaxfreeBodyLayout } from '@renderer/hooks/useTaxfreeBodyLayout';
import { TAXFREE_PAGE_BASES, taxfreePageImg } from '@renderer/lib/taxfreePages';
import { taxfreeUrl } from '@shared/constants/webEmbeds';
import { trackEvent } from '@renderer/lib/analytics';
import { HwaseongHeader } from './HwaseongHeader';
import { HwaseongBanner } from './HwaseongBanner';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import headerStyles from './HwaseongHeader.module.css';
import styles from './HwaseongTaxFree.module.css';

type TabId = 'refund' | 'intro' | 'merchant';
/** Bottom tab labels, in tab order (refund / intro / merchant). Sourced from
 *  this location's Localization sheet so a copy edit needs no code change —
 *  `t()` resolves against the running kiosk's own table. */
const TAB_KEYS = ['Taxfree_Apply', 'Taxfree_Introduce', 'Taxfree_Enroll'] as const;

/** 화성휴게소 routes merchant sign-up through WIT GLOBAL, not insadong's
 *  보존회, so its 가맹점 신청 page differs; everything else falls through to
 *  the shared set. */
const VARIANT = 'wit';

function TaxRefundInfo({
  lang,
  onGoToWebview,
}: {
  lang: SupportedLanguage;
  onGoToWebview: () => void;
}): JSX.Element {
  const [page, setPage] = useState(0);
  const p1Src = taxfreePageImg('tab1-p1', lang, VARIANT);
  const p2Src = taxfreePageImg('tab1-p2', lang, VARIANT);

  return (
    <div className={styles.refundInfo}>
      <div className={`${styles.infoPage} ${page === 0 ? styles.infoPageActive : styles.infoPageHidden}`}>
        {p1Src && <img src={p1Src} className={styles.pageImg} alt="" draggable={false} />}
        <button
          type="button"
          className={`${styles.navHotspot} ${styles.navHotspotRight}`}
          onClick={() => setPage(1)}
          aria-label="Next page"
        />
      </div>
      <div className={`${styles.infoPage} ${page === 1 ? styles.infoPageActive : styles.infoPageHidden}`}>
        {p2Src && <img src={p2Src} className={styles.pageImg} alt="" draggable={false} />}
        <button
          type="button"
          className={`${styles.navHotspot} ${styles.navHotspotLeft}`}
          onClick={() => setPage(0)}
          aria-label="Previous page"
        />
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

function MerchantTab({ lang }: { lang: SupportedLanguage }): JSX.Element {
  const src = taxfreePageImg('tab3', lang, VARIANT);
  return (
    <div className={styles.merchant}>
      {src && <img src={src} className={styles.pageImg} alt="" draggable={false} />}
    </div>
  );
}

interface Props {
  controller: KioskController;
}

export function HwaseongTaxFree({ controller }: Props): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLanguageStore((s) => s.currentLanguage);
  const [activeTab, setActiveTab] = useState<TabId>('refund');
  const rootRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const bodyLayout = useTaxfreeBodyLayout(rootRef, subtitleRef, lang);

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

  useEffect(() => {
    for (const base of TAXFREE_PAGE_BASES) {
      const src = taxfreePageImg(base, lang, VARIANT);
      if (src) {
        const img = new Image();
        img.src = src;
      }
    }
  }, [lang]);

  const bgSrc = hwaseongIconUrl('bg');

  return (
    <div ref={rootRef} className={styles.root}>
      {bgSrc && <img src={bgSrc} alt="" className={styles.bgImage} draggable={false} />}

      <HwaseongHeader
        controller={controller}
        title="TAX-FREE"
        subtitleClassName={`${headerStyles.subtitleBelowGap} ${headerStyles.subtitleWide}`}
        subtitleRef={subtitleRef}
      />

      <div className={styles.body} style={{ top: bodyLayout.top, height: bodyLayout.height }}>
        {activeTab === 'intro' && (
          <TaxRefundInfo lang={lang} onGoToWebview={() => setActiveTab('refund')} />
        )}

        {/* refund webview — always mounted to pre-warm */}
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
            onClick={() => {
              trackEvent({ name: 'button_clicked', payload: { screen: 'taxfree', tab, kiosk: 'W005' } });
              setActiveTab(tab);
            }}
          >
            {t(TAB_KEYS[i]!, lang)}
          </button>
        ))}
      </div>

      <HwaseongLeftNav onHome={goHome} />

      <HwaseongBanner onClick={() => controller.startPhoto()} />
    </div>
  );
}
