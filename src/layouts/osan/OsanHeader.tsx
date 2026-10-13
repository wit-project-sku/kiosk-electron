import { type Ref, useEffect, useRef, useState } from 'react';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { screenSubtitle, screenTitle, useLang } from '@renderer/lib/i18n';
import styles from './OsanHeader.module.css';
import { useFitText } from '@layouts/components/fitText';
import { useHeaderPush } from '@layouts/components/headerPush';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}(${WEEKDAYS[d.getDay()]})`;
}

interface OsanHeaderProps {
  title: string;
  onHome: () => void;
  onBack?: () => void;
  subtitle?: string;
  compact?: boolean;
  /** Hides the ★ description row (the AR 한복체험 picker has none). */
  subtitleHidden?: boolean;
  /** White title over a dark background (e.g. the K-DRAMA promo page). */
  light?: boolean;
  /** Extra class on the subtitle row (e.g. TAX-FREE bottom gap). */
  subtitleClassName?: string;
  /** Ref on the subtitle row — used by TAX-FREE to size the webview card. */
  subtitleRef?: Ref<HTMLDivElement>;
  /** Bold #616161 description with no ★ — the AI result frame's "AI 맞춤 추천 코스". */
  strongSubtitle?: boolean;
}

/**
 * Shared content-screen header for W004 — Figma `Component 35` (seen on
 * 오산>언어선택 7812:105898): OSAEK MARKET brand + date, home / title / back,
 * then the ★ description row. Brand and buttons in main 01 #1A4D7E.
 */
export function OsanHeader({
  title,
  onHome,
  onBack,
  subtitle,
  compact = false,
  subtitleHidden = false,
  light = false,
  subtitleClassName,
  subtitleRef,
  strongSubtitle = false,
}: OsanHeaderProps): JSX.Element {
  const lang = useLang();
  // Some sheet title cells are authored as bullet lines ("* 언어선택") — the
  // marker is spreadsheet formatting, not copy, same as on the description.
  const localizedTitle = screenTitle(title, lang).replace(/^\s*[*★•]\s*/, '');
  /* Korean titles sit on one line in the fixed 182px row; several of the other
     languages need two or three. See "Other languages" in the CSS. */
  const wide = lang !== 'ko';
  const titleRowRef = useRef<HTMLDivElement>(null);
  useFitText(titleRowRef, styles.titleRow, wide, 0.6, localizedTitle);
  /* A description that wraps past one line pushes the page content down by the
     extra lines instead of being drawn over it — see components/headerPush. */
  const headerRef = useRef<HTMLElement>(null);
  const subTextRef = useRef<HTMLSpanElement>(null);
  const rawSub = subtitle ?? screenSubtitle(title, lang) ?? '';
  const sub = rawSub.replace(/^\s*[*★]\s*/, '').trim();
  useHeaderPush(headerRef, subTextRef, wide && !!sub, `${lang}|${sub}`);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header ref={headerRef} className={`${styles.header} ${compact || subtitleHidden ? styles.headerCompact : ''}`}>
      <div className={styles.headerBlock}>
        <div className={styles.topRow}>
          <div className={styles.brand}>
            {osanIconUrl('location-pin') && (
              <img className={styles.pin} src={osanIconUrl('location-pin')} alt="" draggable={false} />
            )}
            <span>OSAEK MARKET</span>
          </div>
          <span className={styles.date}>{formatDate(now)}</span>
        </div>

        <div ref={titleRowRef} className={styles.titleRow}>
          <button type="button" className={styles.navBtn} onClick={onHome} aria-label="홈으로">
            {osanIconUrl('home-btn') && (
              <img src={osanIconUrl('home-btn')} alt="" draggable={false} />
            )}
          </button>
          <h1 className={`${styles.title} ${wide ? styles.titleLong : ''} ${light ? styles.titleLight : ''}`}>
            {localizedTitle}
          </h1>
          <button
            type="button"
            className={styles.navBtn}
            onClick={onBack ?? onHome}
            aria-label="뒤로"
          >
            {osanIconUrl('back-arrow') && (
              <img src={osanIconUrl('back-arrow')} alt="" draggable={false} />
            )}
          </button>
        </div>
      </div>

      {!compact && !subtitleHidden && sub && (
        <div
          ref={subtitleRef}
          className={`${styles.subtitle} ${wide ? styles.subtitleLong : ''} ${subtitleClassName ?? ''}`}
        >
          {!strongSubtitle && (
            <span className={styles.star}>
              {osanIconUrl('header-star') && (
                <img className={styles.starImg} src={osanIconUrl('header-star')} alt="" draggable={false} />
              )}
            </span>
          )}
          <span ref={subTextRef} className={`${styles.subtitleText} ${strongSubtitle ? styles.subtitleStrong : ''}`}>
            {sub}
          </span>
        </div>
      )}
    </header>
  );
}
