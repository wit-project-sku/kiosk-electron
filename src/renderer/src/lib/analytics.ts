import type { CreateAnalyticsEvent, MenuTouchInput } from '@shared/types/data';

/**
 * Fire-and-forget analytics tracking from the renderer.
 *
 * Tracking never blocks the UI and never throws: the event is durably persisted
 * in SQLite by the main process the moment it arrives. If the IPC call itself
 * fails (extremely rare), we swallow the error rather than disrupt the user —
 * the analytics contract guarantees persistence on the main side.
 */
export function trackEvent(event: CreateAnalyticsEvent): void {
  void window.api.analytics.track(event).catch(() => {
    /* analytics must never break the UX */
  });
}

/**
 * Report a completed menu-touch session (a menu button tap that left home,
 * paired with the return to home) to the stats API. Fire-and-forget: the main
 * process resolves the numeric kioskId, POSTs it, and durably queues it for
 * retry if the network is down — so this never blocks or throws in the UI.
 */
export function recordMenuTouch(input: MenuTouchInput): void {
  void window.api.stats.recordMenuTouch(input).catch(() => {
    /* stats must never break the UX */
  });
}

/**
 * Local ISO-8601 timestamp with the machine's timezone offset, e.g.
 * "2026-06-01T13:53:26+09:00" — matches the stats API's expected format
 * (a Korea-deployed kiosk yields +09:00).
 */
export function localIso(date: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset(); // minutes east of UTC
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
