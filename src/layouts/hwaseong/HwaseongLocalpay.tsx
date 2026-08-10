import { useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import onnuriPaper from '@renderer/assets/photos/osan/localpay/onnuri-paper.png';
import onnuriDigital from '@renderer/assets/photos/osan/localpay/onnuri-digital.png';
import onnuriBi from '@renderer/assets/photos/osan/localpay/onnuri-bi.png';
import appQr from '@renderer/assets/photos/osan/localpay/app-qr.png';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongLocalpay.module.css';

// Every string on this screen comes from Localization_Hwaseong's MarketPaper_*
// rows (all 23 carry the full 8 languages), so a copy edit needs no code change.
// NOTE: the Figma card boxes are fixed-height with overflow:hidden, so the
// longest translations (ru/id run ~2× the Korean) can still clip — the boxes
// need a responsive pass, but that is a CSS problem, not a reason to ship Korean.
const TAB_KEYS = ['MarketPaper_Onnuri', 'MarketPaper_Osaekjeon'] as const;

/** Sheet copy carries `\n` line breaks and <b>…</b> bold runs. Render both
 *  rather than dumping raw markup on screen. */
function RichText({ text, className }: { text: string; className?: string }): JSX.Element {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i} className={className}>
          {line
            .split(/(<b>[\s\S]*?<\/b>)/g)
            .filter(Boolean)
            .map((part, j) =>
              part.startsWith('<b>') ? (
                <span key={j} className={styles.bodySemi}>
                  {part.slice(3, -4)}
                </span>
              ) : (
                <span key={j}>{part}</span>
              ),
            )}
        </p>
      ))}
    </>
  );
}

interface Props {
  controller: KioskController;
}

export function HwaseongLocalpay({ controller }: Props): JSX.Element {
  const banner = useRotatingBanner(hwaseongIconUrl('fg-banner'));
  const lang = useLang();
  const [tab, setTab] = useState(0);

  return (
    <div className={styles.root}>
      <div className={styles.bgBase} />
      {hwaseongIconUrl('bg') && (
        <img src={hwaseongIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      <HwaseongHeader controller={controller} title="지역화폐" />

      {/* Tab bar — Figma top=664 left=427 */}
      <div className={styles.tabs}>
        {TAB_KEYS.map((key, i) => (
          <button
            key={key}
            type="button"
            className={`${styles.tab} ${tab === i ? (i === 0 ? styles.tabSelected0 : styles.tabSelected1) : ''}`}
            onClick={() => setTab(i)}
          >
            {t(key, lang)}
          </button>
        ))}
      </div>

      {/* ── Tab 0: 온누리상품권 — full card, left=163 top=917 h=2344 ── */}
      {tab === 0 && (
        <div className={styles.card0}>
          <p className={styles.bigTitle}>{t('MarketPaper_Onnuri', lang)}</p>

          {/* 온누리상품권이란? */}
          <div className={styles.block}>
            <p className={styles.h}>{t('MarketPaper_Onnuri_Content_1', lang)}</p>
            <RichText text={t('MarketPaper_Onnuri_Content_1_1', lang)} className={styles.body} />
          </div>

          {/* 지류상품권 */}
          <div className={styles.blockWithGap}>
            <p className={styles.h}>{t('MarketPaper_Onnuri_Content_2', lang)}</p>
            <div className={styles.imgPaper}>
              <img src={onnuriPaper} alt="" draggable={false} />
            </div>
          </div>

          {/* 디지털 온누리상품권 */}
          <div className={styles.blockWithGap}>
            <div className={styles.block}>
              <p className={styles.h}>{t('MarketPaper_Onnuri_Content_3', lang)}</p>
              <RichText text={t('MarketPaper_Onnuri_Content_3_1', lang)} className={styles.body} />
            </div>
            <div className={styles.imgDigital}>
              <img src={onnuriDigital} alt="" draggable={false} />
            </div>
            <div className={styles.block}>
              <RichText text={t('MarketPaper_Onnuri_Content_3_2', lang)} className={styles.body} />
              <RichText text={t('MarketPaper_Onnuri_Content_3_3', lang)} className={styles.note} />
            </div>
          </div>

          {/* 사용처 */}
          <div className={styles.usageRow}>
            <div className={styles.usageText}>
              <p className={styles.h}>{t('MarketPaper_Onnuri_Content_4', lang)}</p>
              <RichText text={t('MarketPaper_Onnuri_Content_4_1', lang)} className={styles.body} />
            </div>
            <div className={styles.usageMedia}>
              <img className={styles.biLogo} src={onnuriBi} alt="" draggable={false} />
              <div className={styles.usageQr}>
                <img src={appQr} alt="" draggable={false} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 1: 행복화성지역화폐 — title-only white card + separate content ── */}
      {tab === 1 && (
        <>
          {/* White card: left=203 top=924 h=2314, title only */}
          <div className={styles.card1}>
            <p className={styles.card1Title}>{t('MarketPaper_Osaekjeon', lang)}</p>
          </div>

          {/* Content: left=243 top=1189 w=1740 gap=27 */}
          <div className={styles.content1}>
            {/* Block 1: 행복화성지역화폐란? h=298 */}
            <div className={styles.block1}>
              <p className={styles.block1Heading}>{t('MarketPaper_Osaekjeon_Content_1', lang)}</p>
              <div className={styles.block1Body}>
                <RichText text={t('MarketPaper_Osaekjeon_Content_1_1', lang)} />
              </div>
            </div>

            {/* Image 162: h=903 w=1643 */}
            {hwaseongIconUrl('localpay-image162') && (
              <div className={styles.imgLocalpay}>
                <img src={hwaseongIconUrl('localpay-image162')} alt="행복화성지역화폐 카드" draggable={false} />
              </div>
            )}

            {/* 누구나 신청 */}
            <div className={styles.block1Inner}>
              <p className={styles.h}>{t('MarketPaper_Osaekjeon_Content_2', lang)}</p>
              <RichText text={t('MarketPaper_Osaekjeon_Content_2_1', lang)} className={styles.body} />
              <RichText text={t('MarketPaper_Osaekjeon_Content_2_2', lang)} className={styles.body} />
            </div>

            {/* 지역화폐사용처 */}
            <div className={styles.block1Inner}>
              <p className={styles.h}>{t('MarketPaper_Osaekjeon_Content_3', lang)}</p>
              <RichText text={t('MarketPaper_Osaekjeon_Content_3_1', lang)} className={styles.body} />
              <div className={styles.note}>
                <RichText text={t('MarketPaper_Osaekjeon_Content_3_2', lang)} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Left nav */}
      <div className={styles.leftNav}>
        {hwaseongIconUrl('fg-leftnav') && (
          <img src={hwaseongIconUrl('fg-leftnav')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button type="button" className={styles.leftNavZoneHome} onClick={() => controller.navigate('home')} aria-label="홈" />
        <button type="button" className={styles.leftNavZoneBack} onClick={() => controller.navigate('home')} aria-label="뒤로" />
      </div>

      {/* Bottom banner */}
      <div className={styles.banner}>
        {banner && (
          <img src={banner} alt="" className={styles.bannerImg} draggable={false} />
        )}
      </div>
    </div>
  );
}
