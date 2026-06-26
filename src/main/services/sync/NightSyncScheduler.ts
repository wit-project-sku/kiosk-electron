import { createLogger } from '@main/core/logger';

const log = createLogger('night-sync');

/** Night sync runs at midnight (00:00) local time. */
const SYNC_HOUR = 0;
const SYNC_MINUTE = 0;

/**
 * Schedules background synchronization at midnight (00:00) daily. Users never
 * see this — it runs silently in the main process.
 */
export class NightSyncScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  start(runSync: () => Promise<void>): void {
    if (this.timer) return;
    this.scheduleNext(runSync);
    log.info('Night sync scheduler started', { hour: SYNC_HOUR });
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private scheduleNext(runSync: () => Promise<void>): void {
    const delayMs = msUntilNextSync();
    log.debug('Next night sync scheduled', { delayMs, at: new Date(Date.now() + delayMs).toISOString() });

    this.timer = setTimeout(() => {
      void this.execute(runSync);
    }, delayMs);

    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  private async execute(runSync: () => Promise<void>): Promise<void> {
    if (this.running) {
      this.scheduleNext(runSync);
      return;
    }

    this.running = true;
    try {
      log.info('Night sync starting');
      await runSync();
      log.info('Night sync completed');
    } catch (error) {
      log.error('Night sync failed', error);
    } finally {
      this.running = false;
      this.scheduleNext(runSync);
    }
  }
}

function msUntilNextSync(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(SYNC_HOUR, SYNC_MINUTE, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime() - now.getTime();
}
