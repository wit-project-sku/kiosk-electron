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

import { randomBytes } from 'node:crypto';
import { unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
/**
 * How often to re-attempt a deferred (busy) install.
 *
 * Kept SHORT because the busy gate now covers only `countdown` / `generating` —
 * phases that last seconds, not minutes. At the old 5-minute cadence a staged
 * update would idle for up to 5 extra minutes after the customer had already
 * finished, which read as "downloaded but stuck".
 */
const INSTALL_RETRY_MS = 45 * 1000; // 45 seconds
/**
 * Hard ceiling on how long a staged update may be deferred by `busyCheck`.
 *
 * The photo workflow only returns to `idle` when the RENDERER calls `photo:reset`
 * — so a customer who walks away mid-flow leaves the phase non-idle indefinitely,
 * which used to defer the install forever (it then applied only on the nightly
 * reboot). After this long, install regardless: at that point "busy" is far more
 * likely to be a stranded session than a real customer.
 */
const INSTALL_MAX_DEFER_MS = 30 * 60 * 1000; // 30 minutes
/**
 * How long to wait before deciding `quitAndInstall` did not tear the app down.
 *
 * We do NOT force a quit here. Quitting is only useful if it applies the update,
 * and it cannot: electron-updater sets `quitAndInstallCalled` before spawning the
 * installer, so its own `autoInstallOnAppQuit` hook is skipped for the rest of
 * this process ("Update installer has already been triggered"). A forced quit
 * would therefore just close the kiosk and change nothing — the exact failure
 * this service exists to avoid. Staying up and logging is strictly better; the
 * nightly reboot gives the next process a clean attempt.
 */
const QUIT_WATCHDOG_MS = 20_000;
/**
 * How many times an installer may be spawned for the SAME version before we stop
 * trying. Two is enough to rule out a one-off (a locked file, a half-written
 * download) while capping the damage: a kiosk that cannot apply an update is
 * closed at most twice, not every check for the rest of the week.
 */
const MAX_INSTALL_ATTEMPTS = 2;

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
  /** When the current update finished downloading — drives the defer ceiling. */
  private stagedAt: number | null = null;

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

    // Did the update we quit for last time actually land? Must run before the
    // first check, so a version that fails to apply is blocked rather than
    // downloaded and "installed" again on this very run.
    this.verifyPreviousInstall();

    autoUpdater.logger = log;
    autoUpdater.autoDownload = true; // background download
    autoUpdater.autoInstallOnAppQuit = true; // safety net: applies on the nightly reboot
    autoUpdater.channel = this.channel;
    autoUpdater.allowPrerelease = this.channel === 'beta';
    // MUST come after `channel`. electron-updater's channel SETTER forces
    // `allowDowngrade = true` (AppUpdater.js: "allowDowngrade will be
    // automatically set to true. If this behavior is not suitable for you,
    // simple set allowDowngrade explicitly after"), so assigning it before the
    // channel — as this did — silently left every kiosk willing to install an
    // OLDER build than the one it is running.
    autoUpdater.allowDowngrade = false;

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

  /** Install a staged update now, if one is downloaded. Returns false if not.
   *  Operator-initiated, so it ignores the failed-attempt block: a human is
   *  present and can answer an elevation prompt the scheduled path cannot. */
  installNow(): boolean {
    if (this.status.state !== 'downloaded') return false;
    this.doInstall(true);
    return true;
  }

  // ---- install verification ------------------------------------------------

  /**
   * Compare the version we last quit to install against the one now running.
   *
   * A mismatch means the installer we spawned did not replace this app — the
   * kiosk was closed for nothing. Repeat it and the kiosk is unusable, so the
   * version is blocked after {@link MAX_INSTALL_ATTEMPTS}.
   */
  private verifyPreviousInstall(): void {
    const pending = this.stateStore.getPendingInstall();
    if (!pending) return;

    const current = app.getVersion();
    if (pending.version === current) {
      this.log.info('Previous update applied successfully', { version: current });
      this.stateStore.clearPendingInstall();
      this.stateStore.setBlockedVersion(null);
      return;
    }

    if (pending.attempts >= MAX_INSTALL_ATTEMPTS) {
      this.stateStore.setBlockedVersion(pending.version);
      this.stateStore.clearPendingInstall();
      this.log.error(
        'Update repeatedly failed to install — auto-install disabled for this version. ' +
          'The kiosk stays on the current version instead of closing again. Most likely the ' +
          'app is installed per-machine (Program Files), which needs elevation the silent ' +
          'installer cannot get, or it is being launched from a copy the installer does not ' +
          'own. Reinstall it for the current user only and relaunch from the installed path.',
        {
          runningVersion: current,
          failedVersion: pending.version,
          attempts: pending.attempts,
          installDir: dirname(app.getPath('exe')),
        },
      );
      return;
    }

    this.log.warn('Previous update did not apply; will retry once', {
      runningVersion: current,
      expectedVersion: pending.version,
      attempts: pending.attempts,
    });
  }

  /**
   * Can a SILENT installer actually write to this install?
   *
   * A per-machine install (Program Files) is not writable by the unelevated
   * kiosk process. electron-builder's NSIS installer detects that case and asks
   * for elevation — a UAC dialog nobody is there to answer on an unattended
   * kiosk — then quits, leaving the app closed and unchanged. Probing the
   * directory first turns that into a logged error with the kiosk still running.
   */
  private canWriteToInstallDir(): boolean {
    const dir = dirname(app.getPath('exe'));
    const probe = join(dir, `.update-probe-${randomBytes(6).toString('hex')}`);
    try {
      writeFileSync(probe, '');
      unlinkSync(probe);
      return true;
    } catch {
      return false;
    }
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
    this.stagedAt = Date.now();
    this.installTimer = setTimeout(() => this.maybeInstall(), INSTALL_GRACE_MS);
  }

  private maybeInstall(): void {
    if (this.status.state !== 'downloaded') return;

    const deferredMs = this.stagedAt ? Date.now() - this.stagedAt : 0;
    if (this.busyCheck() && deferredMs < INSTALL_MAX_DEFER_MS) {
      this.log.info('Install deferred: kiosk is mid-session; will retry', {
        deferredMinutes: Math.round(deferredMs / 60000),
        maxDeferMinutes: Math.round(INSTALL_MAX_DEFER_MS / 60000),
      });
      if (this.installTimer) clearTimeout(this.installTimer);
      this.installTimer = setTimeout(() => this.maybeInstall(), INSTALL_RETRY_MS);
      return;
    }
    if (deferredMs >= INSTALL_MAX_DEFER_MS) {
      this.log.warn('Install deferral ceiling reached; installing anyway', {
        deferredMinutes: Math.round(deferredMs / 60000),
      });
    }
    this.doInstall();
  }

  /**
   * Quit and hand over to the downloaded installer.
   *
   * Both guards below fail SAFE: they leave the kiosk running on the current
   * version. Closing the app is only justified when the installer can plausibly
   * replace it — otherwise the kiosk goes dark and nothing is gained.
   *
   * @param force operator-initiated install; skips the failed-attempt block.
   */
  private doInstall(force = false): void {
    const version = this.status.availableVersion;

    if (!force && version && this.stateStore.getBlockedVersion() === version) {
      this.log.error('Install skipped: this version already failed to apply twice', { version });
      this.patch({
        state: 'error',
        error: `Update ${version} could not be installed (auto-install disabled for it). Reinstall the kiosk manually.`,
      });
      return;
    }

    if (!force && !this.canWriteToInstallDir()) {
      const installDir = dirname(app.getPath('exe'));
      this.log.error(
        'Install skipped: the install directory is not writable by this process, so the silent ' +
          'installer would stop at an elevation prompt and close the kiosk for nothing. ' +
          'Reinstall for the current user only (per-user install).',
        { installDir, version },
      );
      this.patch({
        state: 'error',
        error: `Update ${version ?? ''} needs administrator rights (${installDir}); kiosk left running.`,
      });
      return;
    }

    // Recorded BEFORE quitting: quitAndInstall reports only that the installer
    // was SPAWNED, so the next startup is the only place that can tell whether
    // it actually applied. See UpdateStateStore.
    if (version) {
      const pending = this.stateStore.recordInstallAttempt(version, Date.now());
      this.log.info('Installing update and restarting', {
        version,
        attempt: pending.attempts,
        maxAttempts: MAX_INSTALL_ATTEMPTS,
      });
    } else {
      this.log.info('Installing update and restarting', { version: null });
    }

    // isSilent = true (no installer UI — zero user interaction),
    // isForceRunAfter = true (relaunch the kiosk automatically).
    setImmediate(() => {
      try {
        autoUpdater.quitAndInstall(true, true);
      } catch (err) {
        this.log.error('quitAndInstall failed; staying on the current version', err);
        this.stateStore.clearPendingInstall();
      }
      // If we're still alive well after calling it, the quit was swallowed.
      // Do NOT force one (see QUIT_WATCHDOG_MS): it could not apply the update
      // and would only take the kiosk down.
      const watchdog = setTimeout(() => {
        this.log.warn(
          'Still running after quitAndInstall; the update was not applied. Keeping the kiosk up ' +
            'and retrying on the next check.',
          { version },
        );
        this.patch({ state: 'error', error: 'Update could not be installed; kiosk left running.' });
      }, QUIT_WATCHDOG_MS);
      if (typeof watchdog.unref === 'function') watchdog.unref();
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
