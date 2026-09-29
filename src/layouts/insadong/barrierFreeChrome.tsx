import type { ReactNode } from 'react';
import { useLang, type Lang } from '@renderer/lib/i18n';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { barrierFreeTitle } from './barrierFree';
import styles from './barrierFree.module.css';

/** Pages that already draw their own ♿ bar, or that are not a header page. */
const SKIP = new Set(['home', 'language', 'search', 'detail', 'photo', 'exchange']);

/** Promo moves flush under the bar, the way Jeju's lowReachBarBanner pages do. */
const BANNER = new Set(['events', 'market']);

/**
 * Coral "지금은 베리어프리 모드입니다." bar plus the header/content drop.
 * Language, search, detail, home and 환율 draw their own variant.
 */
export function BarrierShell({
  screen,
  children,
}: {
  screen: string;
  children: ReactNode;
}): JSX.Element {
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const lang = useLang();
  if (SKIP.has(screen)) return <>{children}</>;
  return (
    <div
      className={`${styles.lowRoot} ${lowReach ? (BANNER.has(screen) ? styles.shiftBanner : styles.shiftBar) : ''}`}
    >
      {lowReach && <div className={styles.modeBar}>{barrierFreeTitle(lang as Lang)}</div>}
      {children}
    </div>
  );
}
