import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import mainImg from '@renderer/assets/photos/hwaseong/about/main.png';
import foodImg from '@renderer/assets/photos/hwaseong/about/food.png';
import stationImg from '@renderer/assets/photos/hwaseong/about/station.png';
import { trackEvent } from '@renderer/lib/analytics';
import { useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { HwaseongHeader } from './HwaseongHeader';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import styles from './HwaseongRestStop.module.css';

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
              <img src={mainImg} alt="화성휴게소" draggable={false} />
            </div>
            <div className={styles.section1Text}>
              <p className={styles.secTitle}>{L('Here_History')}</p>
              <p className={styles.secDesc}>{L('Here_HistoryContent')}</p>
            </div>
          </div>

          {/* Section 2: food photo left + 대표 먹거리 right */}
          <div className={styles.section2}>
            <div className={styles.squarePhoto}>
              <img src={foodImg} alt="대표 먹거리" draggable={false} />
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
              <img src={stationImg} alt="EX-OIL 주유소" draggable={false} />
            </div>
          </div>

        </div>
      </div>

      {/* ── Header (rendered on top of content) ── */}
      <HwaseongHeader controller={controller} title="화성휴게소" />

      <HwaseongLeftNav
        onHome={() => onNav('홈')}
        onBack={() => onNav('뒤로')}
      />
    </div>
  );
}
