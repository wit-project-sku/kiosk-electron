import type { SyncJob, SyncJobType, SyncQueueStats } from '@shared/types/data';
import type { EntityId } from '@shared/types/domain';
import { createLogger } from '@main/core/logger';
import type { SyncQueueRepository } from '@main/database/repositories/SyncQueueRepository';
import type { AnalyticsRepository } from '@main/database/repositories/AnalyticsRepository';
import type { FailedRequestService } from '@main/services/FailedRequestService';
import type { CachedContent } from '@shared/types/kiosk';
import type { LocalCacheService } from '@main/services/LocalCacheService';
import type { PhotoGenerationService } from '@main/services/photo/PhotoGenerationService';
import type { KioskService } from '@main/services/KioskService';
import type { TranslationService } from '@main/services/TranslationService';
import {
  MENU_TOUCH_REQUEST_TYPE,
  PHOTO_SHOT_REQUEST_TYPE,
  type StatsService,
} from '@main/services/StatsService';
import { NoopSyncTransport, type SyncTransport } from './SyncTransport';
import { GoogleSheetsSyncTransport } from './GoogleSheetsSyncTransport';
import { NightSyncScheduler } from './NightSyncScheduler';
import { nextAttemptAt } from './backoff';

const log = createLogger('sync-service');

const JOB_BATCH_SIZE = 50;
const ANALYTICS_BATCH_SIZE = 200;
const FAILED_RETRY_BATCH = 50;

type StatsListener = (stats: SyncQueueStats) => void;
type ContentListener = (content: CachedContent[]) => void;

/**
 * Background sync orchestrator. Runs exclusively during night sync (02:00 AM).
 * Daytime operation is fully offline — no polling, no spinners, no network.
 */
export class SyncService {
  private readonly scheduler = new NightSyncScheduler();
  private ticking = false;
  private readonly listeners = new Set<StatsListener>();
  private readonly contentListeners = new Set<ContentListener>();
  /** Extra jobs to run at midnight (e.g. refresh the shop catalogue). */
  private readonly nightTasks: Array<() => Promise<void>> = [];
  /** Set via setStatsService — used to retry failed menu-touch POSTs. */
  private statsService?: StatsService;

  constructor(
    private readonly queue: SyncQueueRepository,
    private readonly analytics: AnalyticsRepository,
    private readonly failedRequests: FailedRequestService,
    private readonly cache: LocalCacheService,
    private readonly photoGeneration?: PhotoGenerationService,
    private transport: SyncTransport = new NoopSyncTransport(),
  ) {}

  /** Wire Google Sheets transport when credentials and sheet ID are configured. */
  static createTransport(
    cache: LocalCacheService,
    failedRequests: FailedRequestService,
    kiosk: KioskService,
    translations: TranslationService,
  ): SyncTransport {
    const sheets = new GoogleSheetsSyncTransport(cache, failedRequests, kiosk, translations);
    return sheets.isConfigured() ? sheets : new NoopSyncTransport();
  }

  setTransport(transport: SyncTransport): void {
    this.transport = transport;
  }

  /** Wire the stats service so failed menu-touch POSTs are retried at night and
   *  stored photo shots are batch re-sent via the photo-shots/sync endpoint. */
  setStatsService(stats: StatsService): void {
    this.statsService = stats;
  }

  /** Register a job to run on every midnight sync (e.g. refresh shop data). */
  addNightTask(task: () => Promise<void>): void {
    this.nightTasks.push(task);
  }

  /**
   * Run a content + translation download immediately (outside the 02:00 window).
   * Fire-and-forget on startup so SQLite is fresh for the next bootstrap; any
   * failure is swallowed so daytime stays fully offline.
   */
  async syncContentNow(): Promise<boolean> {
    if (!this.transport.isConfigured() || !('downloadContent' in this.transport)) return false;
    try {
      await (this.transport as GoogleSheetsSyncTransport).downloadContent();
      this.emitContent();
      return true;
    } catch (error) {
      log.warn('Startup content sync failed', error);
      return false;
    }
  }

  start(): void {
    const recovered = this.queue.recoverInterrupted();
    if (recovered > 0) log.warn('Recovered interrupted sync jobs', { count: recovered });

    this.scheduler.start(() => this.runNightSync());
    this.emitStats();
    log.info('Sync service started (night sync at midnight)');
  }

  stop(): void {
    this.scheduler.stop();
  }

  enqueue(type: SyncJobType, payload: Record<string, unknown>): SyncJob {
    const job = this.queue.enqueue(type, payload);
    this.emitStats();
    return job;
  }

  getStats(): SyncQueueStats {
    return this.queue.stats();
  }

  listByStatus(status: SyncJob['status'], limit: number): SyncJob[] {
    return this.queue.listByStatus(status, limit);
  }

  retryFailed(id: EntityId): SyncJob | null {
    const job = this.queue.retry(id);
    this.emitStats();
    return job;
  }

  subscribe(listener: StatsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeContent(listener: ContentListener): () => void {
    this.contentListeners.add(listener);
    return () => {
      this.contentListeners.delete(listener);
    };
  }

  /** Full night sync cycle — download content, upload analytics, retry failures. */
  private async runNightSync(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;

    try {
      // Run registered tasks (shop refresh, etc.) regardless of the Google
      // transport — these have their own endpoints.
      for (const task of this.nightTasks) {
        try {
          await task();
        } catch (error) {
          log.warn('Midnight task failed', error);
        }
      }

      // Stats batch re-sends are independent of the content transport — they have
      // their own witteria endpoints — so run them before the transport gate below.
      if (this.statsService) {
        await this.statsService.syncMenuTouches();
        await this.statsService.syncPhotoShots();
      }

      if (!this.transport.isConfigured()) {
        log.info('No remote transport configured; seeding local cache only');
        await this.seedDefaultContent();
        return;
      }

      const hadContentUpdate = await this.downloadContent();
      await this.processJobs();
      await this.flushAnalytics();
      await this.retryFailedRequests();
      await this.retryDriveUploads();
      if (hadContentUpdate) this.emitContent();
    } catch (error) {
      log.error('Night sync cycle failed', error);
    } finally {
      this.ticking = false;
      this.emitStats();
    }
  }

  private async seedDefaultContent(): Promise<void> {
    if (this.cache.get('home')) return;
    this.cache.upsert(
      'home',
      {
        title: 'Welcome',
        subtitle: 'Touch a button to explore',
        body: 'Content updates automatically during night sync.',
      },
      'default',
    );
  }

  private async downloadContent(): Promise<boolean> {
    try {
      if ('downloadContent' in this.transport) {
        await (this.transport as GoogleSheetsSyncTransport).downloadContent();
        return true;
      }
      this.enqueue('sync_content', { source: 'google_sheets' });
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Content download failed';
      this.failedRequests.record('sync_content', {}, message);
      log.warn('Content download failed', { error: message });
      return false;
    }
  }

  private emitContent(): void {
    const content = this.cache.listAll();
    for (const listener of this.contentListeners) listener(content);
  }

  private async processJobs(): Promise<void> {
    for (let i = 0; i < JOB_BATCH_SIZE; i += 1) {
      const job = this.queue.claimNext(new Date().toISOString());
      if (!job) break;
      try {
        await this.transport.process(job);
        this.queue.markCompleted(job.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sync error';
        this.queue.markFailed(job.id, message, nextAttemptAt(job.attempts));
        log.warn('Sync job failed', { id: job.id, attempts: job.attempts });
      }
    }
  }

  private async flushAnalytics(): Promise<void> {
    const pending = this.analytics.listPending(ANALYTICS_BATCH_SIZE);
    if (pending.length === 0) return;
    try {
      await this.transport.uploadAnalytics(pending);
      this.analytics.markSynced(pending.map((e) => e.id));
      log.info('Flushed analytics batch', { count: pending.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analytics upload failed';
      this.failedRequests.record(
        'upload_analytics',
        { eventIds: pending.map((e) => e.id) },
        message,
      );
      log.warn('Analytics flush failed; recorded for retry', { error: message });
    }
  }

  private async retryFailedRequests(): Promise<void> {
    const pending = this.failedRequests.listRetryable(FAILED_RETRY_BATCH);
    for (const req of pending) {
      // Menu touches and photo shots are re-sent via dedicated once-a-day batch
      // endpoints, not one-by-one here. Skip so this loop never deletes them.
      if (req.type === MENU_TOUCH_REQUEST_TYPE || req.type === PHOTO_SHOT_REQUEST_TYPE) continue;
      try {
        if (req.type === 'upload_analytics') {
          const eventIds = (req.payload['eventIds'] as number[]) ?? [];
          const events = this.analytics.listPending(ANALYTICS_BATCH_SIZE).filter((e) =>
            eventIds.includes(e.id),
          );
          if (events.length > 0) {
            await this.transport.uploadAnalytics(events);
            this.analytics.markSynced(events.map((e) => e.id));
          }
        }
        if (req.type === 'drive_upload') {
          const sessionId = req.payload['sessionId'] as string;
          const sessions = this.photoGeneration?.listPendingDriveUploads(100) ?? [];
          const session = sessions.find((s) => s.sessionId === sessionId);
          if (session) {
            await this.photoGeneration!.retryDriveUpload(session);
          }
        }
        this.failedRequests.resolve(req.id);
        log.info('Resolved failed request', { id: req.id, type: req.type });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Retry failed';
        this.failedRequests.markRetried(req.id, message);
      }
    }
  }

  private async retryDriveUploads(): Promise<void> {
    if (!this.photoGeneration) return;
    const pending = this.photoGeneration.listPendingDriveUploads(50);
    for (const session of pending) {
      try {
        await this.photoGeneration.retryDriveUpload(session);
        log.info('Drive upload retry succeeded', { sessionId: session.sessionId });
      } catch (error) {
        log.warn('Drive upload retry failed', { sessionId: session.sessionId, error });
      }
    }
  }

  private emitStats(): void {
    const stats = this.queue.stats();
    for (const listener of this.listeners) listener(stats);
  }
}
