import { useKioskStore } from '@renderer/store/kioskStore';
import { useUpdateStatus } from '@renderer/hooks/useUpdateStatus';
import type { UpdateStatus } from '@shared/types/update';
import styles from './UpdateStatusIndicator.module.css';

/**
 * Auto-update indicator (bottom-right corner) — TEST BUILDS ONLY.
 *
 * Gated on DEV_MODE exactly like {@link KioskSwitcher}: CI sets `DEV_MODE=true`
 * on beta/develop_1 builds and `DEV_MODE=false` on production/main builds, so a
 * live kiosk shows NO update chrome at all while a test kiosk shows the full
 * progress. `import.meta.env.DEV` keeps it visible in a local dev run too.
 *
 * Renders nothing while idle / up-to-date / disabled, and `pointer-events: none`
 * guarantees it never blocks a touch.
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
      // NOTE: `downloaded` means STAGED, not restarting. The install waits for
      // the kiosk to be idle (never mid photo/payment) and can sit here for a
      // long time — so the label must not promise an imminent restart.
      return {
        dot: styles.ready!,
        title: '설치 대기 중 — 유휴 상태에서 재시작 / Staged, restarts when idle',
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
  const devMode = useKioskStore((s) => s.devMode);
  const status = useUpdateStatus();

  // Test builds only — a production kiosk never renders this.
  if (!devMode && !import.meta.env.DEV) return null;
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
