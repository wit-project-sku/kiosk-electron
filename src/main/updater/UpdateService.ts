/**
 * Production auto-update service (electron-updater + GitHub Releases).
 *
 * Fully automatic, zero user interaction — a public kiosk never approves, clicks,
 * chooses a version, or answers a dialog. Channel-specific SCHEDULES:
 *
 *  - Production (`latest`): a WEEKLY maintenance window (default Fri 17:00 local,
 *    configurable via UPDATE_DAY / UPDATE_TIME) so kiosks don't churn through
 *    updates during business hours. If a scheduled window was MISSED (kiosk was
 *    powered off), it is detected on the next startup and run immediately, then
 *    the weekly cadence resumes. The window state is persisted, so this survives
 *    restarts and never re-checks needlessly between windows.
 *
 *  - Beta (`beta`): checks immediately on startup and then every
 *    UPDATE_BETA_INTERVAL_MIN minutes (default 15) so testers get builds fast.
 *
 * Common to both: downloads run in the background (kiosk keeps operating), the
 * install/restart happens only while idle (never mid photo/payment) with the
 * nightly reboot as a guaranteed fallback, offline checks fail quietly and retry
 * with exponential backoff (never spamming GitHub), and duplicate checks are
 * skipped. The renderer never sees electron-updater — it subscribes to
 * {@link subscribe} and reads {@link getStatus}.
 */

import { app } from 'electron';
// electron-updater is CommonJS; in this "type":"module" app electron-vite keeps
// it external, so a NAMED import (`import { autoUpdater }`) fails at runtime with
// "Named export 'autoUpdater' not found". Import the default (module.exports) and
// destructure — the same reason electron-log/electron-store are default imports.
import electronUpdater from 'electron-updater';
import type { ProgressInfo, UpdateInfo } from 'electron-updater';
import log from 'electron-log/main';

const { autoUpdater } = electronUpdater;
import { createLogger } from '@main/core/logger';
import type { UpdateChannel, UpdateStatus } from '@shared/types/update';
import { resolveUpdateChannel } from './updateChannel';
import {
  describeSchedule,
  nextWeeklyWindow,
  previousWeeklyWindow,
  resolveUpdateSchedule,
  type UpdateSchedule,
} from './updateSchedule';
import { UpdateStateStore } from './UpdateStateStore';

type StatusListener = (status: UpdateStatus) => void;
type Unsubscribe = () => void;

/** First check happens shortly after boot, not competing with startup work. */
const INITIAL_CHECK_DELAY_MS = 30_000;
/** Backoff floor after a failed check (weekly retry). */
const RETRY_MIN_MS = 15 * 60 * 1000; // 15 minutes
/** Backoff ceiling — a persistently-offline kiosk still retries at least this often. */
const RETRY_MAX_MS = 6 * 60 * 60 * 1000; // 6 hours
/** Grace period after a download completes before installing. */
const INSTALL_GRACE_MS = 10_000;
/** How often to re-attempt a deferred (busy) install. */
const INSTALL_RETRY_MS = 5 * 60 * 1000; // 5 minutes

export class UpdateService {
  private readonly log = createLogger('updater');
  private readonly channel: UpdateChannel;
  private readonly schedule: UpdateSchedule;
  private readonly stateStore = new UpdateStateStore();
  private status: UpdateStatus;
  private readonly listeners = new Set<StatusListener>();

  private started = false;
  private checking = false;
  private checkTimer: NodeJS.Timeout | null = null;
  private installTimer: NodeJS.Timeout | null = null;
  private backoffMs = RETRY_MIN_MS;
  /** The weekly window we are currently trying to satisfy (production only). */
  private pendingWindow: Date | null = null;

  /** Returns true when it is unsafe to restart right now (customer mid-session).
   *  Defaults to "never busy"; wired to the photo workflow in the main entry. */
  private busyCheck: () => boolean = () => false;

  constructor() {
    this.channel = resolveUpdateChannel();
    this.schedule = resolveUpdateSchedule(this.channel);
    this.status = {
      state: 'idle',
      channel: this.channel,
      currentVersion: app.getVersion(),
      availableVersion: null,
      progress: null,
      error: null,
      enabled: false,
      lastCheckedAt: null,
      nextCheckAt: null,
    };
  }

  /** Current status snapshot (defensively copied). */
  getStatus(): UpdateStatus {
    return { ...this.status, progress: this.status.progress ? { ...this.status.progress } : null };
  }

  /** Subscribe to status changes. Returns an unsubscribe function. */
  subscribe(listener: StatusListener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Inject a predicate that returns true while a restart would interrupt a
   * customer (e.g. mid photo/payment). A staged install is deferred and retried
   * until the kiosk is idle; it also still applies on the next app quit.
   */
  setBusyCheck(fn: () => boolean): void {
    this.busyCheck = fn;
  }

  /** Begin auto-update. No-op if already started or running unpackaged. */
  start(): void {
    if (this.started) return;
    this.started = true;

    // electron-updater can only replace an installed (NSIS) build — a dev run or
    // a raw win-unpacked copy has nothing to update. Skip cleanly.
    if (!app.isPackaged) {
      this.log.info('Auto-update disabled (development build)');
      this.patch({ state: 'idle', enabled: false });
      return;
    }

    autoUpdater.logger = log;
    autoUpdater.autoDownload = true; // background download
    autoUpdater.autoInstallOnAppQuit = true; // safety net: applies on the nightly reboot
    autoUpdater.allowDowngrade = false;
    autoUpdater.channel = this.channel;
    autoUpdater.allowPrerelease = this.channel === 'beta';

    this.wireEvents();
    this.patch({ enabled: true });
    this.log.info('Auto-update started', {
      channel: this.channel,
      currentVersion: this.status.currentVersion,
      schedule: describeSchedule(this.schedule),
    });

    if (this.schedule.kind === 'interval') {
      this.scheduleIntervalCheck(INITIAL_CHECK_DELAY_MS);
    } else {
      this.startWeekly();
    }
  }

  /** Cancel timers and listeners (called on app quit). */
  stop(): void {
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }
    if (this.installTimer) {
      clearTimeout(this.installTimer);
      this.installTimer = null;
    }
    this.listeners.clear();
    this.started = false;
  }

  /** Force an immediate check (e.g. from an operator action). Does not disturb
   *  the schedule. */
  async checkNow(): Promise<UpdateStatus> {
    await this.runCheck();
    return this.getStatus();
  }

  /** Install a staged update now, if one is downloaded. Returns false if not. */
  installNow(): boolean {
    if (this.status.state !== 'downloaded') return false;
    this.doInstall();
    return true;
  }

  // ---- scheduling ----------------------------------------------------------

  /** Beta: check now-ish, then every interval (offline just retries next tick). */
  private scheduleIntervalCheck(delayMs: number): void {
    this.armCheckTimer(delayMs, async () => {
      await this.runCheck();
      const next = this.schedule.kind === 'interval' ? this.schedule.intervalMs : delayMs;
      this.scheduleIntervalCheck(next);
    });
  }

  /** Production: catch up a missed window, else schedule the next one. */
  private startWeekly(): void {
    if (this.schedule.kind !== 'weekly') return;
    const now = new Date();
    const prev = previousWeeklyWindow(now, this.schedule);
    const lastHandled = this.stateStore.getLastWindowHandled();

    if (lastHandled < prev.getTime()) {
      // The most recent window is newer than the last one we handled → it was
      // missed (kiosk off, or first run). Catch up immediately.
      this.log.info('Missed maintenance window detected; checking now', {
        window: prev.toISOString(),
        lastHandled: lastHandled ? new Date(lastHandled).toISOString() : 'never',
      });
      this.pendingWindow = prev;
      this.armCheckTimer(INITIAL_CHECK_DELAY_MS, () => this.runWeeklyCheck());
    } else {
      this.scheduleNextWindow();
    }
  }

  private scheduleNextWindow(): void {
    if (this.schedule.kind !== 'weekly') return;
    const now = new Date();
    const next = nextWeeklyWindow(now, this.schedule);
    this.pendingWindow = next;
    const delayMs = Math.max(1000, next.getTime() - now.getTime());
    this.log.info('Next maintenance window scheduled', {
      at: next.toISOString(),
      inHours: Math.round((delayMs / 3_600_000) * 10) / 10,
    });
    this.patch({ nextCheckAt: next.getTime() });
    this.armCheckTimer(delayMs, () => this.runWeeklyCheck());
  }

  private async runWeeklyCheck(): Promise<void> {
    const ok = await this.runCheck();
    if (ok) {
      if (this.pendingWindow) this.stateStore.setLastWindowHandled(this.pendingWindow.getTime());
      this.pendingWindow = null;
      this.scheduleNextWindow();
    } else {
      // Offline at the window — retry with exponential backoff, keeping the same
      // pending window so it is still recorded as handled once we succeed.
      const retryMs = this.backoffMs;
      this.backoffMs = Math.min(this.backoffMs * 2, RETRY_MAX_MS);
      this.log.warn('Window check failed; retrying with backoff', {
        retryMinutes: Math.round(retryMs / 60000),
      });
      this.patch({ nextCheckAt: Date.now() + retryMs });
      this.armCheckTimer(retryMs, () => this.runWeeklyCheck());
    }
  }

  private armCheckTimer(delayMs: number, fn: () => void): void {
    if (this.checkTimer) clearTimeout(this.checkTimer);
    if (this.schedule.kind === 'interval') this.patch({ nextCheckAt: Date.now() + delayMs });
    this.checkTimer = setTimeout(fn, delayMs);
    if (typeof this.checkTimer.unref === 'function') this.checkTimer.unref();
  }

  // ---- checking / installing ----------------------------------------------

  /** Run one check. Returns true on success (or when a download is already in
   *  flight), false on failure. Never throws. */
  private async runCheck(): Promise<boolean> {
    if (!this.started || !this.status.enabled) return false;
    if (this.checking) {
      this.log.debug('Check skipped: one already in progress');
      return true;
    }
    // A download/install is already in flight for this cycle — treat as handled.
    if (this.status.state === 'downloading' || this.status.state === 'downloaded') {
      return true;
    }

    this.checking = true;
    this.patch({ lastCheckedAt: Date.now() });
    try {
      await autoUpdater.checkForUpdates();
      this.resetBackoff();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'update check failed';
      this.log.warn('Update check failed (offline?); staying on current version', { message });
      this.patch({ state: 'error', error: message });
      return false;
    } finally {
      this.checking = false;
    }
  }

  private resetBackoff(): void {
    this.backoffMs = RETRY_MIN_MS;
  }

  private wireEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      this.log.info('Checking for update', { channel: this.channel });
      this.patch({ state: 'checking', error: null });
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.log.info('Update available; downloading', {
        current: this.status.currentVersion,
        latest: info.version,
      });
      this.patch({ state: 'available', availableVersion: info.version, error: null });
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.log.info('Already up to date', {
        current: this.status.currentVersion,
        latest: info?.version ?? this.status.currentVersion,
      });
      this.patch({ state: 'up-to-date', availableVersion: null, progress: null, error: null });
    });

    autoUpdater.on('download-progress', (p: ProgressInfo) => {
      this.patch({
        state: 'downloading',
        progress: {
          percent: Math.round(p.percent),
          transferred: p.transferred,
          total: p.total,
          bytesPerSecond: Math.round(p.bytesPerSecond),
        },
      });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.log.info('Update downloaded; staging install', {
        version: info.version,
        sizeBytes: this.status.progress?.total ?? null,
      });
      this.patch({ state: 'downloaded', availableVersion: info.version, progress: null, error: null });
      this.scheduleInstall();
    });

    autoUpdater.on('error', (err: Error) => {
      this.log.warn('Updater error', { message: err?.message ?? String(err) });
      this.patch({ state: 'error', error: err?.message ?? 'update failed' });
    });
  }

  private scheduleInstall(): void {
    if (this.installTimer) clearTimeout(this.installTimer);
    this.installTimer = setTimeout(() => this.maybeInstall(), INSTALL_GRACE_MS);
  }

  private maybeInstall(): void {
    if (this.status.state !== 'downloaded') return;
    if (this.busyCheck()) {
      this.log.info('Install deferred: kiosk is mid-session; will retry (also applies on next restart)');
      if (this.installTimer) clearTimeout(this.installTimer);
      this.installTimer = setTimeout(() => this.maybeInstall(), INSTALL_RETRY_MS);
      return;
    }
    this.doInstall();
  }

  private doInstall(): void {
    this.log.info('Installing update and restarting', { version: this.status.availableVersion });
    // isSilent = true (no installer UI — zero user interaction),
    // isForceRunAfter = true (relaunch the kiosk automatically).
    setImmediate(() => {
      try {
        autoUpdater.quitAndInstall(true, true);
      } catch (err) {
        this.log.error('quitAndInstall failed; will apply on next quit', err);
      }
    });
  }

  private patch(partial: Partial<UpdateStatus>): void {
    this.status = { ...this.status, ...partial };
    const snapshot = this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        /* a broken listener must not stop the others */
      }
    }
  }
}
