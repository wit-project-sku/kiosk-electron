// Runs the 키 측정 sidecar the same way the app does.
//
//   node scripts/height-run.mjs --selftest
//   node scripts/height-run.mjs --calibrate
//
// Exists because getting either of these wrong by hand is easy and the failure
// is confusing:
//
//   THE INTERPRETER. Bare `python` on a developer machine is routinely some
//   unrelated tool's venv, and the only symptom is
//   "ModuleNotFoundError: numpy". This resolves it exactly as
//   ZedSidecarManager does — HEIGHT_PYTHON, then a .venv beside the sidecar,
//   then PATH — so a script and the running app can never disagree about which
//   Python holds pyzed.
//
//   THE CALIBRATION PATH. The sidecar defaults to ./calibration.json, but the
//   app reads it from userData. Calibrating by hand therefore appeared to
//   succeed while the app went on seeing nothing. This points HEIGHT_CALIBRATION
//   at the path the app actually reads.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIDECAR = join(ROOT, 'zed-height');

/** Same order as ZedSidecarManager.pythonPath(). Keep the two in step. */
function pythonPath() {
  if (process.env.HEIGHT_PYTHON) return process.env.HEIGHT_PYTHON;
  const venv =
    process.platform === 'win32'
      ? join(SIDECAR, '.venv', 'Scripts', 'python.exe')
      : join(SIDECAR, '.venv', 'bin', 'python');
  if (existsSync(venv)) return venv;
  return 'python';
}

/** Where the app reads the floor calibration from — under userData, so it
 *  survives an auto-update replacing the install directory. Must match
 *  ZedSidecarManager's HEIGHT_CALIBRATION and provision-zed.ps1. */
function calibrationPath() {
  if (process.env.HEIGHT_CALIBRATION) return process.env.HEIGHT_CALIBRATION;
  const appData = process.env.APPDATA ?? join(process.env.HOME ?? '.', '.config');
  return join(appData, 'kiosk-app', 'zed-height', 'calibration.json');
}

const python = pythonPath();
const calibration = calibrationPath();
mkdirSync(dirname(calibration), { recursive: true });

console.log(`[height] python      ${python}`);
console.log(`[height] calibration ${calibration}\n`);

const args = process.argv.slice(2);
// `--pytest` runs the measurement suite instead of the sidecar. It needs the
// same interpreter for the same reason everything else here does, so it is
// routed through this launcher rather than calling `python` directly.
const spawnArgs =
  args[0] === '--pytest' ? ['-m', 'pytest', 'tests', '-q', ...args.slice(1)] : ['-u', 'main.py', ...args];

const child = spawn(python, spawnArgs, {
  cwd: SIDECAR,
  env: { ...process.env, HEIGHT_CALIBRATION: calibration, PYTHONIOENCODING: 'utf-8' },
  stdio: 'inherit',
});

child.on('error', (err) => {
  console.error(`[height] could not start ${python}: ${err.message}`);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 1));
