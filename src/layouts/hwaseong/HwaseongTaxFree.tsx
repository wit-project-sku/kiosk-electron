import { useEffect, useRef, useState } from 'react';
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { t } from '@renderer/lib/loc';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { taxfreeUrl } from '@shared/constants/webEmbeds';
import { trackEvent } from '@renderer/lib/analytics';
import { taxFreePageImg, preloadTaxFreePages } from '../components/taxFreePages';
import { useHideEmbedScrollbars } from '../components/useHideEmbedScrollbars';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongTaxFree.module.css';

type TabId = 'refund' | 'intro' | 'merchant';
/** Bottom tab labels, in tab order (refund / intro / merchant). Sourced from
 *  this location's Localization sheet so a copy edit needs no code change —
 *  `t()` resolves against the running kiosk's own table. */
const TAB_KEYS = ['Taxfree_Apply', 'Taxfree_Introduce', 'Taxfree_Enroll'] as const;

/**
 * The page artwork is the shared set (identical service to insadong), resolved
 * through taxFreePages.ts — which also falls back to English for the four
 * languages the pages were never drawn in. vi/th/ru/id rendered an EMPTY panel
 * here before.
 */
function TaxRefundInfo({
  lang,
  onGoToWebview,
}: {
  lang: SupportedLanguage;
  onGoToWebview: () => void;
}): JSX.Element {
  const [page, setPage] = useState(0);
  const p1Src = taxFreePageImg('tab1-p1', lang);
  const p2Src = taxFreePageImg('tab1-p2', lang);

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
  const src = taxFreePageImg('tab3', lang);
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

  const webviewRef = useRef<HTMLElement | null>(null);
  useHideEmbedScrollbars(webviewRef);

  useEffect(() => preloadTaxFreePages(lang), [lang]);

  const bgSrc = hwaseongIconUrl('bg');
  const bannerSrc = useRotatingBanner(hwaseongIconUrl('fg-banner'));

  return (
    <div className={styles.root}>
      {bgSrc && <img src={bgSrc} alt="" className={styles.bgImage} draggable={false} />}

      <HwaseongHeader controller={controller} title="TAX-FREE" />

      <div className={styles.body}>
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

      {/* Left nav */}
      <div className={styles.leftNav}>
        {hwaseongIconUrl('fg-leftnav') && (
          <img src={hwaseongIconUrl('fg-leftnav')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button type="button" className={styles.leftNavZoneHome} onClick={goHome} aria-label="홈" />
        <button type="button" className={styles.leftNavZoneBack} onClick={goHome} aria-label="뒤로" />
      </div>

      {/* Bottom banner */}
      <div className={styles.banner}>
        {bannerSrc && <img src={bannerSrc} alt="" className={styles.bannerImg} draggable={false} />}
      </div>
    </div>
  );
}
