/**
 * 제주 TAX-FREE — Figma node 6212:57255 (제주>TAXFREE-01).
 *
 * Three tabs over one 1820×2290 panel, the same shape as Osan and 화성 because
 * it is the same service:
 *   세금 환급 신청       the linktaxfree web app, in a <webview>
 *   텍스프리 소개         two artwork pages with drawn chevrons — THIS frame
 *   텍스프리 가맹점 신청   one artwork page
 *
 * The panel this frame draws (Rectangle 4226 + the 텍스프리 소개 table + 환급
 * 절차 steps) is pixel-identical to the artwork already shipped at exactly
 * 1820×2290, so it is rendered as that image rather than re-authored in blue
 * CSS that would drift from the other locations — see taxFreePages.ts. Only the
 * chrome around it is Jeju's: header, orange tabs, left nav, banner.
 *
 * The frame squashes its header instance to 585 and re-draws the subtitle at
 * y578 as a loose group; the shared JejuHeader keeps its canonical 700 with the
 * subtitle at y559, which lands 45px above the panel instead of 26px. Nothing
 * else in the frame moves, so the shared chrome is used as-is.
 */
import { useEffect, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { pick } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { trackEvent } from '@renderer/lib/analytics';
import { taxfreeUrl } from '@shared/constants/webEmbeds';
import { taxFreePageImg, preloadTaxFreePages } from '../components/taxFreePages';
import type { TaxfreeVariant } from '../components/taxFreePages';
import { useHideEmbedScrollbars } from '../components/useHideEmbedScrollbars';
import { JejuPageFrame } from './JejuPageFrame';
import styles from './JejuTaxFree.module.css';

type TabId = 'refund' | 'intro' | 'merchant';

/** Tabs in frame order (6212:57353 / 57356 / 57359) with their sheet keys. */
const TABS: ReadonlyArray<{ id: TabId; key: string }> = [
  { id: 'refund', key: 'Taxfree_Apply' },
  { id: 'intro', key: 'Taxfree_Introduce' },
  { id: 'merchant', key: 'Taxfree_Enroll' },
];

/**
 * The frame's own subtitle copy (6212:57363). Authored here rather than through
 * TITLE_KEYS: 'TAX-FREE' maps to SubHeader_TaxFree, which is a two-line string
 * about preparing receipts — different copy, and two lines in a 60px single-row
 * slot. It is also a title id shared with the other three locations, so an
 * override there would change their pages too.
 */
const SUBTITLE = {
  ko: '텍스리펀드 서비스를 통해 텍스를 환급해가세요',
  en: 'Get your tax refunded with the Tax Refund service',
  ja: 'タックスリファンドで税金の払い戻しを受けましょう',
  zh: '通过退税服务领取您的退税款',
  vi: 'Nhận hoàn thuế qua dịch vụ Tax Refund',
  th: 'รับคืนภาษีผ่านบริการ Tax Refund',
  ru: 'Получите возврат налога через сервис Tax Refund',
  id: 'Dapatkan pengembalian pajak lewat layanan Tax Refund',
};

interface Props {
  controller: KioskController;
}

/**
 * 제주공항's 가맹점 신청 page must name WIT GLOBAL INC., not 인사동전통문화보존회.
 *
 * This is NOT a default — it is the whole reason `taxFreePageImg` takes a
 * variant. Drop it and the tab silently prints Insadong's 02-737-7890 to every
 * shop owner at Jeju airport, in every language, with nothing failing.
 *
 * Only tab3 is affected; 소개 (tab1-p1/p2) explains the national scheme and
 * resolves to the shared artwork for every location.
 */
const VARIANT: TaxfreeVariant = 'wit';

export function JejuTaxFree({ controller }: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const [tab, setTab] = useState<TabId>('refund');
  // 소개 is two pages, flipped by the chevrons drawn into the artwork.
  const [introPage, setIntroPage] = useState(0);

  const webviewRef = useRef<HTMLElement | null>(null);
  useHideEmbedScrollbars(webviewRef);

  useEffect(() => preloadTaxFreePages(lang, VARIANT), [lang]);

  const p1 = taxFreePageImg('tab1-p1', lang, VARIANT);
  const p2 = taxFreePageImg('tab1-p2', lang, VARIANT);
  const merchant = taxFreePageImg('tab3', lang, VARIANT);

  const select = (id: TabId): void => {
    trackEvent({
      name: 'button_clicked',
      payload: { screen: 'taxfree', tab: id, kioskId: controller.kioskId },
    });
    setTab(id);
    if (id === 'intro') setIntroPage(0);
  };

  return (
    <JejuPageFrame
      controller={controller}
      title="TAX-FREE"
      subtitle={pick(SUBTITLE, lang)}
      bannerFallback="banner-detail"
      onBack={() => controller.navigate('home', '뒤로')}
    >
      <div className={styles.panel}>
        {/* The refund web app stays mounted so it is warm the first time the
            tab is opened; hidden rather than unmounted for the same reason. */}
        <div
          className={styles.layer}
          style={{
            visibility: tab === 'refund' ? 'visible' : 'hidden',
            pointerEvents: tab === 'refund' ? 'auto' : 'none',
          }}
        >
          {/* `partition` keeps every embedded site in one persistent session. */}
          {/* eslint-disable-next-line react/no-unknown-property */}
          <webview ref={webviewRef} src={taxfreeUrl(controller.kioskId)} partition="persist:embeds" className={styles.embed} />
        </div>

        {tab === 'intro' && (
          <>
            <div className={`${styles.layer} ${introPage === 0 ? styles.pageOn : styles.pageOff}`}>
              {p1 && <img src={p1} alt="" className={styles.pageImg} draggable={false} />}
              {/* Over the ">" drawn at the panel's right edge (6212:57309). */}
              <button
                type="button"
                className={`${styles.navHotspot} ${styles.navRight}`}
                onClick={() => setIntroPage(1)}
                aria-label="다음"
              />
            </div>
            <div className={`${styles.layer} ${introPage === 1 ? styles.pageOn : styles.pageOff}`}>
              {p2 && <img src={p2} alt="" className={styles.pageImg} draggable={false} />}
              <button
                type="button"
                className={`${styles.navHotspot} ${styles.navLeft}`}
                onClick={() => setIntroPage(0)}
                aria-label="이전"
              />
              {/* Over page 2's "세금 환급 신청하러 가기" CTA. */}
              <button
                type="button"
                className={styles.applyHotspot}
                onClick={() => select('refund')}
                aria-label="세금 환급 신청"
              />
            </div>
          </>
        )}

        {tab === 'merchant' && (
          <div className={styles.layer}>
            {merchant && <img src={merchant} alt="" className={styles.pageImg} draggable={false} />}
          </div>
        )}
      </div>

      <div className={styles.tabs}>
        {TABS.map(({ id, key }) => (
          <button
            key={id}
            type="button"
            className={`${styles.tab} ${tab === id ? styles.tabSelected : ''}`}
            onClick={() => select(id)}
          >
            {t(key, lang)}
          </button>
        ))}
      </div>
    </JejuPageFrame>
  );
}
