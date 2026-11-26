/**
 * 사진 보관(구글 드라이브) — the pure half of PhotoArchiveService.
 *
 * Everything here is a function of its arguments: which files in the photo
 * folder are originals, which original has a composite, which ones still need
 * sending and in what order, and what a server answer means. No fs, no fetch,
 * no clock — the service feeds those in, so all of it is unit-testable.
 */

/** An original capture, e.g. `Captured_20261103_2896.jpg` (the server checks the same pattern). */
export const ORIGINAL_NAME = /^Captured_\d{8}_\d+\.(jpg|jpeg|png)$/;
/** The AI composite CaptureService.saveGenerated writes next to it: `<stem>_Ai.jpg`. */
const RESULT_NAME = /^(Captured_\d{8}_\d+)_Ai\.(jpg|jpeg|png)$/;

/**
 * Per-file state kept in SQLite.
 * - `pending`  — tried, not acknowledged yet (5xx, network, `stored:false`); retried.
 * - `sent`     — the server stored it. `withResult` says whether the composite went too.
 * - `given_up` — 400-class answer; resending the same bytes cannot succeed.
 */
export type ArchiveState = 'pending' | 'sent' | 'given_up';

export interface ArchiveRecord {
  fileName: string;
  state: ArchiveState;
  withResult: boolean;
  attempts: number;
}

/** From `since` on, this PC was kiosk `kioskId` to the server. */
export interface IdentitySpan {
  kioskId: number;
  since: number;
}

const IDENTITY_HISTORY_LIMIT = 20;

/** The history with this launch's identity added; unchanged while the PC stays the same kiosk. */
export function withIdentity(
  history: readonly IdentitySpan[],
  kioskId: number,
  now: number,
): IdentitySpan[] {
  if (history[history.length - 1]?.kioskId === kioskId) return [...history];
  return [...history, { kioskId, since: now }].slice(-IDENTITY_HISTORY_LIMIT);
}

/**
 * Which kiosk this PC was when a photo was taken. The server files a photo under
 * the id it is sent with, and it may be sent long after the shot (the PC was off,
 * or staff set it to another kiosk meanwhile), so the id at SEND time would put it
 * in another kiosk's folder. A photo older than the whole history belongs to the
 * earliest id known.
 */
export function identityAt(
  history: readonly IdentitySpan[],
  capturedAt: number,
  fallback: number,
): number {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.since <= capturedAt) return history[i]!.kioskId;
  }
  return history[0]?.kioskId ?? fallback;
}

/** What one readdir of the photo folder says, before any stat. */
export interface FolderListing {
  /** Original file names, in no particular order. */
  originals: string[];
  /** Original stem (`Captured_20261103_2896`) → composite file name. */
  results: Map<string, string>;
}

export function stemOf(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

/** Split a directory listing into originals and composites. Anything else is ignored. */
export function listFolder(names: readonly string[]): FolderListing {
  const originals: string[] = [];
  const results = new Map<string, string>();
  for (const name of names) {
    if (ORIGINAL_NAME.test(name)) {
      originals.push(name);
      continue;
    }
    const match = RESULT_NAME.exec(name);
    if (match) results.set(match[1]!, name);
  }
  return { originals, results };
}

/**
 * Does this original still need a send? Decided from the listing and the record
 * alone, so files already done are skipped without touching the disk again.
 * - no record / pending → yes
 * - sent without composite, and a composite has appeared since → yes (send again with it)
 * - sent with composite, or given up → no
 */
export function needsSend(record: ArchiveRecord | undefined, hasResult: boolean): boolean {
  if (!record) return true;
  switch (record.state) {
    case 'pending':
      return true;
    case 'sent':
      return !record.withResult && hasResult;
    case 'given_up':
      return false;
  }
}

/** An original that passed `needsSend`, with the stat results the service read. */
export interface StatEntry {
  fileName: string;
  mtimeMs: number;
  /** Composite file name and mtime, when one exists. */
  result: { fileName: string; mtimeMs: number } | null;
  attempts: number;
}

export interface Candidate {
  fileName: string;
  resultFileName: string | null;
  mtimeMs: number;
  attempts: number;
}

export interface SelectOptions {
  now: number;
  /**
   * When the server first said "enabled" to this kiosk. Only originals modified
   * at or after it are sent — older photos are uploaded by hand, never by the app.
   */
  enabledSince: number;
  /** An original must be at least this old — time for the composite to be written. */
  minAgeMs: number;
  /** A composite must be at least this old, so a file still being written is never read. */
  resultMinAgeMs: number;
  /** Pairs per cycle — normally a handful; bounds the catch-up after an outage. */
  limit: number;
  /** Files that failed this many times go behind everything else, so one bad file cannot block the queue. */
  demoteAfterAttempts: number;
}

/**
 * Cheap pre-filter before any stat: the `YYYYMMDD` in the name is the local
 * (KST) capture date, so a name dated before the day `enabledSince` falls on
 * cannot be new. One day of slack covers a machine clock a little off KST.
 */
export function mayBeSinceEnabled(fileName: string, enabledSince: number): boolean {
  const date = /^Captured_(\d{8})_/.exec(fileName)?.[1];
  if (!date) return false;
  const floor = kstIso(enabledSince - 24 * 3_600_000)
    .slice(0, 10)
    .replace(/-/g, '');
  return date >= floor;
}

/**
 * This cycle's work, in send order: newest first, repeatedly failing files last,
 * at most `limit` pairs. Anything modified before `enabledSince` is never chosen.
 */
export function selectCandidates(entries: readonly StatEntry[], opts: SelectOptions): Candidate[] {
  const ready: Candidate[] = [];
  for (const entry of entries) {
    if (entry.mtimeMs < opts.enabledSince) continue;
    if (opts.now - entry.mtimeMs < opts.minAgeMs) continue;
    // A composite that is still being written: wait for the next cycle rather
    // than send the original alone and then send it all again.
    if (entry.result && opts.now - entry.result.mtimeMs < opts.resultMinAgeMs) continue;
    ready.push({
      fileName: entry.fileName,
      resultFileName: entry.result?.fileName ?? null,
      mtimeMs: entry.mtimeMs,
      attempts: entry.attempts,
    });
  }

  const demoted = (c: Candidate): number => (c.attempts >= opts.demoteAfterAttempts ? 1 : 0);
  ready.sort(
    (a, b) =>
      demoted(a) - demoted(b) ||
      b.mtimeMs - a.mtimeMs ||
      (a.fileName < b.fileName ? 1 : a.fileName > b.fileName ? -1 : 0),
  );
  return ready.slice(0, Math.max(0, opts.limit));
}

/**
 * How one POST to /api/kiosk/photos/upload ended, per the server contract:
 * - `stored`     200 stored:true (also an idempotent repeat) → mark sent
 * - `discarded`  200 stored:false (archive off / excluded kiosk) → leave unmarked, stop the cycle
 * - `rejected`   400-class (bad name, not an image, too large) → give up on that file
 * - `retry`      5xx, network, anything unexpected → try again next cycle, stop this one
 */
export type SendOutcome =
  | { kind: 'stored' }
  | { kind: 'discarded' }
  | { kind: 'rejected'; status: number }
  | { kind: 'retry'; reason: string };

/** Statuses that say "these bytes will never be accepted". 404 is NOT one: it means an older server. */
const REJECT_STATUSES = new Set([400, 413, 415, 422]);

function dataOf(json: unknown): Record<string, unknown> {
  const root =
    json && typeof json === 'object' && 'data' in json ? (json as { data: unknown }).data : json;
  return root && typeof root === 'object' ? (root as Record<string, unknown>) : {};
}

export function classifySendResponse(status: number, json: unknown): SendOutcome {
  if (status >= 200 && status < 300) {
    const stored = dataOf(json)['stored'];
    if (stored === true) return { kind: 'stored' };
    if (stored === false) return { kind: 'discarded' };
    return { kind: 'retry', reason: `HTTP ${status} without a stored flag` };
  }
  if (REJECT_STATUSES.has(status)) return { kind: 'rejected', status };
  return { kind: 'retry', reason: `HTTP ${status}` };
}

/** `enabled` from the status endpoint. Anything but an explicit `true` means "do not send". */
export function parseStatusEnabled(json: unknown): boolean {
  return dataOf(json)['enabled'] === true;
}

/** KST wall-clock time without an offset, to the second: `2026-11-03T14:30:12`. */
export function kstIso(ms: number): string {
  const d = new Date(ms + 9 * 3_600_000);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

export function mimeOf(fileName: string): string {
  return /\.png$/i.test(fileName) ? 'image/png' : 'image/jpeg';
}
