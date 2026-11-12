import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import type {
  MenuTouchBody,
  MenuTouchInput,
  MenuTouchSyncItem,
  PhotoShotSyncItem,
  ShotBody,
  ShotInput,
  ShotV2Data,
} from '@shared/types/data';
import { isJejuLayout } from '@shared/config/kioskLocations';
import { createLogger } from '@main/core/logger';
import type { ShotMeasurement } from './height/HeightService';
import type { KioskService } from './KioskService';
import type { FailedRequestService } from './FailedRequestService';
import { MemoryShotLedger, type ShotLedger } from './shotLedger/ShotLedger';
import {
  afterAttempt,
  classifyStatus,
  HOUR_MS,
  KEEP_SENT_MS,
  textLine,
  type SendOutcome,
  type ShotRow,
} from './shotLedger/plan';

const log = createLogger('stats-service');

/** Production Witteria API base. Override with WITTERIA_API_BASE in .env.
 *  Resolved at call time so the value reflects the loaded env, not import order. */
const DEFAULT_API_BASE = 'https://api-v3.witteria.com';
function witteriaApiBase(): string {
  return (process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE).replace(/\/+$/, '');
}

/** Failed-request queue types re-sent via the nightly batch endpoints. */
export const MENU_TOUCH_REQUEST_TYPE = 'menu_touch';
export const PHOTO_SHOT_REQUEST_TYPE = 'photo_shot';
/** `/shots/v2` multipart sends (data + photo path), re-sent one by one at night. */
export const PHOTO_SHOT_V2_REQUEST_TYPE = 'photo_shot_v2';

/** Queued `/shots/v2` send. `outfitId` is kept for the v1 batch fallback. */
interface ShotV2Pending {
  data: ShotV2Data;
  photoPath: string;
  outfitId: number | null;
}

/**
 * How a measurement upload ended: a SendOutcome (see classifyStatus), or
 * `no-photo` when the original is gone from disk — that upload can never happen.
 */
type ShotV2Outcome = SendOutcome | { kind: 'no-photo'; message: string };

/** A shot report is a few hundred bytes; the measurement upload carries the original (~0.2 MB). */
const SHOT_TIMEOUT_MS = 15_000;
const SHOT_V2_TIMEOUT_MS = 60_000;
/** First re-send after launch, then hourly — venues keep different hours, so no fixed clock time. */
const SYNC_STARTUP_DELAY_MS = 60_000;
const SYNC_INTERVAL_MS = HOUR_MS;
/** Ledger rows per cycle; bounds the catch-up after a long outage. */
const LEDGER_CYCLE_LIMIT = 500;
/** This many transient failures in a row means the line is down — stop the cycle. */
const TRANSIENT_STOP_AFTER = 3;

export interface StatsServiceOptions {
  /**
   * 촬영 장부. Without one (unit tests, or the ledger file could not be opened)
   * rows live in memory only, so an unsent shot is also put in the old
   * failed-request queue — it must survive a restart.
   */
  ledger?: ShotLedger;
  now?: () => number;
}

type MeasurementSource = () => Promise<ShotMeasurement | null>;

/** Nightly `/shots/v2` re-sends per run; each is a full photo upload. */
const SHOT_V2_RETRY_LIMIT = 200;

const PHOTO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const SIZE_FIELDS = ['heightCm', 'shoulderWidthCm', 'chestWidthCm', 'waistWidthCm', 'hipWidthCm'] as const;

/**
 * Every size the ZED did not measure goes out as 0, never null or absent — the
 * backend asked for 0 (2026-10-28). Applied at send time too, so shots queued
 * for the nightly re-send before that (stored with nulls) go out the same way.
 */
function withZeroSizes(data: ShotV2Data): ShotV2Data {
  const out = { ...data };
  for (const field of SIZE_FIELDS) out[field] = out[field] ?? 0;
  return out;
}

/**
 * The v2 `data` part: the v1 body plus the ZED measurement. Every size field is
 * always present, 0 when not measured (see withZeroSizes). measuredAt/
 * confidence/version are null when no size was measured — the sidecar's
 * confidence 0 on an empty result is not a real score.
 */
function shotV2Data(body: ShotBody, measurement: ShotMeasurement | null): ShotV2Data {
  const measured =
    measurement !== null && SIZE_FIELDS.some((field) => measurement[field] !== null);
  return {
    ...body,
    channel: 'KIOSK',
    measuredAt: measured ? measurement.measuredAt : null,
    heightCm: measurement?.heightCm ?? 0,
    shoulderWidthCm: measurement?.shoulderWidthCm ?? 0,
    chestWidthCm: measurement?.chestWidthCm ?? 0,
    waistWidthCm: measurement?.waistWidthCm ?? 0,
    hipWidthCm: measurement?.hipWidthCm ?? 0,
    confidence: measured ? measurement.confidence : null,
    version: measured ? measurement.version : null,
  };
}

/**
 * The plain shot record of a ledger row. A composite that never finished counts as failed.
 * The 배경 and AR failure fields are added only when there is a value — older
 * rows and plain shots send exactly the body they always did.
 */
function bodyOf(row: ShotRow): ShotBody {
  const isSuccess = row.isSuccess ?? false;
  const body: ShotBody = {
    kioskId: row.kioskId,
    shotAt: row.shotAt,
    isSuccess,
    shotType: row.shotType,
    outfitCode: row.outfitCode,
    eventId: row.eventId,
    language: row.language,
  };
  if (row.backgroundId !== null) body.backgroundId = row.backgroundId;
  if (!isSuccess && row.arFailure) {
    body.arErrorKind = row.arFailure.kind;
    if (row.arFailure.status !== null) body.arErrorStatus = row.arFailure.status;
    if (row.arFailure.message) body.arErrorMessage = row.arFailure.message;
  }
  return body;
}

/** Server caps each sync batch at 1000 items (over → 400). */
const SYNC_BATCH_LIMIT = 1000;
/** Safety bound on how many 1000-item batches one nightly run will push. */
const MAX_BATCH_PASSES = 20;

/** Local ISO-8601 with the machine's tz offset, e.g. "2026-06-01T13:53:26+09:00". */
function localIso(date: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** Pull eventId strings out of a response array of strings or `{ eventId }` objects. */
function eventIdsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object' && 'eventId' in entry) {
        return String((entry as { eventId: unknown }).eventId);
      }
      return '';
    })
    .filter(Boolean);
}

/**
 * Event ids the server has durably stored — `accepted` (newly saved) plus
 * `duplicated` (already present). Both count as SENT; only `failed` is retried.
 * Tolerant of either a top-level body or a `{ data: … }` envelope.
 */
function sentEventIds(json: unknown): Set<string> {
  const root =
    json && typeof json === 'object' && 'data' in json
      ? (json as { data: unknown }).data
      : json;
  const obj = (root ?? {}) as Record<string, unknown>;
  return new Set([...eventIdsFrom(obj['accepted']), ...eventIdsFrom(obj['duplicated'])]);
}

/**
 * Reports kiosk usage stats to the witteria API. Network failures never reach
 * the UI: a failed real-time POST is stored in `failed_requests` (SQLite) keyed
 * by `eventId`, and re-sent once a day via the dedicated BATCH endpoints
 * (`/menu-touches/sync`, `/photo-shots/sync`) — see syncMenuTouches/syncPhotoShots.
 *
 * Env:
 *   STATS_MENU_TOUCH_URL        — real-time menu-touch endpoint.
 *   STATS_MENU_TOUCHES_SYNC_URL — nightly menu-touch batch endpoint.
 *   STATS_SHOTS_URL             — real-time v1 shots endpoint.
 *   STATS_SHOTS_V2_URL          — 제주 measurement endpoint, `/shots/measurement` (formerly
 *                                 `/shots/v2`; multipart, measurement + photo).
 *   STATS_PHOTO_SHOTS_SYNC_URL  — nightly photo-shots batch endpoint.
 */
export class StatsService {
  private measurementSource: MeasurementSource | null = null;

  private readonly ledger: ShotLedger;
  private readonly now: () => number;
  /** False when the ledger is memory-only. */
  private readonly durableLedger: boolean;
  private lastNotesPruneAt = 0;
  private syncTimer: NodeJS.Timeout | null = null;
  private syncing = false;

  constructor(
    private readonly kiosk: KioskService,
    private readonly failedRequests: FailedRequestService,
    options: StatsServiceOptions = {},
  ) {
    this.ledger = options.ledger ?? new MemoryShotLedger();
    this.durableLedger = options.ledger !== undefined;
    this.now = options.now ?? Date.now;
  }

  /** Where `/shots/v2` gets the ZED measurement of the capture being reported. */
  setMeasurementSource(source: MeasurementSource): void {
    this.measurementSource = source;
  }

  private menuTouchUrl(): string {
    return process.env['STATS_MENU_TOUCH_URL'] ?? `${witteriaApiBase()}/api/stats/menu-touch`;
  }

  private menuTouchesSyncUrl(): string {
    return process.env['STATS_MENU_TOUCHES_SYNC_URL'] ?? `${witteriaApiBase()}/api/stats/menu-touches/sync`;
  }

  private shotsUrl(): string {
    return process.env['STATS_SHOTS_URL'] ?? `${witteriaApiBase()}/api/stats/shots`;
  }

  /** Renamed from `/api/stats/shots/v2` (2026-11-03); the env name is kept so old .env files work. */
  private shotsV2Url(): string {
    return process.env['STATS_SHOTS_V2_URL'] ?? `${witteriaApiBase()}/api/stats/shots/measurement`;
  }

  /** 제주 kiosks (W008/W009/W010) carry the ZED; every other venue stays on v1. */
  private usesShotsV2(): boolean {
    return isJejuLayout(this.kiosk.getConfig().layout);
  }

  private photoShotsSyncUrl(): string {
    return process.env['STATS_PHOTO_SHOTS_SYNC_URL'] ?? `${witteriaApiBase()}/api/stats/photo-shots/sync`;
  }

  /**
   * Record a completed menu-touch session in real time. On failure the session
   * is stored in SQLite (keyed by `eventId`) for the nightly batch re-send. The
   * real-time endpoint takes no eventId; it's added only for batch idempotency.
   */
  async recordMenuTouch(input: MenuTouchInput): Promise<boolean> {
    const kioskId = this.kiosk.kioskNum();
    const eventId = input.eventId ?? randomUUID();

    const realtime: MenuTouchBody = {
      kioskId,
      buttonId: input.buttonId,
      touchedAt: input.touchedAt,
      backToHomeAt: input.backToHomeAt,
    };
    try {
      await this.post(this.menuTouchUrl(), realtime);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'menu-touch POST failed';
      const item: MenuTouchSyncItem = {
        eventId,
        kioskId,
        buttonId: input.buttonId,
        buttonType: input.buttonType ?? null,
        touchedAt: input.touchedAt,
        backToHomeAt: input.backToHomeAt,
      };
      this.store(MENU_TOUCH_REQUEST_TYPE, item, eventId, message);
      log.warn('menu-touch POST failed; stored for nightly batch', { message, eventId });
      return false;
    }
  }

  /**
   * The original capture is on disk: write the shot to the ledger BEFORE the
   * composite starts, so an app that quits mid-composite still leaves a record.
   * Never throws — the capture flow must not notice the ledger.
   */
  openShot(input: Omit<ShotInput, 'isSuccess'> & { eventId: string }): void {
    try {
      if (this.ledger.get(input.eventId)) return;
      const row = this.newRow(input.eventId, input, null, 'open');
      this.ledger.save(row);
      this.ledger.note(textLine(this.now(), '촬영 시작', row));
    } catch (error) {
      log.warn('Could not open the shot in the ledger', error);
    }
  }

  /**
   * Record a finished capture (composite succeeded or failed). The shot goes to
   * the ledger first and is sent from it: a send that fails stays in the ledger
   * and goes out again on the next cycle (hourly) — see deliver().
   * `eventId` is the idempotency key the server dedupes on.
   */
  async recordShot(input: ShotInput): Promise<boolean> {
    const eventId = input.eventId ?? randomUUID();
    const existing = this.readLedger(eventId);
    if (existing?.state === 'sent') return true;

    let row: ShotRow = {
      ...(existing ?? this.newRow(eventId, input, input.isSuccess, 'pending')),
      isSuccess: input.isSuccess,
      backgroundId: input.backgroundId ?? existing?.backgroundId ?? null,
      arFailure: input.isSuccess ? null : (input.arFailure ?? null),
      state: 'pending',
      photoPath: input.photoPath ?? existing?.photoPath ?? null,
      nextAttemptAt: this.now(),
    };
    // Written before anything is awaited: if the app quits from here on, the
    // composite's real outcome is already in the ledger.
    let saved = this.writeLedger(row, '촬영');
    // 제주: the measurement of THIS capture is claimed once and kept in the row,
    // so a later re-send carries the same sizes.
    if (this.usesShotsV2() && row.photoPath) {
      row = { ...row, v2Data: shotV2Data(bodyOf(row), await this.claimMeasurement()) };
      saved = this.saveLedger(row) && saved;
    }

    const after = await this.deliver(row);
    if (after.state !== 'sent' && !(saved && this.durableLedger)) {
      // No ledger on disk: fall back to the old queue so the shot survives a restart.
      this.storeShotForBatch(bodyOf(row), input.outfitId ?? null, after.lastError ?? 'unsent');
    }
    return after.state === 'sent';
  }

  private newRow(
    eventId: string,
    input: Omit<ShotInput, 'isSuccess'>,
    isSuccess: boolean | null,
    state: ShotRow['state'],
  ): ShotRow {
    const now = this.now();
    return {
      eventId,
      // The machine's own id: a test kiosk showing another site's screen must not
      // add its shots to that site's numbers.
      kioskId: this.kiosk.identityNum(),
      shotAt: input.shotAt ?? localIso(new Date(now)),
      isSuccess,
      shotType: input.shotType ?? null,
      outfitCode: input.outfitCode,
      language: input.language ?? null,
      backgroundId: input.backgroundId ?? null,
      arFailure: null,
      photoPath: input.photoPath ?? null,
      v2Data: null,
      state,
      v1Sent: false,
      attempts: 0,
      lastError: null,
      nextAttemptAt: now,
      createdAt: now,
      sentAt: null,
    };
  }

  private readLedger(eventId: string): ShotRow | null {
    try {
      return this.ledger.get(eventId);
    } catch (error) {
      log.warn('Could not read the shot ledger', error);
      return null;
    }
  }

  /** Save the row. False when the ledger could not be written. */
  private saveLedger(row: ShotRow): boolean {
    try {
      this.ledger.save(row);
      return true;
    } catch (error) {
      log.error('Could not write the shot ledger', error);
      return false;
    }
  }

  /** Save the row and add a text line. False when the ledger could not be written. */
  private writeLedger(row: ShotRow, event: string, detail = ''): boolean {
    const saved = this.saveLedger(row);
    if (saved) this.ledger.note(textLine(this.now(), event, row, detail));
    return saved;
  }

  /**
   * One delivery attempt for a ledger row; returns the row as it is afterwards.
   *
   * 제주 rows go to the measurement endpoint (shot + sizes + original). When that
   * is REJECTED the plain shot record is sent on its own, so the shot is counted
   * now; the measurement upload stays in the ledger and is tried again daily —
   * the server attaches it to the shot that already exists.
   */
  private async deliver(row: ShotRow): Promise<ShotRow> {
    let next = row;
    let outcome: SendOutcome;

    if (next.v2Data && next.photoPath) {
      const v2 = await this.postShotV2(next.v2Data, next.photoPath);
      if (v2.kind === 'no-photo') {
        next = { ...next, photoPath: null, v2Data: null };
        outcome = next.v1Sent ? { kind: 'sent' } : await this.postShot(bodyOf(next));
      } else if (v2.kind === 'rejected' && !next.v1Sent) {
        const v1 = await this.postShot(bodyOf(next));
        if (v1.kind === 'sent') next = { ...next, v1Sent: true };
        // A transient v1 failure is retried hourly; otherwise the row waits a day for v2.
        outcome = v1.kind === 'retry' ? v1 : v2;
      } else {
        outcome = v2;
      }
    } else {
      outcome = await this.postShot(bodyOf(next));
    }

    // The shot's own send and the hourly cycle can both be working on this row.
    // Whichever finishes second must not turn a row the server already has back
    // into an unsent one.
    const current = this.readLedger(next.eventId);
    if (current?.state === 'sent') return current;

    next = afterAttempt(next, outcome, this.now());
    if (next.state === 'sent') {
      this.writeLedger(next, '전송 완료');
    } else if (next.state === 'rejected') {
      log.error('Shot rejected by the server; kept in the ledger, retried daily', {
        eventId: next.eventId,
        error: next.lastError,
        counted: next.v1Sent,
      });
      this.writeLedger(
        next,
        '거부(하루 1회 재시도·확인 필요)',
        `${next.lastError ?? ''}${next.v1Sent ? ' · 촬영 기록은 반영됨' : ''}`,
      );
    } else {
      log.warn('Shot not sent; kept in the ledger for the next cycle', {
        eventId: next.eventId,
        error: next.lastError,
      });
      this.writeLedger(next, '전송 실패(매시간 재시도)', next.lastError ?? '');
    }
    return next;
  }

  /** POST one plain shot record. Never throws. */
  private async postShot(body: ShotBody): Promise<SendOutcome> {
    try {
      const res = await fetch(this.shotsUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(SHOT_TIMEOUT_MS),
      });
      return classifyStatus(res.status);
    } catch (error) {
      return { kind: 'retry', message: error instanceof Error ? error.message : 'network error' };
    }
  }

  /**
   * Send every ledger row that is due: unsent rows (hourly), rejected rows
   * (daily), and rows whose composite never finished — the app quit — which go
   * out as failed shots. Then prune rows sent more than 30 days ago. Never throws.
   */
  async syncShotLedger(): Promise<{ sent: number; kept: number }> {
    const summary = { sent: 0, kept: 0 };
    try {
      let transient = 0;
      for (const due of this.ledger.due(this.now(), LEDGER_CYCLE_LIMIT)) {
        let row = due;
        if (row.state === 'open') {
          row = { ...row, isSuccess: false, state: 'pending' };
          if (this.usesShotsV2() && row.photoPath) {
            row = { ...row, v2Data: shotV2Data(bodyOf(row), null) };
          }
          this.writeLedger(row, '합성 미완료 — 실패 촬영으로 처리');
        }
        const after = await this.deliver(row);
        if (after.state === 'sent') {
          summary.sent += 1;
          transient = 0;
        } else {
          summary.kept += 1;
          if (after.state === 'pending' && ++transient >= TRANSIENT_STOP_AFTER) break;
        }
      }
      const pruned = this.ledger.pruneSent(this.now() - KEEP_SENT_MS);
      // The text ledger is rewritten whole, so once a day is enough.
      if (this.now() - this.lastNotesPruneAt >= 24 * HOUR_MS) {
        this.lastNotesPruneAt = this.now();
        this.ledger.pruneNotes(this.now(), KEEP_SENT_MS);
      }
      if (summary.sent > 0 || summary.kept > 0 || pruned > 0) {
        log.info('Shot ledger sync', { ...summary, pruned, unsent: this.ledger.unsent() });
      }
    } catch (error) {
      log.error('Shot ledger sync failed', error);
    }
    return summary;
  }

  /**
   * Re-send everything that has not reached the server: the shot ledger, plus
   * the stored menu touches and the shots queued by older versions. Runs once
   * shortly after launch and then hourly; the nightly sync still calls the two
   * batch re-sends, which is harmless (the server dedupes on eventId).
   */
  async runPeriodicSync(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    try {
      await this.syncShotLedger();
      await this.syncMenuTouches();
      await this.syncPhotoShots();
    } catch (error) {
      log.warn('Periodic stats sync failed', error);
    } finally {
      this.syncing = false;
    }
  }

  startPeriodicSync(): void {
    if (this.syncTimer) return;
    const schedule = (delayMs: number): void => {
      this.syncTimer = setTimeout(() => {
        void this.runPeriodicSync().finally(() => {
          if (this.syncTimer) schedule(SYNC_INTERVAL_MS);
        });
      }, delayMs);
      if (typeof this.syncTimer.unref === 'function') this.syncTimer.unref();
    };
    schedule(SYNC_STARTUP_DELAY_MS);
    log.info('Periodic stats sync started', {
      startupDelayMs: SYNC_STARTUP_DELAY_MS,
      intervalMs: SYNC_INTERVAL_MS,
    });
  }

  stopPeriodicSync(): void {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = null;
  }

  private async claimMeasurement(): Promise<ShotMeasurement | null> {
    if (!this.measurementSource) return null;
    try {
      return await this.measurementSource();
    } catch (error) {
      log.warn('No ZED measurement for this shot', error);
      return null;
    }
  }

  private async postShotV2(data: ShotV2Data, photoPath: string): Promise<ShotV2Outcome> {
    let photo: Buffer;
    try {
      photo = await readFile(photoPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'photo unreadable';
      // Only a file that is GONE ends the upload for good; a locked or busy file
      // (staff copying the folder) is tried again.
      const gone = (error as NodeJS.ErrnoException | null)?.code === 'ENOENT';
      return { kind: gone ? 'no-photo' : 'retry', message: `photo: ${message}` };
    }

    const form = new FormData();
    form.append('data', new Blob([JSON.stringify(withZeroSizes(data))], { type: 'application/json' }));
    const type = PHOTO_MIME[extname(photoPath).toLowerCase()] ?? 'application/octet-stream';
    form.append('photo', new Blob([photo], { type }), basename(photoPath));

    let res: Response;
    try {
      res = await fetch(this.shotsV2Url(), {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(SHOT_V2_TIMEOUT_MS),
      });
    } catch (error) {
      return { kind: 'retry', message: error instanceof Error ? error.message : 'network error' };
    }
    if (res.status === 409) {
      log.info('shots/v2 already stored (409); treating as sent', { eventId: data.eventId });
    }
    const outcome = classifyStatus(res.status);
    if (outcome.kind === 'sent') return outcome;
    const detail = await res.text().catch(() => '');
    return { ...outcome, message: `${outcome.message}${detail ? ` ${detail.slice(0, 300)}` : ''}` };
  }

  /** Store a shot in the v1 batch-endpoint shape (outfitId, not outfitCode). */
  private storeShotForBatch(body: ShotBody, outfitId: number | null, message: string): void {
    const item: PhotoShotSyncItem = {
      eventId: body.eventId,
      kioskId: body.kioskId,
      outfitId,
      shotType: body.shotType,
      isSuccess: body.isSuccess,
      shotAt: body.shotAt ?? localIso(),
      language: body.language ?? null,
    };
    this.store(PHOTO_SHOT_REQUEST_TYPE, item, body.eventId, message);
    log.warn('shot stored for nightly batch', { message, eventId: body.eventId });
  }

  /**
   * Nightly re-send of `/shots/v2` POSTs that hit 5xx / network errors, one
   * multipart request each. Rejected ones (or a photo gone from disk) move to
   * the v1 batch queue so the shot is still counted. Never throws.
   */
  private async syncShotsV2(): Promise<void> {
    const pending = this.failedRequests.listByType(PHOTO_SHOT_V2_REQUEST_TYPE, SHOT_V2_RETRY_LIMIT);
    let sent = 0;
    for (const r of pending) {
      const { data, photoPath, outfitId } = r.payload as unknown as ShotV2Pending;
      const outcome = await this.postShotV2(data, photoPath);
      if (outcome.kind === 'sent') {
        this.failedRequests.resolve(r.id);
        sent += 1;
      } else if (outcome.kind === 'retry' || outcome.message.startsWith('HTTP 500')) {
        // Rows queued by older versions keep their old rule: a 500 is retried as
        // an upload rather than handed to the v1 batch (which drops the measurement).
        this.failedRequests.markRetried(r.id, outcome.message);
      } else {
        // Same request_id (eventId): delete first, or the insert would only
        // bump the v2 row's retry count instead of becoming a v1 item.
        this.failedRequests.resolve(r.id);
        this.storeShotForBatch(data, outfitId ?? null, outcome.message);
      }
    }
    if (pending.length > 0) {
      log.info('shots/v2 nightly re-send', { sent, kept: pending.length - sent });
    }
  }

  /**
   * Once-a-day batch re-send of menu touches whose real-time POST failed. Marks
   * `accepted`/`duplicated` as SENT and leaves `failed` for the next run.
   */
  async syncMenuTouches(): Promise<void> {
    await this.syncBatch(MENU_TOUCH_REQUEST_TYPE, this.menuTouchesSyncUrl(), 'menu-touches');
  }

  /** Once-a-day batch re-send of photo shots whose real-time POST failed. v2
   *  goes first so anything it hands to the v1 batch is sent in the same run. */
  async syncPhotoShots(): Promise<void> {
    await this.syncShotsV2();
    await this.syncBatch(PHOTO_SHOT_REQUEST_TYPE, this.photoShotsSyncUrl(), 'photo-shots');
  }

  /** Persist a failed real-time event for the nightly batch (request_id = eventId
   *  → idempotent local upsert, never throws). */
  private store(requestType: string, item: object, eventId: string, error: string): void {
    this.failedRequests.record(
      requestType,
      item as unknown as Record<string, unknown>,
      error,
      eventId,
    );
  }

  /**
   * Generic nightly batch re-send for a stored event type. Posts `{ items }` in
   * pages of ≤1000; `accepted`+`duplicated` eventIds are resolved (SENT) and the
   * rest kept for the next run. Never throws.
   */
  private async syncBatch(requestType: string, url: string, label: string): Promise<void> {
    for (let pass = 0; pass < MAX_BATCH_PASSES; pass += 1) {
      const pending = this.failedRequests.listByType(requestType, SYNC_BATCH_LIMIT);
      if (pending.length === 0) return;

      const items = pending.map((r) => r.payload);
      let sent: Set<string>;
      try {
        sent = await this.postBatch(url, items);
      } catch (error) {
        // Whole-batch failure (network / 4xx / 5xx): keep everything for next run.
        const message = error instanceof Error ? error.message : `${label} batch failed`;
        for (const r of pending) this.failedRequests.markRetried(r.id, message);
        log.warn(`${label} batch failed; will retry next cycle`, { count: pending.length, message });
        return;
      }

      let resolved = 0;
      for (const r of pending) {
        const eventId = (r.payload['eventId'] as string | undefined) ?? r.requestId;
        if (sent.has(eventId)) {
          this.failedRequests.resolve(r.id);
          resolved += 1;
        } else {
          this.failedRequests.markRetried(r.id, `rejected by ${label} sync`);
        }
      }
      log.info(`${label} batch synced`, { sent: resolved, kept: pending.length - resolved });

      // A 200 that classified nothing as sent usually means the response shape
      // differs from expectations — log it so it doesn't silently loop nightly.
      if (resolved === 0) {
        log.warn(`${label} batch: server accepted none — check response shape`, {
          count: pending.length,
        });
      }

      // Fewer than a full page means the queue is drained.
      if (pending.length < SYNC_BATCH_LIMIT) return;
    }
  }

  private async postBatch(url: string, items: object[]): Promise<Set<string>> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
      signal: AbortSignal.timeout(SHOT_V2_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: unknown = await res.json().catch(() => ({}));
    return sentEventIds(json);
  }

  private async post(url: string, body: object): Promise<void> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SHOT_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }
}
