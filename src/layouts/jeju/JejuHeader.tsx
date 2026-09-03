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
import { screenSubtitle, screenTitle, useLang, type Lang } from '@renderer/lib/i18n';
import { ui } from '@renderer/lib/uiText';
import styles from './JejuHeader.module.css';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}(${DAY_NAMES[d.getDay()]})`;
}

/**
 * Shown when a page has no description of its own.
 *
 * Still deliberately not hidden: every 제주 frame reserves this row, so an empty
 * one leaves the header looking short and unfinished. Pages resolve past it as
 * soon as they have copy — an explicit `subtitle` prop, a SubHeader_ or
 * _Subtitle row for their title id, or an EXTRA_SUBTITLE_KEYS entry.
 *
 * ★ This USED to be the Figma's literal 페이지 설명문, unlocalized, on the
 * argument that a visible placeholder makes a missing sheet row obvious on the
 * device. It did — 렌트카, 운항정보, 상세 and 탐나오 all shipped showing it, and
 * every one of them turned out to HAVE a sheet row that was simply never mapped
 * (see i18n's TITLE_KEYS). Those four are wired now, and a visitor should not be
 * reading a designer's placeholder in any case, so this is a real sentence in
 * all eight languages. The trade is deliberate and worth naming: a future
 * unmapped page will now look finished rather than broken, so a new 제주 page
 * needs its `sub` checked at review rather than spotted on the panel.
 *
 * (All of this is about a page with MISSING copy. A page that must draw no
 * description at all says so with `subtitleHidden` — see that prop.)
 */
const subtitleFallback = (lang: Lang): string => ui('pageSubtitleFallback', lang);

/** Drop a leading "* " marker the sheet prefixes most descriptions with. */
const stripStar = (s: string): string => s.replace(/^\s*\*\s*/, '');

interface Props {
  /** Controller for default home/back navigation. Optional when onHome/onBack given. */
  controller?: KioskController;
  /** Title shown in the centre pill (e.g. 언어선택, 검색). */
  title: string;
  /**
   * Subtitle under the title row. Explicit prop wins, else the sheet's subtitle
   * for this title id, else the generic line — see {@link subtitleFallback}.
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
  /**
   * Drop the description row entirely — no sheet lookup, no fallback line.
   *
   * This is NOT for a page with missing copy (those fall through to the sheet
   * and then the generic line — see {@link subtitleFallback}); it is for a page
   * told to carry no description at all. AR 한복체험 is the one such page today
   * (operator request, 2026-09-03): its header reads title-only, and the row
   * below simply does not render.
   */
  subtitleHidden?: boolean;
  /**
   * Grey out 홈/뒤로 and make them inert. For screens the visitor must not leave
   * mid-way — currently only 틀린그림찾기, which plays over a photo that is
   * already generating, where a stray 홈 tap resets the session and throws that
   * photo away.
   *
   * The buttons stay DRAWN rather than being hidden: they live in a fixed slot
   * on every 제주 page, and a header that loses them for a minute and grows them
   * back reads as a different screen. Dimmed-and-dead says "not yet"; missing
   * says "wrong page".
   */
  navDisabled?: boolean;
}

export function JejuHeader({
  controller,
  title,
  subtitle,
  onHome,
  onBack,
  subtitleColor,
  subtitleStar = true,
  subtitleHidden = false,
  navDisabled = false,
}: Props): JSX.Element {
  const today = useMemo(() => formatDate(new Date()), []);
  const lang = useLang();

  // Localize the Korean title id through the same path as the other kiosks;
  // unknown ids fall through unchanged (which is every id until the sheet lands).
  const localizedTitle = screenTitle(title, lang);
  // `||`, not `??`: a sheet row that exists with an EMPTY cell resolves to '',
  // which is just as missing as undefined and should fall through too.
  //
  // The leading "*" is stripped because this row already DRAWS a star (the
  // Figma star.svg beside the text). Most SubHeader_* cells are authored with a
  // literal "* " prefix — "* 방문하고자하는 3개의 카테고리를 선택해주세요" — which
  // rendered as two stars side by side. Stripping here rather than editing the
  // sheet keeps the cells usable by anything that has no star of its own, and
  // is the same `clean()` treatment JejuLanguage already applies to its labels.
  const resolvedSubtitle = stripStar(subtitle || screenSubtitle(title, lang) || subtitleFallback(lang));

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
        <button
          type="button"
          className={`${styles.navBtn} ${navDisabled ? styles.navBtnOff : ''}`}
          onClick={goHome}
          disabled={navDisabled}
          aria-label="홈"
        >
          {jejuIconUrl('hdr-home') && (
            <img src={jejuIconUrl('hdr-home')} alt="" className={styles.navBtnImg} draggable={false} />
          )}
        </button>

        <h1 className={styles.title}>{localizedTitle}</h1>

        <button
          type="button"
          className={`${styles.navBtn} ${navDisabled ? styles.navBtnOff : ''}`}
          onClick={goBack}
          disabled={navDisabled}
          aria-label="뒤로"
        >
          {jejuIconUrl('hdr-back') && (
            <img src={jejuIconUrl('hdr-back')} alt="" className={styles.navBtnImg} draggable={false} />
          )}
        </button>
      </div>

      {!subtitleHidden && resolvedSubtitle && (
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
