import { useEffect, useRef, useState } from 'react';
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { taxfreeUrl } from '@shared/constants/webEmbeds';
import { trackEvent } from '@renderer/lib/analytics';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongTaxFree.module.css';

type TabId = 'refund' | 'intro' | 'merchant';
type LangMap<T> = Partial<Record<SupportedLanguage, T>>;

function pick<T>(map: LangMap<T>, lang: SupportedLanguage): T {
  return (map[lang] ?? map['ko'] ?? Object.values(map)[0]) as T;
}

const TAB_LABELS: LangMap<[string, string, string]> = {
  ko: ['세금 환급 신청', '텍스프리 소개', '텍스프리 가맹점 신청'],
  en: ['Tax Refund', 'About Tax Free', 'Merchant Apply'],
  ja: ['税金還付申請', 'テックスフリー紹介', '加盟店申請'],
  vi: ['Hoàn thuế', 'Giới thiệu', 'Đăng ký'],
  zh: ['退税申请', '介绍', '加盟申请'],
};

// Reuse the same tax-free service page images (identical service to insadong).
const PAGE_IMGS = import.meta.glob<{ default: string }>(
  '../../renderer/src/assets/photos/insadong/taxfree/pages/*.png',
  { eager: true },
);

function pageImg(name: string): string | undefined {
  const entry = Object.entries(PAGE_IMGS).find(([k]) => k.endsWith(`/${name}.png`));
  return entry?.[1]?.default;
}

function TaxRefundInfo({
  lang,
  onGoToWebview,
}: {
  lang: SupportedLanguage;
  onGoToWebview: () => void;
}): JSX.Element {
  const [page, setPage] = useState(0);
  const p1Src = pageImg(`tab1-p1-${lang}`);
  const p2Src = pageImg(`tab1-p2-${lang}`);

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
  const src = pageImg(`tab3-${lang}`);
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
  const tabLabels = pick(TAB_LABELS, lang);

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
    for (const name of [`tab1-p1-${lang}`, `tab1-p2-${lang}`, `tab3-${lang}`]) {
      const src = pageImg(name);
      if (src) {
        const img = new Image();
        img.src = src;
      }
    }
  }, [lang]);

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
            {tabLabels[i]}
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
