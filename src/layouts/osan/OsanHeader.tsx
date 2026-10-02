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
  /** White title over a dark background (e.g. the K-DRAMA promo page). */
  light?: boolean;
  /** Extra class on the subtitle row (e.g. TAX-FREE bottom gap). */
  subtitleClassName?: string;
  /** Ref on the subtitle row — used by TAX-FREE to size the webview card. */
  subtitleRef?: Ref<HTMLDivElement>;
}

/** Shared content-screen header for W004 — OSAEK MARKET brand in navy #0e4e8c. */
export function OsanHeader({
  title,
  onHome,
  onBack,
  subtitle,
  compact = false,
  light = false,
  subtitleClassName,
  subtitleRef,
}: OsanHeaderProps): JSX.Element {
  const lang = useLang();
  const localizedTitle = screenTitle(title, lang);
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
    <header ref={headerRef} className={`${styles.header} ${compact ? styles.headerCompact : ''}`}>
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

      {!compact && sub && (
        <div ref={subtitleRef} className={`${styles.subtitle} ${subtitleClassName ?? ''}`}>
          <span className={styles.star}>★</span>
          <span ref={subTextRef} className={styles.subtitleText}>{sub}</span>
        </div>
      )}
    </header>
  );
}
