/**
 * Canonical 제주공항 sub-page header — Figma `Component 34` (node 6043:14438).
 *
 * Same position, sizing, fonts and icons on every 제주 sub-page, mirroring
 * OsanHeader / HwaseongHeader. Note the date here carries NO time, unlike the
 * home screen's top bar.
 */
import { useMemo } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { screenSubtitle, screenTitle, useLang } from '@renderer/lib/i18n';
import styles from './JejuHeader.module.css';

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
  /** Title shown in the centre pill (e.g. 언어선택, 검색). */
  title: string;
  /**
   * Subtitle under the title row. Explicit prop wins, else the sheet's subtitle
   * for this title id, else the row is hidden.
   *
   * The Figma shows the literal placeholder "페이지 설명문" here — that is Figma
   * boilerplate, not copy, so nothing is invented in its place. Real subtitles
   * appear automatically once Localization_Jeju exists.
   */
  subtitle?: string;
  /** Override the home-button action (e.g. the shared photo workflow). */
  onHome?: () => void;
  /** Override the back-button action (defaults to the home action). */
  onBack?: () => void;
}

export function JejuHeader({ controller, title, subtitle, onHome, onBack }: Props): JSX.Element {
  const today = useMemo(() => formatDate(new Date()), []);
  const lang = useLang();

  // Localize the Korean title id through the same path as the other kiosks;
  // unknown ids fall through unchanged (which is every id until the sheet lands).
  const localizedTitle = screenTitle(title, lang);
  const resolvedSubtitle = subtitle ?? screenSubtitle(title, lang);

  const goHome = onHome ?? ((): void => controller?.navigate('home', '홈'));
  const goBack = onBack ?? goHome;

  return (
    <div className={styles.root}>
      <div className={styles.topRow}>
        <div className={styles.topLeft}>
          {jejuIconUrl('ico-location') && (
            <img src={jejuIconUrl('ico-location')} alt="" className={styles.locationIcon} draggable={false} />
          )}
          <span className={styles.siteName}>JEJUDO ISLAND</span>
        </div>
        <span className={styles.date}>{today}</span>
      </div>

      <div className={styles.titleRow}>
        <button type="button" className={styles.navBtn} onClick={goHome} aria-label="홈">
          {jejuIconUrl('hdr-home') && (
            <img src={jejuIconUrl('hdr-home')} alt="" className={styles.navBtnImg} draggable={false} />
          )}
        </button>

        <h1 className={styles.title}>{localizedTitle}</h1>

        <button type="button" className={styles.navBtn} onClick={goBack} aria-label="뒤로">
          {jejuIconUrl('hdr-back') && (
            <img src={jejuIconUrl('hdr-back')} alt="" className={styles.navBtnImg} draggable={false} />
          )}
        </button>
      </div>

      {resolvedSubtitle && (
        <div className={styles.subtitle}>
          {jejuIconUrl('star') && (
            <img src={jejuIconUrl('star')} alt="" className={styles.subtitleStar} draggable={false} />
          )}
          <p className={styles.subtitleText}>{resolvedSubtitle}</p>
        </div>
      )}
    </div>
  );
}
