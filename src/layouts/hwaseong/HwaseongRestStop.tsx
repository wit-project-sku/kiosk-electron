import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { trackEvent } from '@renderer/lib/analytics';
import { useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongRestStop.module.css';

// Figma image assets (valid 7 days from build — replace with local bundled assets)
const IMG_MAIN   = 'https://www.figma.com/api/mcp/asset/6123fffa-e69d-40b7-89ff-79e9164b9ef5'; // 화성휴게소1
const IMG_FOOD   = 'https://www.figma.com/api/mcp/asset/747c64e8-fa85-49b7-9c20-7963ec5f3d5c'; // 대표 먹거리
const IMG_EXOIL  = 'https://www.figma.com/api/mcp/asset/d964871a-eba6-40b1-a098-ea924afa4226'; // EX-OIL

interface Props {
  controller: KioskController;
}

/**
 * Split a description into paragraph blocks at a blank line OR before a '>'
 * marker line (e.g. '> 위치정보'). The blank line / '>' is how the sheet marks a
 * new block; the '>' itself stays in the displayed text (matching Figma). Each
 * block renders as its own paragraph; the gap between them is set per section.
 */
function descBlocks(text: string): string[] {
  return text
    .split(/\n\s*\n|\n(?=\s*>)/)
    .map((b) => b.trim())
    .filter(Boolean);
}

export function HwaseongRestStop({ controller }: Props): JSX.Element {
  const lang = useLang();
  const L = (key: string): string => t(key, lang);

  function onNav(label: string): void {
    trackEvent({ name: 'button_clicked', payload: { screen: 'tourism', label, kiosk: 'W005' } });
    controller.navigate('home');
  }

  const homeIconSrc = hwaseongIconUrl('ico-home');
  const backIconSrc = hwaseongIconUrl('nav-back');
  const bgSrc       = hwaseongIconUrl('bg');

  return (
    <div className={styles.root}>
      {/* Background */}
      <div className={styles.bgBase} />
      {bgSrc && <img src={bgSrc} alt="" className={styles.bgImage} draggable={false} />}

      {/* ── Scrollable content ────────────────── */}
      <div className={styles.contentArea}>
        <div className={styles.card}>

          {/* Section 1: full-width photo + 주요 특징 및 테마 */}
          <div className={styles.section1}>
            <div className={styles.mainPhoto}>
              <img src={IMG_MAIN} alt="화성휴게소" draggable={false} />
            </div>
            <div className={styles.section1Text}>
              <p className={styles.secTitle}>{L('Here_History')}</p>
              <p className={styles.secDesc}>{L('Here_HistoryContent')}</p>
            </div>
          </div>

          {/* Section 2: food photo left + 대표 먹거리 right */}
          <div className={styles.section2}>
            <div className={styles.squarePhoto}>
              <img src={IMG_FOOD} alt="대표 먹거리" draggable={false} />
            </div>
            <div className={styles.sideText}>
              <p className={styles.secTitle}>{L('Here_Culture')}</p>
              <div className={`${styles.descBlocks} ${styles.descGap2}`}>
                {descBlocks(L('Here_CultureContent')).map((b, i) => (
                  <p key={i} className={styles.sideDesc}>{b}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: 편의시설 left + EX-OIL photo right */}
          <div className={styles.section3}>
            <div className={styles.section3Text}>
              <p className={styles.secTitle}>{L('Here_Attraction')}</p>
              <div className={`${styles.descBlocks} ${styles.descGap3}`}>
                {descBlocks(L('Here_AttractionContent')).map((b, i) => (
                  <p key={i} className={styles.sideDesc}>{b}</p>
                ))}
              </div>
            </div>
            <div className={`${styles.squarePhoto} ${styles.squarePhotoFill}`}>
              <img src={IMG_EXOIL} alt="EX-OIL 주유소" draggable={false} />
            </div>
          </div>

        </div>
      </div>

      {/* ── Header (rendered on top of content) ── */}
      <HwaseongHeader controller={controller} title="화성휴게소" />

      {/* ── Left nav ─────────────────────────────── */}
      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={() => onNav('홈')} aria-label="홈">
          {homeIconSrc ? <img src={homeIconSrc} alt="홈" draggable={false} /> : null}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={() => onNav('뒤로')} aria-label="뒤로">
          {backIconSrc ? <img src={backIconSrc} alt="뒤로" draggable={false} /> : null}
        </button>
      </div>
    </div>
  );
}
