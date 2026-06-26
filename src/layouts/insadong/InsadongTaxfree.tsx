import { useEffect, useState } from 'react';
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { WEB_EMBED_URLS } from '@shared/constants/webEmbeds';
import { InsadongHeader } from './InsadongHeader';
import styles from './InsadongTaxfree.module.css';

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

// ─── Dynamic image loader ────────────────────────────────────────────────────
// Place images as: assets/photos/insadong/taxfree/pages/tab1-p1-ko.png etc.
const PAGE_IMGS = import.meta.glob<{ default: string }>(
  '../../renderer/src/assets/photos/insadong/taxfree/pages/*.png',
  { eager: true }
);

function pageImg(name: string): string | undefined {
  const entry = Object.entries(PAGE_IMGS).find(([k]) => k.endsWith(`/${name}.png`));
  return entry?.[1]?.default;
}

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
  const p1Src = pageImg(`tab1-p1-${lang}`);
  const p2Src = pageImg(`tab1-p2-${lang}`);

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
  const src = pageImg(`tab3-${lang}`);
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
  const tabLabels = pick(TAB_LABELS, lang);

  // Pre-decode every tab image for the active language so switching tabs (esp.
  // the merchant tab) is instant — the component is always mounted (pre-warmed),
  // so this runs before the user ever opens the screen.
  useEffect(() => {
    for (const name of [`tab1-p1-${lang}`, `tab1-p2-${lang}`, `tab3-${lang}`]) {
      const src = pageImg(name);
      if (src) {
        const img = new Image();
        img.src = src;
      }
    }
  }, [lang]);

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title="TAX - FREE" onHome={goHome} />

      <div className={styles.body}>
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
          <webview src={WEB_EMBED_URLS.taxfree} partition="persist:embeds" className={styles.embed} />
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
            {tabLabels[i]}
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
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </>
  );
}
