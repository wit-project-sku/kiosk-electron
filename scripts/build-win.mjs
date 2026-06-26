// Windows build with a structured artifact name:
//   Build_<BUILD_VER>_<buildDate>_v<appVersion>_<KIOSK_LOC>_<CHANNEL>_<RELEASE_DATE>.exe
//   e.g. Build_V4_20260430_v5.0.5_북인사_live_2026.05.01.exe
//
// Auto: build date (YYYYMMDD) and app version (from package.json, via
// electron-builder's ${version}). The label tokens default below and can be
// overridden by setting env vars before running, e.g. (PowerShell):
//   $env:BUILD_VER='V4'; $env:KIOSK_LOC='북인사'; $env:RELEASE_DATE='2026.05.01'; npm run build:win
//
// Runs the normal pipeline: typecheck + electron-vite build, then electron-builder --win.

import { execSync } from 'node:child_process';

const now = new Date();
const p = (n) => String(n).padStart(2, '0');
const ymd = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
const ymdDot = `${now.getFullYear()}.${p(now.getMonth() + 1)}.${p(now.getDate())}`;

// Labels: honour any pre-set env var, else fall back to sensible defaults.
const env = {
  ...process.env,
  BUILD_VER: process.env.BUILD_VER || 'V1',
  BUILD_DATE: process.env.BUILD_DATE || ymd, // build day, auto
  KIOSK_LOC: process.env.KIOSK_LOC || 'insadong',
  CHANNEL: process.env.CHANNEL || 'live',
  RELEASE_DATE: process.env.RELEASE_DATE || ymdDot, // release/upload day, defaults to today
};

console.log(
  `[build-win] Build_${env.BUILD_VER}_${env.BUILD_DATE}_v<version>_${env.KIOSK_LOC}_${env.CHANNEL}_${env.RELEASE_DATE}.exe`,
);

const run = (cmd) => execSync(cmd, { stdio: 'inherit', env });
run('npm run build'); // typecheck + electron-vite build
run('electron-builder --win');
