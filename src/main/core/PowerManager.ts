/**
 * Kiosk power lifecycle: auto-start on boot and a nightly auto-reboot.
 *
 * This reimplements, at the OS level and from inside the app itself, what the
 * repo-root `SetAutoShutdown.bat` / `UnsetAutoShutdown.bat` helpers did by hand:
 *
 *   1. A daily reboot at 02:00 (`shutdown /r /f`) registered as a Windows
 *      Scheduled Task — robust because the OS scheduler fires it even if the
 *      app has hung or crashed.
 *   2. Auto-launch of the kiosk app on login/boot, so after the nightly reboot
 *      the machine comes straight back up into the kiosk.
 *
 * Provisioning is idempotent (safe to run on every launch) and Windows-only;
 * on other platforms every method is a no-op. Self-provisioning means the
 * fleet no longer depends on an operator remembering to run the .bat files.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { app } from 'electron';
import { createLogger } from './logger';

const exec = promisify(execFile);
const log = createLogger('power');

/** Scheduled Task name for the nightly reboot. */
const RESTART_TASK = 'KioskAutoRestart';
/** Local time of the nightly reboot — matches the original SetAutoShutdown.bat. */
const RESTART_HOUR = 2;
const RESTART_MINUTE = 0;
/** Run key value name registered alongside Electron's login-item setting. */
const AUTORUN_KEY = 'KioskApp';

function isWindows(): boolean {
  return process.platform === 'win32';
}

/** `HH:mm` for schtasks /st (zero-padded, 24h). */
function startTime(): string {
  const hh = String(RESTART_HOUR).padStart(2, '0');
  const mm = String(RESTART_MINUTE).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Register the kiosk to launch automatically when the user logs in. Uses
 * Electron's native login-item API (writes the HKCU\...\Run key for our own
 * exe), so the reboot scheduled below brings the machine back into the kiosk.
 *
 * Skipped when not packaged so a dev run never registers electron.exe to
 * auto-start the developer's machine.
 */
function configureAutoStart(): void {
  if (!isWindows() || !app.isPackaged) return;
  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      name: AUTORUN_KEY,
      path: app.getPath('exe'),
      args: [],
    });
    log.info('Auto-start on login enabled', { path: app.getPath('exe') });
  } catch (error) {
    log.warn('Failed to configure auto-start', error);
  }
}

function disableAutoStart(): void {
  if (!isWindows()) return;
  try {
    app.setLoginItemSettings({ openAtLogin: false, name: AUTORUN_KEY });
    log.info('Auto-start on login disabled');
  } catch (error) {
    log.warn('Failed to disable auto-start', error);
  }
}

/**
 * Create (or overwrite) the daily reboot Scheduled Task. `/f` makes it
 * idempotent: running on every launch just refreshes the existing task.
 *
 * Skipped when not packaged so a dev machine is never scheduled to reboot at
 * 02:00.
 */
async function ensureRestartTask(): Promise<void> {
  if (!isWindows() || !app.isPackaged) return;
  try {
    await exec('schtasks', [
      '/create',
      '/tn', RESTART_TASK,
      '/tr', 'shutdown /r /f /t 0',
      '/sc', 'daily',
      '/st', startTime(),
      '/f',
    ]);
    log.info('Nightly reboot scheduled', { task: RESTART_TASK, at: startTime() });
  } catch (error) {
    log.warn('Failed to schedule nightly reboot', error);
  }
}

async function removeRestartTask(): Promise<void> {
  if (!isWindows()) return;
  try {
    await exec('schtasks', ['/delete', '/tn', RESTART_TASK, '/f']);
    log.info('Nightly reboot task removed', { task: RESTART_TASK });
  } catch (error) {
    // /delete fails if the task doesn't exist — harmless.
    log.debug('Nightly reboot task not present / already removed', error);
  }
}

/**
 * Provision OS-level kiosk power behavior. Call once during startup (after
 * `app.whenReady`). Best-effort and non-fatal — a failure here must never stop
 * the kiosk from coming up.
 */
export async function setupKioskPower(): Promise<void> {
  if (!isWindows()) {
    log.debug('Kiosk power management skipped (non-Windows platform)');
    return;
  }
  if (!app.isPackaged) {
    log.debug('Kiosk power management skipped (development build)');
    return;
  }
  configureAutoStart();
  await ensureRestartTask();
}

/**
 * Tear down everything `setupKioskPower` provisioned. Mirrors
 * UnsetAutoShutdown.bat — intended for an uninstall hook or a maintenance
 * toggle, not normal shutdown.
 */
export async function teardownKioskPower(): Promise<void> {
  disableAutoStart();
  await removeRestartTask();
}
