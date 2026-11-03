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
 *
 * Three schedules exist, and a build only ever provisions ONE of them:
 *
 *   production, most kiosks   02:00 reboot                 KioskAutoRestart
 *   production, W004/9/10     22:00 종료 + 08:00 시작       KioskShutdownAt10PM
 *                                                          KioskStartAt8AM
 *   production, W008 제주공항  00:00 종료 + 06:00 시작       KioskShutdownAtMidnight
 *                                                          KioskStartAt6AM
 *   beta (develop_1)          09:00 reboot                 KioskBetaAutoRestart
 *
 * The names are distinct on purpose: both channels install side by side on the
 * office machine and Scheduled Task / Run-key names are machine-global.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { app } from 'electron';
import { createLogger } from './logger';
import { isBetaBuild } from './appIdentity';

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
 * 2AM reboot: shut down (종료) at night, start (시작) in the morning. The hours are
 * per venue:
 *
 *   오색시장 W004, 여객터미널 W009, 세계자연유산 W010   22:00 종료 / 08:00 시작
 *   제주공항 W008                                       00:00 종료 / 06:00 시작
 *
 * Note on the morning start: a scheduled task's "wake" timer can resume the PC from
 * sleep/hibernate, but Windows cannot power on a fully powered-off (S5) machine —
 * that requires the motherboard BIOS "Power On by RTC Alarm" set to the same start
 * time (so 06:00 on W008, not the 08:00 copied from 오색). The start task below
 * covers wake-from-sleep and relaunches the app after the BIOS boot.
 *
 * Full shutdown rather than sleep is deliberate: a sleeping kiosk wakes when a
 * passer-by touches the screen, and the airport is busy all night.
 *
 * Do NOT add `-RunLevel Highest` to the Register-ScheduledTask call below: the app
 * auto-starts UNELEVATED (login item / HKCU Run), so an elevated registration
 * fails "Access denied" and the catch silently drops the start task AND the
 * powercfg call, leaving a kiosk that shuts down at night and never comes back.
 *
 * Each cycle has its own task names, so Task Scheduler on a kiosk says what it
 * actually does. Provisioning one cycle deletes the other cycles' tasks — a
 * kiosk renumbered into a different venue must not keep the old shutdown time.
 */
interface PowerCycle {
  shutdownTask: string;
  startTask: string;
  shutdownTime: string;
  startTime: string;
}

const STANDARD_HOURS_CYCLE: PowerCycle = {
  shutdownTask: 'KioskShutdownAt10PM',
  startTask: 'KioskStartAt8AM',
  shutdownTime: '22:00',
  startTime: '08:00',
};

const JEJU_AIRPORT_CYCLE: PowerCycle = {
  shutdownTask: 'KioskShutdownAtMidnight',
  startTask: 'KioskStartAt6AM',
  shutdownTime: '00:00',
  startTime: '06:00',
};

const OPERATING_HOURS_CYCLES: Record<string, PowerCycle> = {
  W004: STANDARD_HOURS_CYCLE,
  W008: JEJU_AIRPORT_CYCLE,
  W009: STANDARD_HOURS_CYCLE,
  W010: STANDARD_HOURS_CYCLE,
};

const ALL_POWER_CYCLES = [STANDARD_HOURS_CYCLE, JEJU_AIRPORT_CYCLE];

/**
 * ── BETA (develop_1) power schedule ───────────────────────────────────
 * The beta channel does NOT take part in either production schedule. It gets a
 * single daily REBOOT at 09:00 — "turn off and turn on" in one step, in the
 * morning, while someone is actually there to look at the machine.
 *
 * ★ Why a reboot and not the 22:00 종료 / 08:00 시작 pair: Windows can WAKE a
 * sleeping PC from a scheduled task but cannot power on a fully powered-off
 * (S5) one — that needs the BIOS "Power On by RTC Alarm". A beta box that shuts
 * down at 22:00 on a desk with no RTC alarm configured is simply gone until
 * someone presses the button. `shutdown /r` never leaves the machine off, so
 * the testing kiosk is always reachable.
 *
 * ★ Why its own task and Run-key NAMES: beta and production are installed side
 * by side on the office machine (see core/appIdentity.ts). Scheduled Task names
 * and HKCU\...\Run value names are MACHINE-global, so with the shared names
 * below a beta launch would silently overwrite production's tasks — repointing
 * the 08:00 start at the beta exe — and `ensureOperatingHoursPowerCycle` would
 * even /delete production's 2AM reboot. Namespacing keeps the two channels'
 * power schedules completely independent: nothing in the beta branch reads,
 * writes or deletes a production-named task.
 */
const BETA_RESTART_TASK = 'KioskBetaAutoRestart';
const BETA_RESTART_TIME = '09:00';
/** Beta's own Run value name, so it cannot clobber production's auto-start. */
const BETA_AUTORUN_KEY = 'KioskAppBeta';

function isWindows(): boolean {
  return process.platform === 'win32';
}

/** `HH:mm` for schtasks /st (zero-padded, 24h). */
function startTime(): string {
  const hh = String(RESTART_HOUR).padStart(2, '0');
  const mm = String(RESTART_MINUTE).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** The Run value name this build owns — never the other channel's. */
function autoRunKey(): string {
  return isBetaBuild() ? BETA_AUTORUN_KEY : AUTORUN_KEY;
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
      name: autoRunKey(),
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
    app.setLoginItemSettings({ openAtLogin: false, name: autoRunKey() });
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
 * Operating-hours kiosks: provision the venue's daily 종료/시작 power cycle and drop
 * the fleet-wide 2AM reboot. Idempotent (`/f`, `-Force`) — safe to run every launch.
 */
async function ensureOperatingHoursPowerCycle(cycle: PowerCycle): Promise<void> {
  if (!isWindows() || !app.isPackaged) return;
  // The 2AM reboot and the operating-hours cycle are mutually exclusive — make
  // sure a previously-provisioned reboot task can't also fire.
  await removeRestartTask();
  // Same for another venue's cycle (e.g. W008 before it moved to 00:00/06:00).
  for (const other of ALL_POWER_CYCLES) {
    if (other === cycle) continue;
    for (const task of [other.shutdownTask, other.startTask]) {
      await exec('schtasks', ['/delete', '/tn', task, '/f']).catch(() => {});
    }
  }
  try {
    // 종료 — full shutdown.
    await exec('schtasks', [
      '/create',
      '/tn', cycle.shutdownTask,
      '/tr', 'shutdown /s /f /t 0',
      '/sc', 'daily',
      '/st', cycle.shutdownTime,
      '/f',
    ]);
    // 시작 — a WakeToRun task (PowerShell, since schtasks can't set the wake
    // flag) that resumes the PC from sleep/hibernate and (re)launches the kiosk.
    //
    // Deliberately NO `-RunLevel Highest`: the kiosk app auto-starts UNELEVATED
    // (Electron login-item / HKCU Run key, no elevation manifest, perMachine:
    // false), and `Register-ScheduledTask -RunLevel Highest` fails with
    // "Access denied" for an unelevated caller — which the catch below then
    // swallowed, silently dropping the start task AND the powercfg call. Limited
    // level is enough to launch the exe and still honours WakeToRun, and matches
    // the fleet-wide 2AM reboot task (also Limited).
    const exePath = app.getPath('exe');
    const ps = [
      `$a=New-ScheduledTaskAction -Execute '${exePath}';`,
      `$t=New-ScheduledTaskTrigger -Daily -At '${cycle.startTime}';`,
      `$s=New-ScheduledTaskSettingsSet -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable;`,
      `Register-ScheduledTask -TaskName '${cycle.startTask}' -Action $a -Trigger $t -Settings $s -Force`,
    ].join(' ');
    await exec('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps]);
    // Allow wake timers so the start task can actually wake the machine.
    await exec('powercfg', ['-change', '-standby-timeout-ac', '0']).catch(() => {});
    log.info('Operating-hours power cycle scheduled', { start: cycle.startTime, shutdown: cycle.shutdownTime });
  } catch (error) {
    log.warn('Failed to schedule operating-hours power cycle', error);
  }
}

/**
 * BETA ONLY: a single daily reboot at 09:00. `/f` makes it idempotent, so every
 * launch just refreshes the existing task.
 *
 * Touches nothing production owns — see the BETA constants block above.
 */
async function ensureBetaRestartTask(): Promise<void> {
  if (!isWindows() || !app.isPackaged) return;
  try {
    await exec('schtasks', [
      '/create',
      '/tn', BETA_RESTART_TASK,
      '/tr', 'shutdown /r /f /t 0',
      '/sc', 'daily',
      '/st', BETA_RESTART_TIME,
      '/f',
    ]);
    log.info('Beta reboot scheduled', { task: BETA_RESTART_TASK, at: BETA_RESTART_TIME });
  } catch (error) {
    log.warn('Failed to schedule beta reboot', error);
  }
}

async function removeBetaRestartTask(): Promise<void> {
  if (!isWindows()) return;
  await exec('schtasks', ['/delete', '/tn', BETA_RESTART_TASK, '/f']).catch(() => {});
}

/**
 * True when the named Scheduled Task's action runs THIS build's exe — i.e. the
 * task was registered by this install and not by the other channel.
 *
 * `schtasks /query /xml` is the only channel-safe way to ask: a task name alone
 * says nothing about who wrote it. Used to retire tasks an OLDER beta build
 * created under the production names, without ever deleting production's.
 */
async function taskRunsThisBuild(task: string): Promise<boolean> {
  try {
    const { stdout } = await exec('schtasks', ['/query', '/tn', task, '/xml', 'ONE']);
    return stdout.toLowerCase().includes(app.getPath('exe').toLowerCase());
  } catch {
    // Task absent or unreadable — treat as "not ours" and leave it alone.
    return false;
  }
}

/**
 * One-time migration for beta boxes provisioned by an OLDER beta build, which
 * wrote the operating-hours pair under the production task names and so is
 * still shutting the machine down at 22:00 — the exact thing this change
 * removes for beta.
 *
 * ★ Only fires when `KioskStartAt8AM` provably launches the BETA exe. The two
 * tasks are always written together by `ensureOperatingHoursPowerCycle`, so a
 * beta-owned start task means the paired 22:00 shutdown is beta's too. If the
 * start task points at production's exe (or is absent) nothing is deleted —
 * production keeps its schedule untouched.
 *
 * `KioskAutoRestart` (the 02:00 reboot) is deliberately NOT cleaned up: its
 * action is a bare `shutdown /r`, identical for both channels, so there is no
 * way to prove it is beta's. A stale 02:00 reboot on a beta box is harmless —
 * the machine comes back up either way.
 */
async function retireLegacyBetaPowerCycle(): Promise<void> {
  if (!isWindows() || !app.isPackaged) return;
  // Older beta builds only ever wrote the 22:00/08:00 names.
  const legacy = STANDARD_HOURS_CYCLE;
  if (!(await taskRunsThisBuild(legacy.startTask))) return;
  for (const task of [legacy.startTask, legacy.shutdownTask]) {
    await exec('schtasks', ['/delete', '/tn', task, '/f']).catch(() => {});
  }
  log.info('Retired legacy beta-owned 22:00/08:00 power cycle', {
    replacedBy: BETA_RESTART_TASK,
    at: BETA_RESTART_TIME,
  });
}

/**
 * Same migration for the auto-start Run key: an older beta build registered
 * itself under production's `KioskApp` value, overwriting production's path.
 * Remove that entry only when it still points at the beta exe — production's
 * own entry, if present, is left alone and it re-registers on its next launch.
 */
function retireLegacyBetaAutoStart(): void {
  if (!isWindows() || !app.isPackaged) return;
  try {
    const exePath = app.getPath('exe');
    const stale = app
      .getLoginItemSettings({ path: exePath })
      .launchItems?.some(
        (item) =>
          item.name === AUTORUN_KEY && item.path?.toLowerCase() === exePath.toLowerCase(),
      );
    if (!stale) return;
    app.setLoginItemSettings({ openAtLogin: false, name: AUTORUN_KEY, path: exePath });
    log.info('Retired legacy beta entry under production Run key', { key: AUTORUN_KEY });
  } catch (error) {
    log.warn('Failed to retire legacy beta auto-start entry', error);
  }
}

async function removeOperatingHoursPowerCycle(): Promise<void> {
  if (!isWindows()) return;
  for (const cycle of ALL_POWER_CYCLES) {
    for (const task of [cycle.shutdownTask, cycle.startTask]) {
      await exec('schtasks', ['/delete', '/tn', task, '/f']).catch(() => {});
    }
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

  // ★ BETA (develop_1) branches FIRST and returns — the beta channel's power
  // schedule is a single 09:00 reboot regardless of which kioskId the test box
  // happens to be provisioned as, and nothing below this point may run for it.
  // Every production task/key name is left completely untouched.
  if (isBetaBuild()) {
    retireLegacyBetaAutoStart();
    await retireLegacyBetaPowerCycle();
    await ensureBetaRestartTask();
    return;
  }

  // Operating-hours kiosks (see OPERATING_HOURS_CYCLES) get their venue's 종료/시작
  // cycle; every other kiosk keeps the fleet-wide 2AM reboot.
  const cycle = kioskId != null ? OPERATING_HOURS_CYCLES[kioskId] : undefined;
  if (cycle) {
    await ensureOperatingHoursPowerCycle(cycle);
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
  // Each channel tears down only what it provisioned. A beta uninstall that
  // deleted the production task names would leave a production install on the
  // same machine with no reboot and no operating-hours cycle at all.
  if (isBetaBuild()) {
    await removeBetaRestartTask();
    return;
  }
  await removeRestartTask();
  await removeOperatingHoursPowerCycle();
}
