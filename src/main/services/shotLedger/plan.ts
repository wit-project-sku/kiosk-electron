/**
 * 촬영 장부 — the pure half. Every capture is written to a local ledger first
 * and sent from it, so a shot survives a dead network, a rejected request or an
 * app that quits mid-composite. No fs, no fetch, no clock in this file.
 */
import type { ArFailure, ShotType, ShotV2Data } from '@shared/types/data';

/**
 * - `open`     — the original is on disk, the composite has not finished.
 * - `pending`  — finished, not acknowledged yet; sent again every cycle.
 * - `rejected` — the server refused it; kept and tried again once a day.
 * - `sent`     — the server has it. Kept 30 days for reconciliation, then pruned.
 */
export type ShotState = 'open' | 'pending' | 'rejected' | 'sent';

export interface ShotRow {
  eventId: string;
  kioskId: number;
  /** ISO-8601 with offset, stamped when the capture was saved. */
  shotAt: string;
  /** null while the composite is still running. */
  isSuccess: boolean | null;
  shotType: ShotType | null;
  outfitCode: string;
  language: string | null;
  /** 배경 테마 number, when one was picked. */
  backgroundId: number | null;
  /** Why the AR composite failed (failed shots only). */
  arFailure: ArFailure | null;
  /** The kiosk took this shot itself (자동 촬영). */
  autoShot: boolean;
  /** The AR original — the 제주 measurement upload's photo part. */
  photoPath: string | null;
  /** The measurement `data` part as first built, so a re-send carries the same sizes. */
  v2Data: ShotV2Data | null;
  state: ShotState;
  /** The plain shot record reached the server (the count is safe) even if the measurement upload has not. */
  v1Sent: boolean;
  attempts: number;
  lastError: string | null;
  /** Epoch ms; the row is due once the clock passes it. */
  nextAttemptAt: number;
  createdAt: number;
  sentAt: number | null;
}

/** How one send ended. */
export type SendOutcome =
  | { kind: 'sent' }
  | { kind: 'retry'; message: string }
  | { kind: 'rejected'; message: string };

/** Gateway answers while the server restarts or is overloaded — the request itself is fine. */
const TRANSIENT_STATUSES = new Set([408, 429, 502, 503, 504]);

/**
 * What an HTTP status means for a shot report:
 * - 2xx, 409 (already stored) → sent
 * - 408/429/502/503/504 and any other 5xx except 500 → retry (hourly)
 * - 4xx and 500 → rejected (kept, daily) — it may be our own bug or a deploy
 *   that has not landed yet, so the shot is never dropped.
 */
export function classifyStatus(status: number): SendOutcome {
  if ((status >= 200 && status < 300) || status === 409) return { kind: 'sent' };
  const message = `HTTP ${status}`;
  if (TRANSIENT_STATUSES.has(status) || (status > 500 && status < 600)) {
    return { kind: 'retry', message };
  }
  return { kind: 'rejected', message };
}

export const HOUR_MS = 3_600_000;
/** A rejected shot is tried again once a day. */
export const REJECTED_RETRY_MS = 24 * HOUR_MS;
/** An `open` row this old lost its composite (the app quit); it is reported as a failed shot. */
export const STALE_OPEN_MS = 10 * 60_000;
/** Sent rows are kept this long. */
export const KEEP_SENT_MS = 30 * 24 * HOUR_MS;

/** Is this row due for a send at `now`? */
export function isDue(row: ShotRow, now: number): boolean {
  switch (row.state) {
    case 'sent':
      return false;
    case 'open':
      return now - row.createdAt >= STALE_OPEN_MS;
    case 'pending':
    case 'rejected':
      return row.nextAttemptAt <= now;
  }
}

/** The row after one delivery attempt. */
export function afterAttempt(row: ShotRow, outcome: SendOutcome, now: number): ShotRow {
  const attempts = row.attempts + 1;
  switch (outcome.kind) {
    case 'sent':
      return { ...row, state: 'sent', v1Sent: true, attempts, lastError: null, sentAt: now };
    case 'retry':
      return { ...row, state: 'pending', attempts, lastError: outcome.message, nextAttemptAt: now };
    case 'rejected':
      return {
        ...row,
        state: 'rejected',
        attempts,
        lastError: outcome.message,
        nextAttemptAt: now + REJECTED_RETRY_MS,
      };
  }
}

/** `2026-11-11 14:30:12` in the machine's local time — the text ledger's timestamp. */
export function localStamp(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** One human-readable line for shot-ledger.txt. */
export function textLine(now: number, event: string, row: ShotRow, detail = ''): string {
  const result = row.isSuccess === null ? '합성 중' : row.isSuccess ? '합성 성공' : '합성 실패';
  const parts = [
    localStamp(now),
    event,
    row.eventId,
    `kiosk ${row.kioskId}`,
    `의상 ${row.outfitCode || '-'}`,
    row.shotType ?? '-',
    row.language ?? '-',
    result,
  ];
  if (row.backgroundId !== null) parts.push(`배경 ${row.backgroundId}`);
  if (row.autoShot) parts.push('자동 촬영');
  if (row.arFailure && row.isSuccess === false) {
    const { kind, status, message } = row.arFailure;
    parts.push(
      `AR ${kind}${status !== null ? ` ${status}` : ''}${message ? `: ${message.slice(0, 120)}` : ''}`,
    );
  }
  if (detail) parts.push(detail);
  // One event, one line: a server error body may carry line breaks.
  return parts.join(' | ').replace(/\s+/g, ' ');
}

/** Lines of the text ledger that are still inside the keep window. */
export function keepRecentLines(lines: readonly string[], now: number, keepMs: number): string[] {
  const floor = localStamp(now - keepMs);
  return lines.filter((line) => line.length >= 19 && line.slice(0, 19) >= floor);
}
