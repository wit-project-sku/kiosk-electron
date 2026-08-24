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

/**
 * Some sites run on a daily OPERATING-HOURS power cycle instead of the fleet-wide
 * 2AM reboot: shut down at 22:00 (종료), start at 08:00 (시작). Today that is
 * 오색시장 W004, 제주공항 W006 and 제주국제여객터미널 W007.
 *
 * Note on the 08:00 start: a scheduled task's "wake" timer can resume the PC from
 * sleep/hibernate, but Windows cannot power on a fully powered-off (S5) machine —
 * that requires the motherboard BIOS "Power On by RTC Alarm" set to 08:00. The
 * 08:00 task below covers wake-from-sleep and relaunches the app after a BIOS boot.
 *
 * Do NOT add `-RunLevel Highest` to the Register-ScheduledTask call below: the app
 * auto-starts UNELEVATED (login item / HKCU Run), so an elevated registration
 * fails "Access denied" and the catch silently drops the 08:00 task AND the
 * powercfg call, leaving a kiosk that shuts down at 22:00 and never comes back.
 *
 * TODO(제주 W006/W007): 22:00/08:00 are the 오색시장 hours. Confirm each 제주 venue's
 * actual operating hours and split the times per kiosk if they differ — a ferry
 * terminal's last sailing and an airport's last flight are not the same clock.
 */
const OPERATING_HOURS_KIOSK_IDS = new Set(['W004', 'W006', 'W007', 'W008']);
const OPERATING_HOURS_SHUTDOWN_TASK = 'KioskShutdownAt10PM';
const OPERATING_HOURS_START_TASK = 'KioskStartAt8AM';
const OPERATING_HOURS_SHUTDOWN_TIME = '22:00';
const OPERATING_HOURS_START_TIME = '08:00';

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
 * W004/W006/W007: provision the 08:00 시작 / 22:00 종료 daily power cycle and drop the
 * fleet-wide 2AM reboot. Idempotent (`/f`, `-Force`) — safe to run every launch.
 */
async function ensureOperatingHoursPowerCycle(): Promise<void> {
  if (!isWindows() || !app.isPackaged) return;
  // The 2AM reboot and the operating-hours cycle are mutually exclusive — make
  // sure a previously-provisioned reboot task can't also fire.
  await removeRestartTask();
  try {
    // 22:00 종료 — full shutdown.
    await exec('schtasks', [
      '/create',
      '/tn', OPERATING_HOURS_SHUTDOWN_TASK,
      '/tr', 'shutdown /s /f /t 0',
      '/sc', 'daily',
      '/st', OPERATING_HOURS_SHUTDOWN_TIME,
      '/f',
    ]);
    // 08:00 시작 — a WakeToRun task (PowerShell, since schtasks can't set the wake
    // flag) that resumes the PC from sleep/hibernate and (re)launches the kiosk.
    //
    // Deliberately NO `-RunLevel Highest`: the kiosk app auto-starts UNELEVATED
    // (Electron login-item / HKCU Run key, no elevation manifest, perMachine:
    // false), and `Register-ScheduledTask -RunLevel Highest` fails with
    // "Access denied" for an unelevated caller — which the catch below then
    // swallowed, silently dropping the 08:00 task AND the powercfg call. Limited
    // level is enough to launch the exe and still honours WakeToRun, and matches
    // the fleet-wide 2AM reboot task (also Limited).
    const exePath = app.getPath('exe');
    const ps = [
      `$a=New-ScheduledTaskAction -Execute '${exePath}';`,
      `$t=New-ScheduledTaskTrigger -Daily -At '${OPERATING_HOURS_START_TIME}';`,
      `$s=New-ScheduledTaskSettingsSet -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable;`,
      `Register-ScheduledTask -TaskName '${OPERATING_HOURS_START_TASK}' -Action $a -Trigger $t -Settings $s -Force`,
    ].join(' ');
    await exec('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps]);
    // Allow wake timers so the 08:00 task can actually wake the machine.
    await exec('powercfg', ['-change', '-standby-timeout-ac', '0']).catch(() => {});
    log.info('Operating-hours power cycle scheduled', { start: OPERATING_HOURS_START_TIME, shutdown: OPERATING_HOURS_SHUTDOWN_TIME });
  } catch (error) {
    log.warn('Failed to schedule operating-hours power cycle', error);
  }
}

async function removeOperatingHoursPowerCycle(): Promise<void> {
  if (!isWindows()) return;
  for (const task of [OPERATING_HOURS_SHUTDOWN_TASK, OPERATING_HOURS_START_TASK]) {
    await exec('schtasks', ['/delete', '/tn', task, '/f']).catch(() => {});
  }
}

/**
 * Provision OS-level kiosk power behavior. Call once during startup (after
 * `app.whenReady`). Best-effort and non-fatal — a failure here must never stop
 * the kiosk from coming up.
 */
export async function setupKioskPower(kioskId?: string): Promise<void> {
  if (!isWindows()) {
    log.debug('Kiosk power management skipped (non-Windows platform)');
    return;
  }
  if (!app.isPackaged) {
    log.debug('Kiosk power management skipped (development build)');
    return;
  }
  configureAutoStart();
  // W004/W006/W007 use an operating-hours power cycle (08:00 시작 / 22:00 종료);
  // every other kiosk keeps the fleet-wide 2AM reboot.
  if (kioskId != null && OPERATING_HOURS_KIOSK_IDS.has(kioskId)) {
    await ensureOperatingHoursPowerCycle();
  } else {
    await ensureRestartTask();
  }
}

/**
 * Tear down everything `setupKioskPower` provisioned. Mirrors
 * UnsetAutoShutdown.bat — intended for an uninstall hook or a maintenance
 * toggle, not normal shutdown.
 */
export async function teardownKioskPower(): Promise<void> {
  disableAutoStart();
  await removeRestartTask();
  await removeOperatingHoursPowerCycle();
}
