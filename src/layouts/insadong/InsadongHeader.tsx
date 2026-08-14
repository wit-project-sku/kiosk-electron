import { useEffect, useRef, useState, type Ref } from 'react';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { screenSubtitle, screenTitle, useLang } from '@renderer/lib/i18n';
import styles from './InsadongHeader.module.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}(${WEEKDAYS[d.getDay()]})`;
}

interface InsadongHeaderProps {
  title: string;
  /** Tapped on the home button (and the back chevron unless onBack is given). */
  onHome: () => void;
  /** Back chevron handler; falls back to onHome when omitted. */
  onBack?: () => void;
  /** Optional subtitle (defaults to the localized "페이지 설명문"). */
  subtitle?: string;
  /** Compact mode (Figma 고궁안내 상세): no subtitle, header height 574 not 700. */
  compact?: boolean;
  /** Light mode (Figma promotion page): white title over the dark background. */
  light?: boolean;
  /** Extra class on the subtitle row (e.g. TAX-FREE bottom gap). */
  subtitleClassName?: string;
  /** Ref on the subtitle row — used by TAX-FREE to size the webview card. */
  subtitleRef?: Ref<HTMLDivElement>;
}

/**
 * Shared content-screen header (Figma "R=상단 메인", 2160×700): INSADONG + live
 * date, then a title row (home button · centered title · back chevron), then a
 * subtitle. Exact Figma metrics in InsadongHeader.module.css.
 */
export function InsadongHeader({ title, onHome, onBack, subtitle, compact = false, light = false, subtitleClassName, subtitleRef }: InsadongHeaderProps): JSX.Element {
  const lang = useLang();
  const localizedTitle = screenTitle(title, lang);
  const rawSub = subtitle ?? screenSubtitle(title, lang) ?? '';
  // The sheet copy often begins with its own "*"/"★"; the header already renders
  // a star, so strip a leading marker to avoid showing two.
  const sub = rawSub.replace(/^\s*[*★]\s*/, '').trim();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className={`${styles.header} ${compact ? styles.headerCompact : ''}`}>
      <div className={styles.headerBlock}>
        <div className={styles.topRow}>
          <div className={styles.brand}>
            {iconUrl('location-pin') && (
              <img className={styles.pin} src={iconUrl('location-pin')} alt="" draggable={false} />
            )}
            <span>INSADONG</span>
          </div>
          <span className={styles.date}>{formatDate(now)}</span>
        </div>

        <div className={styles.titleRow}>
          <button type="button" className={styles.navBtn} onClick={onHome} aria-label="홈으로">
            {iconUrl('home-btn') && <img src={iconUrl('home-btn')} alt="" draggable={false} />}
          </button>
          <h1 className={`${styles.title} ${light ? styles.titleLight : ''}`}>{localizedTitle}</h1>
          <button type="button" className={styles.navBtn} onClick={onBack ?? onHome} aria-label="뒤로">
            {iconUrl('back-arrow') && <img src={iconUrl('back-arrow')} alt="" draggable={false} />}
          </button>
        </div>
      </div>

      {!compact && sub && (
        <div ref={subtitleRef} className={`${styles.subtitle} ${subtitleClassName ?? ''}`}>
          <span className={styles.star}>★</span>
          <span className={styles.subtitleText}>{sub}</span>
        </div>
      )}
    </header>
  );
}
