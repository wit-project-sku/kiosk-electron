import type { FootfallBucket } from '@shared/types/footfall';
import {
  FOOTFALL_RETENTION_DAYS,
  FOOTFALL_UPLOAD_HOUR,
  FOOTFALL_UPLOAD_MINUTE,
} from '@shared/config/footfall';
import { createLogger } from '@main/core/logger';
import type { KioskService } from '@main/services/KioskService';
import type { FootfallRepository } from '@main/database/repositories/FootfallRepository';
import type { FootfallService } from './FootfallService';
import { localDateDaysBefore, localDateOf, localIso, msUntilLocalTime } from './time';

const log = createLogger('footfall-upload');

/** Server rejects oversized bodies; a day is 24 rows, so this is generous. */
const BATCH_SIZE = 200;
/** Safety bound on how many batches one run will push (≈ 8 years of backlog). */
const MAX_BATCHES = 20;
/** Give up on a stalled connection rather than hold the run open all night. */
const REQUEST_TIMEOUT_MS = 15_000;
/**
 * Two extra tries inside the nightly window, then wait for tomorrow. A kiosk
 * whose uplink is down at 21:30 is usually down for the evening; hammering it
 * every minute would just fill the log. Nothing is lost by waiting — the rows
 * stay pending and tomorrow's run sends both days.
 */
const RETRY_DELAYS_MS = [60_000, 300_000];
/**
 * Startup catch-up delay. Long enough that the kiosk has finished booting,
 * rendered, and brought its network up; short enough to land inside a service
 * visit if someone is standing there watching.
 */
const STARTUP_CATCHUP_DELAY_MS = 120_000;

/** Wire body. `total` is the number the report is actually about. */
interface FootfallUploadItem {
  bucketStart: string;
  localDate: string;
  hour: number;
  in: number;
  out: number;
  total: number;
  activeSeconds: number;
}

interface FootfallUploadBody {
  kioskId: string;
  kioskNum: number;
  sentAt: string;
  buckets: FootfallUploadItem[];
}

/**
 * Ships the day's 유동인구 counts to the backend at 21:30 local, every night.
 *
 * ── Idempotency is the whole design ────────────────────────────────────
 * Every bucket is identified by (kioskId, bucketStart) and the server is
 * expected to UPSERT on that key, replacing the stored totals with the ones in
 * the body. That single property makes everything else safe: a run that times
 * out after the server committed re-sends the same rows tomorrow and changes
 * nothing; an hour that gains a visitor after it was uploaded flips back to
 * pending and is sent again with the corrected total; a kiosk offline for a week
 * sends seven days at once and the server sorts it out. Nothing here needs to
 * know whether a previous attempt got through.
 *
 * ── Not configured is not an error ─────────────────────────────────────
 * With no FOOTFALL_API_URL the counts simply accumulate in SQLite, exactly like
 * the sync queue with its Noop transport. Pointing the kiosk at a real endpoint
 * later uploads the whole backlog on the first night — nothing collected in the
 * meantime is lost.
 */
export class FootfallUploader {
  private timer: NodeJS.Timeout | null = null;
  private catchupTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly repo: FootfallRepository,
    private readonly kiosk: KioskService,
    private readonly service: FootfallService,
  ) {}

  /** The endpoint, or null when this fleet has no footfall backend yet. */
  private endpoint(): string | null {
    const url = process.env['FOOTFALL_API_URL']?.trim();
    return url ? url : null;
  }

  start(): void {
    if (this.timer) return;

    if (!this.endpoint()) {
      log.info('Footfall upload not configured (FOOTFALL_API_URL unset); counts stay local');
      // Still schedule: retention pruning and the "how many are waiting" log are
      // worth having, and the endpoint can appear via a .env drop + restart.
    }

    this.scheduleNext();

    // Catch up on anything a previous day failed to send, without waiting for
    // 21:30 — a kiosk rebooted at 22:00 would otherwise sit on it for a day.
    this.catchupTimer = setTimeout(() => {
      this.catchupTimer = null;
      const backlog = this.repo.listPending(1).filter((b) => b.localDate < localDateOf(new Date()));
      if (backlog.length > 0) void this.run('startup-catchup');
    }, STARTUP_CATCHUP_DELAY_MS);
    if (typeof this.catchupTimer.unref === 'function') this.catchupTimer.unref();

    log.info('Footfall uploader started', {
      at: `${String(FOOTFALL_UPLOAD_HOUR).padStart(2, '0')}:${String(FOOTFALL_UPLOAD_MINUTE).padStart(2, '0')}`,
      configured: this.endpoint() !== null,
    });
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.catchupTimer) clearTimeout(this.catchupTimer);
    this.catchupTimer = null;
  }

  private scheduleNext(): void {
    const delayMs = msUntilLocalTime(FOOTFALL_UPLOAD_HOUR, FOOTFALL_UPLOAD_MINUTE);
    this.timer = setTimeout(() => {
      void this.run('nightly').finally(() => this.scheduleNext());
    }, delayMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
    log.debug('Next footfall upload scheduled', {
      delayMs,
      at: new Date(Date.now() + delayMs).toISOString(),
    });
  }

  private async run(trigger: string): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      // Land the in-memory buffer first — the whole point of a 21:30 run is to
      // include the hours that just happened, and the last minute of them is
      // still sitting in FootfallService.
      this.service.flush();

      const pending = this.repo.countPending();
      if (pending === 0) {
        log.debug('Footfall upload skipped; nothing pending', { trigger });
        this.prune();
        return;
      }

      const url = this.endpoint();
      if (!url) {
        log.info('Footfall counts waiting for a backend', { trigger, pending });
        return;
      }

      let attempt = 0;
      // The first attempt plus each configured retry delay.
      while (attempt <= RETRY_DELAYS_MS.length) {
        try {
          const uploaded = await this.pushAll(url);
          this.service.recordUpload(localIso(), null);
          log.info('Footfall upload complete', { trigger, uploaded, attempt });
          this.prune();
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.service.recordUpload(localIso(), message);
          const delay = RETRY_DELAYS_MS[attempt];
          if (delay === undefined) {
            log.warn('Footfall upload failed; rows stay pending for tomorrow', { message });
            return;
          }
          log.warn('Footfall upload failed; retrying', { message, delay });
          await sleep(delay);
          attempt += 1;
        }
      }
    } finally {
      this.running = false;
    }
  }

  /** Push every pending bucket in batches. Throws on the first failed batch. */
  private async pushAll(url: string): Promise<number> {
    const { kioskId } = this.kiosk.getConfig();
    const kioskNum = this.kiosk.kioskNum();
    let uploaded = 0;

    for (let pass = 0; pass < MAX_BATCHES; pass++) {
      const batch = this.repo.listPending(BATCH_SIZE);
      if (batch.length === 0) break;

      // Snapshot each row's updated_at BEFORE the request so a crossing that
      // lands mid-flight leaves its bucket pending instead of being marked sent.
      const stamps = batch.map((bucket) => ({
        kioskId: bucket.kioskId,
        bucketStart: bucket.bucketStart,
        updatedAtBefore: this.repo.updatedAtFor(bucket.kioskId, bucket.bucketStart) ?? '',
      }));

      await this.post(url, {
        kioskId,
        kioskNum,
        sentAt: localIso(),
        buckets: batch.map(toItem),
      });

      this.repo.markSynced(stamps);
      uploaded += batch.length;

      if (batch.length < BATCH_SIZE) break;
    }

    return uploaded;
  }

  private async post(url: string, body: FootfallUploadBody): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env['FOOTFALL_API_KEY']
            ? { Authorization: `Bearer ${process.env['FOOTFALL_API_KEY']}` }
            : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Footfall POST ${response.status} ${response.statusText}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Retention. Only ever deletes rows the backend has acknowledged. */
  private prune(): void {
    try {
      const removed = this.repo.pruneSyncedBefore(localDateDaysBefore(FOOTFALL_RETENTION_DAYS));
      if (removed > 0) log.info('Pruned old footfall buckets', { removed });
    } catch (error) {
      log.warn('Footfall prune failed', error);
    }
  }
}

function toItem(bucket: FootfallBucket): FootfallUploadItem {
  return {
    bucketStart: bucket.bucketStart,
    localDate: bucket.localDate,
    hour: bucket.hour,
    in: bucket.inCount,
    out: bucket.outCount,
    total: bucket.totalCount,
    activeSeconds: bucket.activeSeconds,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer.unref === 'function') timer.unref();
  });
}
