import type { AnalyticsEvent, SyncJob } from '@shared/types/data';

/**
 * Pluggable remote transport. The app is offline-first: by default NO transport
 * is configured, so jobs simply accumulate in the durable queue and are flushed
 * if/when a real backend is wired in. Swapping in a real implementation (HTTP,
 * cloud storage, etc.) requires no changes to the queue, services, or UI.
 *
 * A `process`/`uploadAnalytics` implementation should THROW on failure; the
 * SyncService converts a throw into a retry with exponential backoff.
 */
export interface SyncTransport {
  /** When false, the worker stays idle and the queue persists untouched. */
  isConfigured(): boolean;
  /** Perform a single queued remote operation. Throw to trigger retry. */
  process(job: SyncJob): Promise<void>;
  /** Upload a batch of pending analytics events. Throw to trigger retry. */
  uploadAnalytics(events: AnalyticsEvent[]): Promise<void>;
}

/**
 * Default no-op transport: nothing is configured, so the queue is preserved and
 * never errors. This keeps the kiosk fully functional with zero backend.
 */
export class NoopSyncTransport implements SyncTransport {
  isConfigured(): boolean {
    return false;
  }

  async process(): Promise<void> {
    // No backend configured; should never be called while isConfigured() is false.
  }

  async uploadAnalytics(): Promise<void> {
    // No backend configured.
  }
}
