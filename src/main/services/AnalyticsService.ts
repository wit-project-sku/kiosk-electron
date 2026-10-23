import type { AnalyticsEvent, AnalyticsReport, CreateAnalyticsEvent } from '@shared/types/data';
import { AppError } from '@main/core/AppError';
import { createLogger } from '@main/core/logger';
import type { AnalyticsRepository } from '@main/database/repositories/AnalyticsRepository';
import type { KioskService } from '@main/services/KioskService';

const log = createLogger('analytics-service');

/**
 * Events whose payload is written to the log file too, not just SQLite — the
 * AR 한복 picks (outfit code + image), so a kiosk's log shows what a visitor
 * chose. Everything else stays a debug line, which a packaged build drops.
 */
const LOGGED_PAYLOAD_EVENTS = new Set(['outfit_selected', 'background_selected']);

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
    if (LOGGED_PAYLOAD_EVENTS.has(event.name)) {
      log.info(`Selection: ${event.name}`, { id: event.id, ...event.payload });
    } else {
      log.debug('Tracked analytics event', { name: event.name, id: event.id });
    }
    return event;
  }

  report(rangeStart: string | null, rangeEnd: string | null): AnalyticsReport {
    return this.repo.report(rangeStart, rangeEnd);
  }

  listAll(): AnalyticsEvent[] {
    return this.repo.listAll();
  }
}
