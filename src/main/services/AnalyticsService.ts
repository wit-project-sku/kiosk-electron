import type { AnalyticsEvent, AnalyticsReport, CreateAnalyticsEvent } from '@shared/types/data';
import { AppError } from '@main/core/AppError';
import { createLogger } from '@main/core/logger';
import type { AnalyticsRepository } from '@main/database/repositories/AnalyticsRepository';
import type { KioskService } from '@main/services/KioskService';

const log = createLogger('analytics-service');

/**
 * Records business-critical analytics. The contract is simple and robust:
 * every event is persisted to SQLite synchronously and marked pending-sync
 * BEFORE the call returns. Nothing is ever sent to a remote server from here —
 * the SyncService drains pending events in the background. This guarantees no
 * event is lost to network failures, crashes, or power loss.
 */
export class AnalyticsService {
  constructor(
    private readonly repo: AnalyticsRepository,
    private readonly kiosk?: KioskService,
  ) {}

  track(input: CreateAnalyticsEvent): AnalyticsEvent {
    if (!input.name || input.name.trim().length === 0) {
      throw AppError.validation('Analytics event requires a name.');
    }
    const kioskId = this.kiosk?.getConfig().kioskId;
    const payload =
      kioskId != null
        ? { ...input.payload, kioskId }
        : input.payload;
    const event = this.repo.create({ ...input, payload });
    log.debug('Tracked analytics event', { name: event.name, id: event.id });
    return event;
  }

  report(rangeStart: string | null, rangeEnd: string | null): AnalyticsReport {
    return this.repo.report(rangeStart, rangeEnd);
  }

  listAll(): AnalyticsEvent[] {
    return this.repo.listAll();
  }
}
