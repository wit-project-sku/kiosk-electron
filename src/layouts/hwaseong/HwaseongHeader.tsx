import { useMemo, type Ref } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { screenSubtitle, screenTitle, useLang } from '@renderer/lib/i18n';
import styles from './HwaseongHeader.module.css';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}(${DAY_NAMES[d.getDay()]})`;
}

interface Props {
  /** Controller for default home/back navigation. Optional when onHome/onBack given. */
  controller?: KioskController;
  /** Title shown in the centre pill (e.g. 검색, 언어선택, TAX-FREE). */
  title: string;
  /** Subtitle under the title row. Defaults to the Figma placeholder. */
  subtitle?: string;
  /** Override the home-button action (e.g. the shared photo workflow). */
  onHome?: () => void;
  /** Override the back-button action (defaults to the home action). */
  onBack?: () => void;
  /** Extra class on the subtitle row (e.g. TAX-FREE bottom gap). */
  subtitleClassName?: string;
  /** Ref on the subtitle row — used by TAX-FREE to size the webview card. */
  subtitleRef?: Ref<HTMLDivElement>;
}

/**
 * Canonical sub-page header (Figma Component29 / node 3788:40351).
 * Identical position, sizing, fonts and icons across every 화성휴게소 sub-page.
 */
export function HwaseongHeader({ controller, title, subtitle, onHome, onBack, subtitleClassName, subtitleRef }: Props): JSX.Element {
  const today = useMemo(() => formatDate(new Date()), []);
  const lang = useLang();
  // Localize the Korean title id (Localization_Hwaseong) — same path as the
  // other kiosks; unknown ids fall through unchanged. Subtitle: explicit prop
  // wins, else the sheet subtitle for this title id, else hidden.
  // Strip a stale "(준비중)" / "(Soon)" suffix the sheet may carry on an
  // otherwise-live title (e.g. 전국시장(준비중)) — same cleanup the home tiles do.
  const localizedTitle = screenTitle(title, lang).replace(
    /\s*[(（][^)）]*(?:준비\s?중|soon|準備中|筹备中|籌備中)[^)）]*[)）]\s*/gi,
    '',
  ).trim();
  const sub = (subtitle ?? screenSubtitle(title, lang) ?? '').replace(/^\s*[*★]\s*/, '').trim();
  const goHome = onHome ?? ((): void => controller?.navigate('home', 'Back'));
  const goBack = onBack ?? goHome;

  return (
    <div className={styles.header}>
      <div className={styles.headerTop}>
        {/* Row 1: location + brand + date */}
        <div className={styles.row1}>
          <div className={styles.left}>
            {hwaseongIconUrl('location-pin') && (
              <img
                className={styles.pin}
                src={hwaseongIconUrl('location-pin')}
                alt=""
                draggable={false}
              />
            )}
            <span className={styles.brand}>HWASEONG SA</span>
          </div>
          <span className={styles.date}>{today}</span>
        </div>

        {/* Row 2: home | title | back */}
        <div className={styles.titleRow}>
          <button type="button" className={styles.navBtn} onClick={goHome} aria-label="홈">
            {hwaseongIconUrl('ico-home') ? (
              <img src={hwaseongIconUrl('ico-home')} alt="" draggable={false} />
            ) : (
              <svg viewBox="0 0 175 175" fill="none"><circle cx="87.5" cy="87.5" r="87.5" fill="var(--kiosk-primary)" /><path d="M50 92L87.5 55L125 92V130H102V104H73V130H50V92Z" fill="#fff" /></svg>
            )}
          </button>
          <div className={styles.titleField}>
            <span className={styles.titleText}>{localizedTitle}</span>
          </div>
          <button type="button" className={styles.navBtn} onClick={goBack} aria-label="뒤로">
            {hwaseongIconUrl('nav-back') ? (
              <img src={hwaseongIconUrl('nav-back')} alt="" draggable={false} />
            ) : (
              <svg viewBox="0 0 175 175" fill="none"><circle cx="87.5" cy="87.5" r="87.5" fill="#e8e8e8" /><path d="M105 45L65 87.5L105 130" stroke="var(--kiosk-primary)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" /></svg>
            )}
          </button>
        </div>
      </div>

      {sub && (
        <div ref={subtitleRef} className={`${styles.subtitle} ${subtitleClassName ?? ''}`}>
          <svg className={styles.subtitleStar} viewBox="0 0 36 36" fill="var(--kiosk-primary)">
            <path d="M18 0l4.6 12.7L36 13.2l-10.5 8.3 3.7 13.5L18 27.6 6.8 35l3.7-13.5L0 13.2l13.4-.5z" />
          </svg>
          <span className={styles.subtitleText}>{sub}</span>
        </div>
      )}
    </div>
  );
}
