import { readFile } from 'node:fs/promises';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { witteriaApiBase } from '@main/core/apiBase';
import { createLogger } from '@main/core/logger';
import { isStageApiBase } from '@shared/config/testRig';
import {
  classifySendResponse,
  identityAt,
  kstIso,
  listFolder,
  mayBeSinceEnabled,
  mimeOf,
  needsSend,
  parseStatusEnabled,
  selectCandidates,
  stemOf,
  withIdentity,
  type ArchiveRecord,
  type Candidate,
  type IdentitySpan,
  type SendOutcome,
  type StatEntry,
} from './plan';

const log = createLogger('photo-archive');

/** How soon photos move. Scan intervals run from the end of one cycle to the start of the next. */
export interface ArchiveCadence {
  /** First cycle after launch — boot, render and network come first. */
  startupDelayMs: number;
  /** Hourly in production: the archive is not real-time, and each cycle sends one hour's shots. */
  cycleIntervalMs: number;
  /** Originals younger than this may still be waiting for their composite. */
  minAgeMs: number;
  /** A composite younger than this may still be being written. */
  resultMinAgeMs: number;
}

const PRODUCTION_CADENCE: ArchiveCadence = {
  startupDelayMs: 2 * 60_000,
  cycleIntervalMs: 60 * 60_000,
  minAgeMs: 10 * 60_000,
  resultMinAgeMs: 60_000,
};

/**
 * TEMPORARY (2026-11-06, stage testing): a build talking to a STAGE server scans
 * every minute so a test shot reaches Drive while staff are still watching. An
 * original can go ahead of a slow composite; the composite then follows on its own.
 * Remove once Drive archiving is signed off on stage.
 */
const STAGE_CADENCE: ArchiveCadence = {
  startupDelayMs: 60_000,
  cycleIntervalMs: 60_000,
  minAgeMs: 60_000,
  resultMinAgeMs: 30_000,
};

/** The cadence for the servers this build talks to. */
export function cadenceFor(apiBase: string): ArchiveCadence {
  return isStageApiBase(apiBase) ? STAGE_CADENCE : PRODUCTION_CADENCE;
}

/** Pairs per cycle — a busy hour fits; bounds the catch-up after an outage. */
const CYCLE_LIMIT = 120;
/** After this many failed tries a file goes to the back of the queue. */
const DEMOTE_AFTER_ATTEMPTS = 3;
/** How long a status answer is trusted. */
const STATUS_TTL_MS = 30 * 60_000;
const STATUS_TIMEOUT_MS = 15_000;
/** One pair can be ~10 MB; give a slow venue line room. */
const UPLOAD_TIMEOUT_MS = 180_000;

/** Persistence the service needs — PhotoArchiveRepository in the app, a Map in tests. */
export interface PhotoArchiveStore {
  /** When the server first said "enabled", or null if it never has. */
  enabledSince(): number | null;
  /** Record `now` as that moment if nothing is stored yet; returns the stored value. */
  markEnabledSince(now: number): number;
  records(): Map<string, ArchiveRecord>;
  markSent(fileName: string, withResult: boolean): void;
  markGivenUp(fileName: string, status: number, error: string): void;
  markFailed(fileName: string, status: number | null, error: string): void;
  /** Which kiosk this PC has been, oldest first. */
  identityHistory(): IdentitySpan[];
  saveIdentityHistory(history: IdentitySpan[]): void;
}

export interface PhotoArchiveDeps {
  store: PhotoArchiveStore;
  kioskNum: () => number;
  /** The photo folder (appPaths.generated). A function so a PHOTO_SAVE_DIR change is honoured. */
  photoDir: () => string;
  fetch?: typeof fetch;
  now?: () => number;
}

export interface CycleSummary {
  enabled: boolean;
  stored: number;
  givenUp: number;
  stoppedBy: 'done' | 'disabled' | 'discarded' | 'retry' | 'busy' | 'stopped';
}

/**
 * 사진 보관 — copies each new capture in the photo folder (original + AI
 * composite) to the server, which files it into Google Drive
 * (POST /api/kiosk/photos/upload, GET /api/kiosk/photos/upload/status).
 *
 * Each photo goes under the kiosk id the PC had when it was taken (identityAt).
 *
 * Only photos taken AFTER the server first enabled this kiosk are sent; the
 * moment is persisted as `enabled_since`. Older photos are uploaded by hand and
 * are never touched here — not sent, not recorded.
 *
 * It only WATCHES the folder CaptureService writes to; it never hooks the
 * capture flow, so a failure here cannot reach a customer's session.
 *
 * Memory: one pair in flight at a time (~5 MB), read into memory and released
 * after the request. Not fs.openAsBlob: on Windows its handle outlives the send,
 * which keeps the photo locked (a staff member moving the folder would fail).
 */
export class PhotoArchiveService {
  private readonly store: PhotoArchiveStore;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private started = false;
  /** Set by stop() so a cycle in progress ends after the current pair. */
  private stopped = false;
  private statusCache: { enabled: boolean; at: number } | null = null;
  private busyCheck: () => boolean = () => false;

  constructor(private readonly deps: PhotoArchiveDeps) {
    this.store = deps.store;
    this.fetchImpl = deps.fetch ?? fetch;
    this.now = deps.now ?? Date.now;
  }

  /** While this returns true (a customer is mid-capture), nothing is uploaded. */
  setBusyCheck(check: () => boolean): void {
    this.busyCheck = check;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.stopped = false;
    this.noteIdentity();
    const cadence = cadenceFor(witteriaApiBase());
    this.schedule(cadence.startupDelayMs);
    log.info('Photo archive started', { kioskId: this.deps.kioskNum(), ...cadence });
  }

  stop(): void {
    this.started = false;
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runCycle()
        .catch((error: unknown) => log.warn('Photo archive cycle failed', errorMessage(error)))
        .finally(() => this.schedule(cadenceFor(witteriaApiBase()).cycleIntervalMs));
    }, delayMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  /** Remember when this PC became the kiosk it is now, so older photos keep their own id. */
  private noteIdentity(): IdentitySpan[] {
    const stored = this.store.identityHistory();
    const kioskId = this.deps.kioskNum();
    if (stored.at(-1)?.kioskId === kioskId) return stored;
    const history = withIdentity(stored, kioskId, this.now());
    this.store.saveIdentityHistory(history);
    return history;
  }

  private statusUrl(): string {
    return (
      process.env['PHOTO_ARCHIVE_STATUS_URL']?.trim() ||
      `${witteriaApiBase()}/api/kiosk/photos/upload/status`
    );
  }

  private uploadUrl(): string {
    return (
      process.env['PHOTO_ARCHIVE_URL']?.trim() || `${witteriaApiBase()}/api/kiosk/photos/upload`
    );
  }

  /** One scan-and-send pass. Public for tests; the timer is the only caller in the app. */
  async runCycle(): Promise<CycleSummary> {
    const summary: CycleSummary = { enabled: false, stored: 0, givenUp: 0, stoppedBy: 'done' };
    if (this.running) return { ...summary, stoppedBy: 'busy' };
    this.running = true;
    try {
      const kioskId = this.deps.kioskNum();
      summary.enabled = await this.isEnabled(kioskId);
      if (!summary.enabled) return { ...summary, stoppedBy: 'disabled' };

      const since = this.store.markEnabledSince(this.now());
      const history = this.noteIdentity();
      const candidates = await this.plan(since);
      for (const candidate of candidates) {
        if (this.stopped) return { ...summary, stoppedBy: 'stopped' };
        if (this.busyCheck()) return { ...summary, stoppedBy: 'busy' };

        const shotAs = identityAt(history, candidate.mtimeMs, kioskId);
        const outcome = await this.send(shotAs, candidate);
        switch (outcome.kind) {
          case 'stored':
            this.store.markSent(candidate.fileName, candidate.resultFileName !== null);
            summary.stored += 1;
            break;
          case 'rejected':
            this.store.markGivenUp(candidate.fileName, outcome.status, `HTTP ${outcome.status}`);
            summary.givenUp += 1;
            log.warn('Photo archive rejected a file; giving up on it', {
              fileName: candidate.fileName,
              status: outcome.status,
            });
            break;
          case 'discarded':
            // A photo from an earlier id the server does not archive (the test
            // kiosk, set to a venue since) must not hold up this kiosk's own.
            if (shotAs !== kioskId) {
              this.store.markGivenUp(candidate.fileName, 200, `kiosk ${shotAs} is not archived`);
              summary.givenUp += 1;
              break;
            }
            // The server has archiving off for us right now. Leave the file
            // unmarked and re-ask for status next cycle instead of in 30 min.
            this.statusCache = null;
            log.info('Photo archive discarded by the server; pausing', {
              fileName: candidate.fileName,
            });
            return { ...summary, stoppedBy: 'discarded' };
          case 'retry':
            this.store.markFailed(candidate.fileName, null, outcome.reason);
            log.warn('Photo archive send failed; retrying next cycle', {
              fileName: candidate.fileName,
              reason: outcome.reason,
            });
            return { ...summary, stoppedBy: 'retry' };
        }
      }
      return summary;
    } finally {
      this.running = false;
      if (summary.stored > 0 || summary.givenUp > 0) {
        log.info('Photo archive cycle', {
          stored: summary.stored,
          givenUp: summary.givenUp,
          stoppedBy: summary.stoppedBy,
        });
      }
    }
  }

  /** Status with a 30-minute cache. A failed check is not cached and means "not now". */
  private async isEnabled(kioskId: number): Promise<boolean> {
    const at = this.now();
    if (this.statusCache && at - this.statusCache.at < STATUS_TTL_MS) {
      return this.statusCache.enabled;
    }
    try {
      const url = `${this.statusUrl()}?kioskId=${encodeURIComponent(String(kioskId))}`;
      const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(STATUS_TIMEOUT_MS) });
      if (!res.ok) {
        log.debug('Photo archive status unavailable', { status: res.status });
        return false;
      }
      const enabled = parseStatusEnabled(await res.json());
      this.statusCache = { enabled, at };
      log.info('Photo archive status', { kioskId, enabled });
      return enabled;
    } catch (error) {
      log.debug('Photo archive status check failed', errorMessage(error));
      return false;
    }
  }

  /**
   * readdir once; stat only originals that are dated on/after `since` and still
   * need sending; then order them. Old photos never get past the name check.
   */
  private async plan(since: number): Promise<Candidate[]> {
    const dir = this.deps.photoDir();
    let names: string[];
    try {
      names = await readdir(dir);
    } catch (error) {
      log.warn('Photo archive cannot read the photo folder', errorMessage(error));
      return [];
    }

    const { originals, results } = listFolder(names);
    const records = this.store.records();
    const entries: StatEntry[] = [];
    for (const fileName of originals) {
      if (!mayBeSinceEnabled(fileName, since)) continue;
      const record = records.get(fileName);
      const resultName = results.get(stemOf(fileName)) ?? null;
      if (!needsSend(record, resultName !== null)) continue;
      try {
        const original = await stat(join(dir, fileName));
        const result = resultName ? await stat(join(dir, resultName)).catch(() => null) : null;
        entries.push({
          fileName,
          mtimeMs: original.mtimeMs,
          result: resultName && result ? { fileName: resultName, mtimeMs: result.mtimeMs } : null,
          attempts: record?.attempts ?? 0,
        });
      } catch {
        // Vanished between readdir and stat — nothing to send.
      }
    }

    const { minAgeMs, resultMinAgeMs } = cadenceFor(witteriaApiBase());
    return selectCandidates(entries, {
      now: this.now(),
      enabledSince: since,
      minAgeMs,
      resultMinAgeMs,
      limit: CYCLE_LIMIT,
      demoteAfterAttempts: DEMOTE_AFTER_ATTEMPTS,
    });
  }

  /** POST one pair. Never throws: every way it can end is a SendOutcome. */
  private async send(kioskId: number, candidate: Candidate): Promise<SendOutcome> {
    const dir = this.deps.photoDir();
    const form = new FormData();
    const data = {
      kioskId,
      fileName: candidate.fileName,
      capturedAt: kstIso(candidate.mtimeMs),
      source: 'LIVE',
    };
    form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    try {
      form.append(
        'original',
        new Blob([await readFile(join(dir, candidate.fileName))], {
          type: mimeOf(candidate.fileName),
        }),
        candidate.fileName,
      );
      if (candidate.resultFileName) {
        form.append(
          'result',
          new Blob([await readFile(join(dir, candidate.resultFileName))], {
            type: mimeOf(candidate.resultFileName),
          }),
          candidate.resultFileName,
        );
      }
    } catch (error) {
      return { kind: 'retry', reason: `read failed: ${errorMessage(error)}` };
    }

    try {
      const res = await this.fetchImpl(this.uploadUrl(), {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      });
      const json: unknown = await res.json().catch(() => null);
      return classifySendResponse(res.status, json);
    } catch (error) {
      return { kind: 'retry', reason: errorMessage(error) };
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
