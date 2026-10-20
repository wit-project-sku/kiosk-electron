import { useEffect, useRef, useState } from 'react';
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { sheetText, t } from '@renderer/lib/loc';
import { ui } from '@renderer/lib/uiText';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useTaxfreeBodyLayout } from '@renderer/hooks/useTaxfreeBodyLayout';
import { TAXFREE_PAGE_BASES, taxfreePageImg } from '@renderer/lib/taxfreePages';
import { taxfreeUrl } from '@shared/constants/webEmbeds';
import { OsanHeader } from './OsanHeader';
import headerStyles from './OsanHeader.module.css';
import { OsanLeftNav } from './OsanLeftNav';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import styles from './OsanTaxfree.module.css';
import { useFitText } from '@layouts/components/fitText';

type TabId = 'refund' | 'intro' | 'merchant';
/** Bottom tab labels, in tab order (refund / intro / merchant). Sourced from
 *  this location's Localization sheet so a copy edit needs no code change —
 *  `t()` resolves against the running kiosk's own table. */
const TAB_KEYS = ['Taxfree_Apply', 'Taxfree_Introduce', 'Taxfree_Enroll'] as const;

/** 오색시장 routes merchant sign-up through WIT GLOBAL, not insadong's
 *  보존회, so its 가맹점 신청 page differs; everything else falls through to
 *  the shared set. */
const VARIANT = 'wit';

/**
 * Per-tab description, one line (오산>TAXFREE-01 / -02): the sheet's
 * `Taxfree_Subtitle1` / `Taxfree_Subtitle2` rows (Localization_Osaek) — with this copy
 * behind them. Not `SubHeader_TaxFree`, the page's two-line receipts text,
 * which the frames do not show.
 */
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

/** The card's foot: 664 + 2290 (Figma 7838:124719). */
const BODY_BOTTOM = 2954;
/** The refund site's design viewport height (it is 1820 wide, like the card). */
const EMBED_HEIGHT = 2250;

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

interface OsanTaxfreeProps {
  controller: KioskController;
}

export function OsanTaxfree({ controller }: OsanTaxfreeProps): JSX.Element {
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
  /* ♿ B오산>TAXFREE-01 (7887:50688): the page keeps OsanKiosk's shift; the card
     sits at 953 (1820×2290), the tabs drop to 3441 and the promo goes. */
  const low = useAccessibilityStore((s) => s.lowReach);
  const bodyStyle = low
    ? { top: 'calc(953px - var(--osan-mode-push, 0px))', height: 2290 }
    : { top: bodyLayout.top, height: BODY_BOTTOM - bodyLayout.top };

  // Strip the embedded page's own scroll: hide its scrollbars and lock the
  // document so the refund webview shows no inner scroll UI. Injected on
  // dom-ready (and re-applied on every in-page navigation).
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

  return (
    <div ref={rootRef} className={low ? `${styles.root} ${styles.low}` : styles.root}>
      {osanIconUrl('page-bg') && <img className={styles.bgImage} src={osanIconUrl('page-bg')} alt="" draggable={false} />}

      <OsanHeader
        title="TAX-FREE"
        subtitle={
          activeTab === 'merchant'
            ? sheetText('Taxfree_Subtitle2', lang, MERCHANT_SUBTITLE)
            : sheetText('Taxfree_Subtitle1', lang, REFUND_SUBTITLE)
        }
        onHome={goHome}
        subtitleClassName={`${headerStyles.subtitleTaxfree} ${headerStyles.subtitleWide}`}
        subtitleRef={subtitleRef}
      />

      {/* 7838:124719 — a 1820×2290 card at (170, 664): the tab artwork is
          drawn at exactly that size, so it renders 1:1. A description longer
          than Korean's one line pushes it down and shortens it instead. */}
      <div className={styles.body} style={bodyStyle}>
        {activeTab === 'intro' && (
          <TaxRefundInfo lang={lang} onGoToWebview={() => setActiveTab('refund')} />
        )}

        {/* refund webview — always mounted to pre-warm. It fills the card at
            the site's own 1820×2250 (see .embedFrame). */}
        <div
          className={styles.embedFrame}
          style={{
            ['--embed-scale' as string]: Math.min(1, (low ? 2290 : BODY_BOTTOM - bodyLayout.top) / EMBED_HEIGHT),
            visibility: activeTab === 'refund' ? 'visible' : 'hidden',
            pointerEvents: activeTab === 'refund' ? 'auto' : 'none',
          }}
        >
          {/* eslint-disable-next-line react/no-unknown-property */}
          <webview ref={webviewRef} src={taxfreeUrl(controller.kioskId)} partition="persist:embeds" className={styles.embed} />
        </div>

        {activeTab === 'merchant' && <MerchantTab lang={lang} />}
      </div>

      <div ref={tabsRef} className={styles.tabs}>
        {(['refund', 'intro', 'merchant'] as TabId[]).map((tab, i) => (
          <button
            key={tab}
            type="button"
            className={`${styles.tab} ${wide ? styles.tabLong : ''} ${
              activeTab === tab ? styles.tabSelected : tab === 'refund' ? styles.tabOutlined : ''
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {t(TAB_KEYS[i]!, lang)}
          </button>
        ))}
      </div>

      <OsanLeftNav onHome={goHome} />

      {/* 7838:124823 — all three TAXFREE frames carry the 상점 검색 promo (the
          뭐하지 banner art, orange strip), which opens 검색. */}
      {!low && osanIconUrl('banner-course') && (
        <button
          type="button"
          className={styles.banner}
          onClick={() => controller.navigate('search', '검색')}
          aria-label={ui('searchShops', lang)}
        >
          <img src={osanIconUrl('banner-course')} alt="" draggable={false} />
        </button>
      )}
    </div>
  );
}
