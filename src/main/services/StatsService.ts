import { randomUUID } from 'node:crypto';
import type {
  MenuTouchBody,
  MenuTouchInput,
  MenuTouchSyncItem,
  PhotoShotSyncItem,
  ShotBody,
  ShotInput,
} from '@shared/types/data';
import { createLogger } from '@main/core/logger';
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
 *   STATS_SHOTS_URL             — real-time shots endpoint.
 *   STATS_PHOTO_SHOTS_SYNC_URL  — nightly photo-shots batch endpoint.
 */
export class StatsService {
  constructor(
    private readonly kiosk: KioskService,
    private readonly failedRequests: FailedRequestService,
  ) {}

  private menuTouchUrl(): string {
    return process.env['STATS_MENU_TOUCH_URL'] ?? `${witteriaApiBase()}/api/stats/menu-touch`;
  }

  private menuTouchesSyncUrl(): string {
    return process.env['STATS_MENU_TOUCHES_SYNC_URL'] ?? `${witteriaApiBase()}/api/stats/menu-touches/sync`;
  }

  private shotsUrl(): string {
    return process.env['STATS_SHOTS_URL'] ?? `${witteriaApiBase()}/api/stats/shots`;
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
    try {
      await this.post(this.shotsUrl(), realtime);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'shot POST failed';
      // Store in the batch-endpoint shape (outfitId, not outfitCode).
      const item: PhotoShotSyncItem = {
        eventId,
        kioskId,
        outfitId: input.outfitId ?? null,
        shotType,
        isSuccess: input.isSuccess,
        shotAt,
      };
      this.store(PHOTO_SHOT_REQUEST_TYPE, item, eventId, message);
      log.warn('shot POST failed; stored for nightly batch', { message, eventId });
      return false;
    }
  }

  /**
   * Once-a-day batch re-send of menu touches whose real-time POST failed. Marks
   * `accepted`/`duplicated` as SENT and leaves `failed` for the next run.
   */
  async syncMenuTouches(): Promise<void> {
    await this.syncBatch(MENU_TOUCH_REQUEST_TYPE, this.menuTouchesSyncUrl(), 'menu-touches');
  }

  /** Once-a-day batch re-send of photo shots whose real-time POST failed. */
  async syncPhotoShots(): Promise<void> {
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
