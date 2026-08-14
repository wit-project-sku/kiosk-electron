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

/**
 * Shown when a page has no description of its own — the literal string the
 * Figma frames draw in this slot.
 *
 * Deliberately NOT localized and deliberately not hidden: every 제주 frame
 * reserves this row, so an empty one leaves the header looking short and
 * unfinished, and the visible placeholder is also what makes a missing sheet
 * row obvious on the device. Pages resolve past it as soon as they have copy —
 * an explicit `subtitle` prop, or a SubHeader_* row for their title id.
 */
const SUBTITLE_FALLBACK = '페이지 설명문';

/** Drop a leading "* " marker the sheet prefixes most descriptions with. */
const stripStar = (s: string): string => s.replace(/^\s*\*\s*/, '');

interface Props {
  /** Controller for default home/back navigation. Optional when onHome/onBack given. */
  controller?: KioskController;
  /** Title shown in the centre pill (e.g. 언어선택, 검색). */
  title: string;
  /**
   * Subtitle under the title row. Explicit prop wins, else the sheet's subtitle
   * for this title id, else the Figma's own placeholder — see SUBTITLE_FALLBACK.
   */
  subtitle?: string;
  /** Override the home-button action (e.g. the shared photo workflow). */
  onHome?: () => void;
  /** Override the back-button action (defaults to the home action). */
  onBack?: () => void;
  /**
   * Subtitle colour. Most pages use the default grey; the ones that don't say
   * so explicitly in Figma — 코스 상세 is #616161 and WIT Store is #8b7355 to
   * sit with the store's brown palette.
   */
  subtitleColor?: string;
  /** Draw the ★ before the subtitle. The WIT Store frame omits it. */
  subtitleStar?: boolean;
}

export function JejuHeader({
  controller,
  title,
  subtitle,
  onHome,
  onBack,
  subtitleColor,
  subtitleStar = true,
}: Props): JSX.Element {
  const today = useMemo(() => formatDate(new Date()), []);
  const lang = useLang();

  // Localize the Korean title id through the same path as the other kiosks;
  // unknown ids fall through unchanged (which is every id until the sheet lands).
  const localizedTitle = screenTitle(title, lang);
  // `||`, not `??`: a sheet row that exists with an EMPTY cell resolves to '',
  // which is just as missing as undefined and should show the placeholder too.
  //
  // The leading "*" is stripped because this row already DRAWS a star (the
  // Figma star.svg beside the text). Most SubHeader_* cells are authored with a
  // literal "* " prefix — "* 방문하고자하는 3개의 카테고리를 선택해주세요" — which
  // rendered as two stars side by side. Stripping here rather than editing the
  // sheet keeps the cells usable by anything that has no star of its own, and
  // is the same `clean()` treatment JejuLanguage already applies to its labels.
  const resolvedSubtitle = stripStar(subtitle || screenSubtitle(title, lang) || SUBTITLE_FALLBACK);

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
          {subtitleStar && jejuIconUrl('star') && (
            <img src={jejuIconUrl('star')} alt="" className={styles.subtitleStar} draggable={false} />
          )}
          <p className={styles.subtitleText} style={subtitleColor ? { color: subtitleColor } : undefined}>
            {resolvedSubtitle}
          </p>
        </div>
      )}
    </div>
  );
}
