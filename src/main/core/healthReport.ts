/**
 * Pure helpers for kiosk health reporting — no Electron, no I/O, so they are
 * unit-tested directly (tests/unit/main/healthReport.test.ts).
 *
 * The app keeps a small "run state" file while it runs and marks it clean on a
 * normal quit. A run whose file is still unclean at the next launch ended
 * abnormally; comparing its last heartbeat with the OS boot time tells an app
 * crash (the machine stayed up) from a power cut / forced reboot (it did not).
 */

export type CrashKind = 'ABNORMAL_EXIT' | 'RENDERER_GONE' | 'CHILD_GONE' | 'UNCAUGHT_EXCEPTION';
export type SuspectedCause = 'APP_CRASH' | 'SYSTEM_RESTART' | 'UNKNOWN';

/** Body of POST /api/kiosks/{kioskNum}/crash-reports. */
export interface CrashReport {
  kind: CrashKind;
  /** ISO-8601 with offset. */
  occurredAt: string;
  appVersion: string;
  channel: string;
  kioskCode: string;
  processType?: string;
  reason?: string;
  exitCode?: number;
  uptimeSec?: number;
  mainRssMb?: number;
  message?: string;
  stack?: string;
  suspectedCause?: SuspectedCause;
}

export interface RunState {
  pid: number;
  appVersion: string;
  channel: string;
  kioskCode: string;
  /** epoch ms */
  startedAt: number;
  /** epoch ms of the last heartbeat written while running */
  lastBeatAt: number;
  lastRssMb: number;
  cleanExit: boolean;
  lastError?: { message: string; stack?: string; at: number };
  /** Reports not yet accepted by the server (oldest first). */
  pending: CrashReport[];
}

export const MAX_MESSAGE = 1000;
export const MAX_STACK = 8000;
export const MAX_PENDING = 20;

/** Clip free text to what the server stores, so a giant stack never bloats the queue. */
export function clip(text: string | undefined, max: number): string | undefined {
  if (text === undefined) return undefined;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** ISO-8601 with the local offset, e.g. 2026-10-14T03:12:45+09:00. */
export function isoLocal(ms: number, offsetMinutes = -new Date(ms).getTimezoneOffset()): string {
  const local = new Date(ms + offsetMinutes * 60_000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/**
 * The report for a run that did not end cleanly, or null when it did (or there
 * was no previous run). `bootTimeMs` = now − os.uptime().
 */
export function classifyPreviousRun(prev: RunState | null, bootTimeMs: number): CrashReport | null {
  if (!prev || prev.cleanExit) return null;
  // The machine booted AFTER the last sign of life: power cut, forced reboot or the
  // scheduled `shutdown /f`. Otherwise the OS stayed up and only the app died.
  const suspectedCause: SuspectedCause =
    prev.lastBeatAt <= 0
      ? 'UNKNOWN'
      : prev.lastBeatAt < bootTimeMs
        ? 'SYSTEM_RESTART'
        : 'APP_CRASH';
  return {
    kind: 'ABNORMAL_EXIT',
    occurredAt: isoLocal(prev.lastBeatAt > 0 ? prev.lastBeatAt : prev.startedAt),
    appVersion: prev.appVersion,
    channel: prev.channel,
    kioskCode: prev.kioskCode,
    uptimeSec: Math.max(0, Math.round((prev.lastBeatAt - prev.startedAt) / 1000)),
    mainRssMb: prev.lastRssMb,
    message: clip(prev.lastError?.message, MAX_MESSAGE),
    stack: clip(prev.lastError?.stack, MAX_STACK),
    suspectedCause,
  };
}

/** Append to the queue, dropping the oldest when full — newest reports matter most. */
export function enqueue(pending: CrashReport[], report: CrashReport): CrashReport[] {
  const next = [...pending, report];
  return next.length > MAX_PENDING ? next.slice(next.length - MAX_PENDING) : next;
}

/**
 * Headers sent on the 5-minute update-command poll so the server records which
 * version runs where and how much memory the main process holds.
 */
export function signalHeaders(meta: {
  appVersion: string;
  channel: string;
  kioskCode: string;
  uptimeSec: number;
  mainRssMb: number;
}): Record<string, string> {
  return {
    'user-agent': `kiosk-app/${meta.appVersion} (${meta.kioskCode}; ${meta.channel})`,
    'x-kiosk-app-version': meta.appVersion.slice(0, 40),
    'x-kiosk-channel': meta.channel,
    'x-kiosk-code': meta.kioskCode.slice(0, 8),
    'x-kiosk-uptime-sec': String(Math.max(0, Math.round(meta.uptimeSec))),
    'x-kiosk-main-rss-mb': String(Math.max(0, Math.round(meta.mainRssMb))),
  };
}
