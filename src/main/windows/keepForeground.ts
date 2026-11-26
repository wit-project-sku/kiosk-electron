import { BrowserWindow, powerMonitor, screen } from 'electron';
import { createLogger } from '@main/core/logger';

const log = createLogger('kiosk-foreground');

/** How long another app may hold focus before the kiosk takes it back. */
const RECLAIM_DELAY_MS = 1500;
/** Re-assert topmost this often, for the cases that drop it without a blur. */
const REASSERT_INTERVAL_MS = 60_000;

/**
 * Keep the touch window above every other app on a production kiosk.
 *
 * `alwaysOnTop` in the BrowserWindow options is not enough on Windows: it is
 * set once, at the default ('floating') level, and Windows can drop a window's
 * topmost flag after a monitor sleeps/wakes, a display change, a resume, or
 * Explorer restarting. After that, any window that comes up — Chrome on
 * 인사동 쉼터, 2026-11-24/25 — draws over the kiosk and stays there.
 *
 * So: topmost at the 'screen-saver' level, re-applied on every event that can
 * drop it and once a minute; and when focus goes to ANOTHER app (not one of
 * ours — the 지점 설정 window and dialogs are ours, and owned by this window
 * so they stay above it), take it back after a short grace.
 */
export function keepKioskForeground(window: BrowserWindow): void {
  let reclaimTimer: NodeJS.Timeout | null = null;

  const assertTopmost = (): void => {
    if (window.isDestroyed()) return;
    // Off then on: Windows ignores a "set topmost" on a window it still
    // believes is topmost, even when it has in fact lost that place.
    window.setAlwaysOnTop(false);
    window.setAlwaysOnTop(true, 'screen-saver');
    window.moveTop();
  };

  const reclaim = (reason: string): void => {
    if (window.isDestroyed()) return;
    // Focus is on one of our own windows (setup, display, a dialog): leave it.
    if (BrowserWindow.getFocusedWindow() != null) return;
    log.warn('Another app held focus over the kiosk; taking it back', { reason });
    if (window.isMinimized()) window.restore();
    if (!window.isVisible()) window.show();
    assertTopmost();
    window.focus();
  };

  const onBlur = (): void => {
    if (reclaimTimer) clearTimeout(reclaimTimer);
    reclaimTimer = setTimeout(() => {
      reclaimTimer = null;
      reclaim('blur');
    }, RECLAIM_DELAY_MS);
  };

  const onFocus = (): void => {
    if (reclaimTimer) clearTimeout(reclaimTimer);
    reclaimTimer = null;
  };

  const onSystemChange = (): void => {
    assertTopmost();
    reclaim('system');
  };

  window.once('ready-to-show', assertTopmost);
  window.on('blur', onBlur);
  window.on('focus', onFocus);
  window.on('minimize', onBlur);
  window.on('hide', onBlur);

  screen.on('display-added', onSystemChange);
  screen.on('display-removed', onSystemChange);
  screen.on('display-metrics-changed', onSystemChange);
  powerMonitor.on('resume', onSystemChange);
  powerMonitor.on('unlock-screen', onSystemChange);

  const interval = setInterval(() => {
    assertTopmost();
    reclaim('interval');
  }, REASSERT_INTERVAL_MS);

  window.once('closed', () => {
    if (reclaimTimer) clearTimeout(reclaimTimer);
    clearInterval(interval);
    screen.removeListener('display-added', onSystemChange);
    screen.removeListener('display-removed', onSystemChange);
    screen.removeListener('display-metrics-changed', onSystemChange);
    powerMonitor.removeListener('resume', onSystemChange);
    powerMonitor.removeListener('unlock-screen', onSystemChange);
  });
}
