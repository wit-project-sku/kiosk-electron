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
 * How long a reboot may take between the app's last heartbeat (written every minute)
 * and the OS coming back. A longer silence before the boot means the app was already
 * gone well before the machine went down — nothing restarts it after a crash until the
 * nightly reboot — or the machine was switched off for a while: ambiguous.
 */
export const RESTART_GAP_MS = 10 * 60_000;

/**
 * The report for a run that did not end cleanly, or null when it did (or there
 * was no previous run). `bootTimeMs` = now − os.uptime().
 */
export function classifyPreviousRun(prev: RunState | null, bootTimeMs: number): CrashReport | null {
  if (!prev || prev.cleanExit) return null;
  let suspectedCause: SuspectedCause;
  let reason: string | undefined;
  if (prev.lastBeatAt <= 0) {
    suspectedCause = 'UNKNOWN';
  } else if (prev.lastBeatAt >= bootTimeMs) {
    // The OS stayed up after the last sign of life: only the app died.
    suspectedCause = 'APP_CRASH';
  } else {
    // Heartbeat stopped right before the boot: power cut / forced reboot / shutdown /f.
    // Stopped long before it: the app died earlier, or the machine was off — ambiguous.
    const gap = bootTimeMs - prev.lastBeatAt;
    suspectedCause = gap <= RESTART_GAP_MS ? 'SYSTEM_RESTART' : 'UNKNOWN';
    reason = `boot ${Math.round(gap / 60_000)} min after last heartbeat`;
  }
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
    reason,
  };
}

/** Shape check for a run-state file read from disk — a damaged file must never stop startup. */
export function isRunState(v: unknown): v is RunState {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r['startedAt'] === 'number' &&
    typeof r['lastBeatAt'] === 'number' &&
    typeof r['cleanExit'] === 'boolean' &&
    typeof r['appVersion'] === 'string' &&
    typeof r['channel'] === 'string' &&
    typeof r['kioskCode'] === 'string' &&
    Array.isArray(r['pending'])
  );
}

/** Append to the queue, dropping the oldest when full — newest reports matter most. */
export function enqueue(pending: CrashReport[], report: CrashReport): CrashReport[] {
  const next = [...pending, report];
  return next.length > MAX_PENDING ? next.slice(next.length - MAX_PENDING) : next;
}

/** Header values must be printable ASCII, or fetch throws — and the poll would fail with it. */
export function asciiHeader(value: string, max: number): string {
  return value.replace(/[^\x20-\x7e]/g, '?').slice(0, max);
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
  const version = asciiHeader(meta.appVersion, 40);
  const code = asciiHeader(meta.kioskCode, 8);
  const channel = asciiHeader(meta.channel, 10);
  return {
    'user-agent': `kiosk-app/${version} (${code}; ${channel})`,
    'x-kiosk-app-version': version,
    'x-kiosk-channel': channel,
    'x-kiosk-code': code,
    'x-kiosk-uptime-sec': String(Math.max(0, Math.round(meta.uptimeSec))),
    'x-kiosk-main-rss-mb': String(Math.max(0, Math.round(meta.mainRssMb))),
  };
}
