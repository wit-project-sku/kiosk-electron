/**
 * 화성휴게소 TAX-FREE — Figma 7918:126869 (텍스프리 소개) / 7918:127083 (가맹점
 * 신청), the 오산 TAX-FREE frames in [화성휴게소] main 1 #005AB4.
 *
 * Header with a per-tab description · the 1820×2290 card at (170, 664) holding
 * the refund site or the tab artwork · three tabs at 3016 · the 상점 검색 promo.
 *
 * The 소개 / 가맹점 pages stay the shared artwork (lib/taxfreePages) rather than
 * the frame's live layers: those images exist in all eight languages, and the
 * 가맹점 page must name WIT GLOBAL (the frame's copy is 인사동's 보존회).
 */
import { useEffect, useRef, useState } from 'react';
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { sheetText, t } from '@renderer/lib/loc';
import { ui } from '@renderer/lib/uiText';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useTaxfreeBodyLayout } from '@renderer/hooks/useTaxfreeBodyLayout';
import { TAXFREE_PAGE_BASES, taxfreePageImg } from '@renderer/lib/taxfreePages';
import { taxfreeUrl } from '@shared/constants/webEmbeds';
import { trackEvent } from '@renderer/lib/analytics';
import { HwaseongHeader } from './HwaseongHeader';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import { HwaseongPageBg } from './HwaseongPageBg';
import headerStyles from './HwaseongHeader.module.css';
import styles from './HwaseongTaxFree.module.css';
import { useFitText } from '@layouts/components/fitText';

type TabId = 'refund' | 'intro' | 'merchant';
/** Bottom tab labels, in tab order (refund / intro / merchant). Sourced from
 *  this location's Localization sheet so a copy edit needs no code change —
 *  `t()` resolves against the running kiosk's own table. */
const TAB_KEYS = ['Taxfree_Apply', 'Taxfree_Introduce', 'Taxfree_Enroll'] as const;

/** 화성휴게소 routes merchant sign-up through WIT GLOBAL, not insadong's
 *  보존회, so its 가맹점 신청 page differs; everything else falls through to
 *  the shared set. */
const VARIANT = 'wit';

/** Per-tab description (7918:126977 / 127140): the sheet's Taxfree_header1 /
 *  Taxfree_header2 rows, with the frames' copy behind them. */
const REFUND_SUBTITLE = {
  ko: '텍스리펀드 서비스를 통해 텍스를 환급해가세요',
  en: 'Get your tax refunded with the Tax Refund service',
  ja: 'タックスリファンドで税金の払い戻しを受けましょう',
  zh: '通过退税服务领取您的退税款',
  vi: 'Nhận hoàn thuế qua dịch vụ Tax Refund',
  th: 'รับคืนภาษีผ่านบริการ Tax Refund',
  ru: 'Получите возврат налога через сервис Tax Refund',
  id: 'Dapatkan pengembalian pajak lewat layanan Tax Refund',
};
const MERCHANT_SUBTITLE = {
  ko: '텍스프리 가맹점을 무상으로 신청하세요',
  en: 'Apply to become a tax-free merchant, free of charge',
  ja: 'タックスフリー加盟店を無料でご申請ください',
  zh: '免费申请成为退税商店',
  vi: 'Đăng ký làm cửa hàng miễn thuế miễn phí',
  th: 'สมัครเป็นร้านค้าปลอดภาษีฟรี',
  ru: 'Подайте заявку на tax-free — бесплатно',
  id: 'Daftar jadi toko bebas pajak, gratis',
};

/** The card's foot: 664 + 2290. */
const BODY_BOTTOM = 2954;
/**
 * ♿ (B오산>TAXFREE-01 7918:128289): HwaseongKiosk moves the page under the mode
 * bar (146); on top of that the card drops 143 (953 → 3243 on the artboard)
 * and the tabs move to the foot (3441, see .tabsLow). No promo.
 */
const LOW_BODY_DROP = 143;

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
  /* Korean tab names fit the tab on one line; the other languages do not.
     See "Other languages" in the CSS. */
  const wide = lang !== 'ko';
  const tabsRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>('refund');
  const rootRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const bodyLayout = useTaxfreeBodyLayout(rootRef, subtitleRef, lang, activeTab);

  // Strip the embedded page's own scroll UI (re-applied on in-page navigation).
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

  useFitText(tabsRef, styles.tab, wide, 0.72, lang);

  const banner = hwaseongIconUrl('banner-search');
  const low = useAccessibilityStore((st) => st.lowReach);
  const bodyDrop = low ? LOW_BODY_DROP : 0;

  return (
    <div ref={rootRef} className={styles.root}>
      <HwaseongPageBg image="detail-page-bg" opacity={0.7} />

      <HwaseongHeader
        controller={controller}
        title="TAX-FREE"
        subtitle={
          activeTab === 'merchant'
            ? sheetText('Taxfree_header2', lang, MERCHANT_SUBTITLE)
            : sheetText('Taxfree_header1', lang, REFUND_SUBTITLE)
        }
        subtitleClassName={`${headerStyles.subtitleTaxfree} ${headerStyles.subtitleWide}`}
        subtitleRef={subtitleRef}
      />

      {/* The 1820×2290 card at (170, 664): the tab artwork is drawn at exactly
          that size. A description longer than Korean's line pushes it down. */}
      <div className={styles.body} style={{ top: bodyLayout.top + bodyDrop, height: BODY_BOTTOM - bodyLayout.top }}>
        {activeTab === 'intro' && (
          <TaxRefundInfo lang={lang} onGoToWebview={() => setActiveTab('refund')} />
        )}

        {/* refund webview — always mounted to pre-warm */}
        <div
          className={styles.embedFrame}
          style={{
            visibility: activeTab === 'refund' ? 'visible' : 'hidden',
            pointerEvents: activeTab === 'refund' ? 'auto' : 'none',
          }}
        >
          {/* eslint-disable-next-line react/no-unknown-property */}
          <webview ref={webviewRef} src={taxfreeUrl(controller.kioskId)} partition="persist:embeds" className={styles.embed} />
        </div>

        {activeTab === 'merchant' && <MerchantTab lang={lang} />}
      </div>

      <div ref={tabsRef} className={low ? `${styles.tabs} ${styles.tabsLow}` : styles.tabs}>
        {(['refund', 'intro', 'merchant'] as TabId[]).map((tab, i) => (
          <button
            key={tab}
            type="button"
            className={`${styles.tab} ${wide ? styles.tabLong : ''} ${
              activeTab === tab ? styles.tabSelected : tab === 'refund' ? styles.tabOutlined : ''
            }`}
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

      {/* 7918:126979 — the 상점 검색 promo (orange strip), which opens 검색. */}
      {banner && !low && (
        <button
          type="button"
          className={styles.banner}
          onClick={() => controller.navigate('search', '검색')}
          aria-label={ui('searchShops', lang)}
        >
          <img src={banner} alt="" className={styles.bannerImg} draggable={false} />
        </button>
      )}
    </div>
  );
}
