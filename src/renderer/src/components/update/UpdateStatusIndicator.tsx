import { useUpdateStatus } from '@renderer/hooks/useUpdateStatus';
import type { UpdateStatus } from '@shared/types/update';
import styles from './UpdateStatusIndicator.module.css';

/**
 * Tiny, non-blocking auto-update indicator (bottom-right corner).
 *
 * Renders NOTHING while idle / up-to-date / disabled, so a normal kiosk shows no
 * update chrome at all. It only appears while something is actually happening —
 * checking, downloading (with %), staged-and-restarting, or a transient failure.
 * `pointer-events: none` guarantees it never blocks a touch.
 *
 * All state comes from the main-process UpdateService over IPC; the component is
 * read-only and never triggers updates itself.
 */

const MB = 1024 * 1024;
function mb(bytes: number): string {
  return `${(bytes / MB).toFixed(1)} MB`;
}

interface View {
  dot: string;
  title: string;
  meta: string | null;
  percent: number | null;
}

function toView(status: UpdateStatus): View | null {
  switch (status.state) {
    case 'checking':
      return { dot: styles.active!, title: '업데이트 확인 중… / Checking for updates…', meta: null, percent: null };
    case 'available':
      return {
        dot: styles.active!,
        title: '새 버전 다운로드 중… / Downloading update…',
        meta: status.availableVersion ? `v${status.availableVersion}` : null,
        percent: 0,
      };
    case 'downloading': {
      const p = status.progress;
      return {
        dot: styles.active!,
        title: '새 버전 다운로드 중… / Downloading update…',
        meta: p ? `${mb(p.transferred)} / ${mb(p.total)}` : null,
        percent: p ? p.percent : null,
      };
    }
    case 'downloaded':
      return {
        dot: styles.ready!,
        title: '설치 준비 완료 — 곧 재시작 / Installing & restarting…',
        meta: status.availableVersion ? `v${status.availableVersion}` : null,
        percent: 100,
      };
    case 'error':
      // Non-fatal: the kiosk keeps running and retries later. Shown briefly.
      return {
        dot: styles.error!,
        title: '업데이트 실패 — 나중에 재시도 / Update failed, will retry',
        meta: null,
        percent: null,
      };
    // 'idle' and 'up-to-date' render nothing — no update chrome on a normal kiosk.
    default:
      return null;
  }
}

export function UpdateStatusIndicator(): JSX.Element | null {
  const status = useUpdateStatus();
  if (!status || !status.enabled) return null;

  const view = toView(status);
  if (!view) return null;

  return (
    <div className={styles.root} role="status" aria-live="polite">
      <div className={styles.row}>
        <span className={`${styles.dot} ${view.dot}`} />
        <span className={styles.title}>{view.title}</span>
      </div>
      {view.percent !== null && (
        <div className={styles.track}>
          <div className={styles.fill} style={{ width: `${view.percent}%` }} />
        </div>
      )}
      {view.meta && <div className={styles.meta}>{view.meta}</div>}
    </div>
  );
}
