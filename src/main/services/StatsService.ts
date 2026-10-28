import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import type {
  MenuTouchBody,
  MenuTouchInput,
  MenuTouchSyncItem,
  PhotoShotSyncItem,
  ShooterBody,
  ShotBody,
  ShotInput,
  ShotV2Data,
} from '@shared/types/data';
import { isJejuLayout } from '@shared/config/kioskLocations';
import { createLogger } from '@main/core/logger';
import type { ShotMeasurement } from './height/HeightService';
import type { KioskService } from './KioskService';
import type { FailedRequestService } from './FailedRequestService';

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
/** `/shots/{eventId}/shooter` PATCHes (제주공항 국적), re-sent one by one at night. */
export const PHOTO_SHOOTER_REQUEST_TYPE = 'photo_shooter';

/** Queued shooter PATCH. */
interface ShooterPending {
  eventId: string;
  body: ShooterBody;
}

/**
 * The server only takes shooter info within 24h of the shot (STATS4105), so a
 * queued PATCH older than this can never land and is dropped.
 */
const SHOOTER_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Queued `/shots/v2` send. `outfitId` is kept for the v1 batch fallback. */
interface ShotV2Pending {
  data: ShotV2Data;
  photoPath: string;
  outfitId: number | null;
}

/**
 * How a `/shots/v2` attempt ended. `sent` includes 409 (STATS4106: an earlier
 * attempt already stored it). `retry` is 5xx / network. `rejected` is any other
 * 4xx or an unreadable photo — resending the same request cannot succeed.
 */
type ShotV2Outcome = { kind: 'sent' } | { kind: 'retry' | 'rejected'; message: string };

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
 *   STATS_SHOTS_V2_URL          — 제주 `/shots/v2` endpoint (multipart, measurement + photo).
 *   STATS_PHOTO_SHOTS_SYNC_URL  — nightly photo-shots batch endpoint.
 */
export class StatsService {
  private measurementSource: MeasurementSource | null = null;

  constructor(
    private readonly kiosk: KioskService,
    private readonly failedRequests: FailedRequestService,
  ) {}

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

  private shotsV2Url(): string {
    return process.env['STATS_SHOTS_V2_URL'] ?? `${witteriaApiBase()}/api/stats/shots/v2`;
  }

  /** 제주 kiosks (W008/W009/W010) carry the ZED; every other venue stays on v1. */
  private usesShotsV2(): boolean {
    return isJejuLayout(this.kiosk.getConfig().layout);
  }

  private shooterUrl(eventId: string): string {
    return `${witteriaApiBase()}/api/stats/shots/${encodeURIComponent(eventId)}/shooter`;
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
   * Record a completed photo capture (success or failure) in real time. On
   * failure the shot is stored in SQLite (keyed by `eventId`) for the nightly
   * batch re-send. `eventId` is the idempotency key shared across both paths.
   */
  async recordShot(input: ShotInput): Promise<boolean> {
    const kioskId = this.kiosk.kioskNum();
    const eventId = input.eventId ?? randomUUID();
    const shotAt = input.shotAt ?? localIso();
    const shotType = input.shotType ?? null;

    const realtime: ShotBody = {
      kioskId,
      shotAt,
      isSuccess: input.isSuccess,
      shotType,
      outfitCode: input.outfitCode,
      eventId,
    };
    const outfitId = input.outfitId ?? null;

    // v2 needs the photo; a capture that never reached disk is reported on v1.
    if (this.usesShotsV2() && input.photoPath) {
      return this.recordShotV2(realtime, input.photoPath, outfitId);
    }

    try {
      await this.post(this.shotsUrl(), realtime);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'shot POST failed';
      this.storeShotForBatch(realtime, outfitId, message);
      return false;
    }
  }

  /**
   * `/shots/v2`: shot + ZED measurement + AR original in one multipart POST.
   * Replaces the v1 call. 5xx / network failures are queued and re-sent as v2
   * at night; a request the server rejects falls back to the v1 batch so the
   * shot itself is still counted.
   */
  private async recordShotV2(body: ShotBody, photoPath: string, outfitId: number | null): Promise<boolean> {
    const measurement = await this.claimMeasurement();
    const data = shotV2Data(body, measurement);
    const outcome = await this.postShotV2(data, photoPath);
    if (outcome.kind === 'sent') return true;

    if (outcome.kind === 'retry') {
      const pending: ShotV2Pending = { data, photoPath, outfitId };
      this.store(PHOTO_SHOT_V2_REQUEST_TYPE, pending, body.eventId, outcome.message);
      log.warn('shots/v2 POST failed; stored for nightly re-send', {
        message: outcome.message,
        eventId: body.eventId,
      });
    } else {
      log.error('shots/v2 rejected; reporting the shot via the v1 batch', {
        message: outcome.message,
        eventId: body.eventId,
      });
      this.storeShotForBatch(body, outfitId, outcome.message);
    }
    return false;
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
      return { kind: 'rejected', message: `photo: ${message}` };
    }

    const form = new FormData();
    form.append('data', new Blob([JSON.stringify(withZeroSizes(data))], { type: 'application/json' }));
    const type = PHOTO_MIME[extname(photoPath).toLowerCase()] ?? 'application/octet-stream';
    form.append('photo', new Blob([photo], { type }), basename(photoPath));

    let res: Response;
    try {
      res = await fetch(this.shotsV2Url(), { method: 'POST', body: form });
    } catch (error) {
      return { kind: 'retry', message: error instanceof Error ? error.message : 'network error' };
    }
    if (res.ok) return { kind: 'sent' };
    if (res.status === 409) {
      log.info('shots/v2 already stored (409); treating as sent', { eventId: data.eventId });
      return { kind: 'sent' };
    }
    const detail = await res.text().catch(() => '');
    const message = `HTTP ${res.status}${detail ? ` ${detail.slice(0, 300)}` : ''}`;
    return { kind: res.status >= 500 ? 'retry' : 'rejected', message };
  }

  /**
   * Attach the visitor's 국적 to a shot already reported under `eventId`. The
   * shot record need not exist yet — the server accepts it either way and joins
   * the two by eventId, which is what makes a queued re-send safe. Never throws.
   */
  async recordShooter(eventId: string, body: ShooterBody): Promise<boolean> {
    const outcome = await this.patchShooter(eventId, body);
    if (outcome.kind === 'sent') return true;
    if (outcome.kind === 'retry') {
      const pending: ShooterPending = { eventId, body };
      // Own request_id: the shot itself may be queued under the bare eventId.
      this.store(PHOTO_SHOOTER_REQUEST_TYPE, pending, `${eventId}:shooter`, outcome.message);
      log.warn('shooter PATCH failed; stored for nightly re-send', { eventId, message: outcome.message });
    } else {
      log.error('shooter PATCH rejected', { eventId, message: outcome.message });
    }
    return false;
  }

  /**
   * `sent` includes 409 (STATS4104: already entered — it is one-shot). A 400 is
   * kept as `retry`: it is also what a backend that still requires heightCm and
   * gender answers, and the nightly run drops it once the 24h window is gone.
   */
  private async patchShooter(eventId: string, body: ShooterBody): Promise<ShotV2Outcome> {
    let res: Response;
    try {
      res = await fetch(this.shooterUrl(eventId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      return { kind: 'retry', message: error instanceof Error ? error.message : 'network error' };
    }
    if (res.ok || res.status === 409) return { kind: 'sent' };
    const detail = await res.text().catch(() => '');
    const message = `HTTP ${res.status}${detail ? ` ${detail.slice(0, 300)}` : ''}`;
    return { kind: res.status >= 500 || res.status === 400 ? 'retry' : 'rejected', message };
  }

  /** Nightly re-send of queued shooter PATCHes. Never throws. */
  private async syncShooters(): Promise<void> {
    const pending = this.failedRequests.listByType(PHOTO_SHOOTER_REQUEST_TYPE, SHOT_V2_RETRY_LIMIT);
    let sent = 0;
    for (const r of pending) {
      const { eventId, body } = r.payload as unknown as ShooterPending;
      if (Date.now() - Date.parse(r.createdAt) > SHOOTER_WINDOW_MS) {
        this.failedRequests.resolve(r.id);
        log.warn('shooter PATCH dropped: past the 24h window', { eventId });
        continue;
      }
      const outcome = await this.patchShooter(eventId, body);
      if (outcome.kind === 'sent') {
        this.failedRequests.resolve(r.id);
        sent += 1;
      } else if (outcome.kind === 'retry') {
        this.failedRequests.markRetried(r.id, outcome.message);
      } else {
        this.failedRequests.resolve(r.id);
        log.error('shooter PATCH rejected on re-send', { eventId, message: outcome.message });
      }
    }
    if (pending.length > 0) {
      log.info('shooter nightly re-send', { sent, kept: pending.length - sent });
    }
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
      } else if (outcome.kind === 'retry') {
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
    await this.syncShooters();
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
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }
}
