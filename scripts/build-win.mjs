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
import { readFileSync } from 'node:fs';

const now = new Date();
const p = (n) => String(n).padStart(2, '0');
const ymd = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
const ymdDot = `${now.getFullYear()}.${p(now.getMonth() + 1)}.${p(now.getDate())}`;

const buildChannelEnv = (process.env.BUILD_CHANNEL || '').toLowerCase();
const isBeta = process.argv.includes('--beta') || buildChannelEnv === 'beta';
const isDemo = !isBeta && (process.argv.includes('--demo') || buildChannelEnv === 'demo');
/** The side-by-side channel this build carries, or '' for production. */
const sideChannel = isBeta ? 'beta' : isDemo ? 'demo' : '';

// Labels: honour any pre-set env var, else fall back to sensible defaults.
const env = {
  ...process.env,
  BUILD_VER: process.env.BUILD_VER || 'V1',
  BUILD_DATE: process.env.BUILD_DATE || ymd, // build day, auto
  KIOSK_LOC: process.env.KIOSK_LOC || 'insadong',
  CHANNEL: process.env.CHANNEL || sideChannel || 'live',
  RELEASE_DATE: process.env.RELEASE_DATE || ymdDot, // release/upload day, defaults to today
};

console.log(
  `[build-win] Build_${env.BUILD_VER}_${env.BUILD_DATE}_v<version>_${env.KIOSK_LOC}_${env.CHANNEL}_${env.RELEASE_DATE}.exe`,
);

// BUILD_CHANNEL=beta builds the side-by-side beta identity (own appId,
// productName, icon and %APPDATA% tree) so it can be installed next to a
// production kiosk on the same machine. See electron-builder.beta.yml.
// `--beta` (or BUILD_CHANNEL=beta, which is what CI sets) selects the
// side-by-side identity. A flag rather than an env var so the npm script
// works in PowerShell and bash alike without pulling in cross-env.
// `--demo` (or BUILD_CHANNEL=demo) does the same for the office showroom build,
// see electron-builder.demo.yml.
const config = sideChannel ? ` --config electron-builder.${sideChannel}.yml` : '';
if (sideChannel) console.log(`[build-win] ${sideChannel} identity: witworldwide-${sideChannel}`);

// The IDENTITY is safe either way — electron-builder.<channel>.yml stamps
// `buildChannel` into the packaged package.json, so the app redirects its
// userData regardless of what .env says. The update FEED is not: a beta/demo
// build shipping UPDATE_CHANNEL=latest reads latest.yml and would "update"
// itself onto production the first time it checks. CI cannot hit this (it
// force-writes the channel from the same input that picks the config); a local
// build can. Demo also needs DEV_MODE=true, or it has no location switcher.
if (sideChannel) {
  const dotenvText = readFileSync('.env', 'utf8');
  const dotenv = dotenvText.match(/^UPDATE_CHANNEL=(.*)$/m)?.[1]?.trim();
  if (dotenv !== sideChannel) {
    console.warn(
      [
        '',
        `[build-win] WARNING: .env has UPDATE_CHANNEL=${dotenv ?? '(unset)'}, not "${sideChannel}".`,
        `            This installer carries the ${sideChannel.toUpperCase()} identity but checks`,
        '            another update feed, so it will replace itself with that',
        '            build on its first update check.',
        `            Set UPDATE_CHANNEL=${sideChannel} in .env before putting it on a kiosk.`,
        '',
      ].join('\n'),
    );
  }
  const devMode = dotenvText.match(/^DEV_MODE=(.*)$/m)?.[1]?.trim().toLowerCase();
  if (isDemo && devMode !== 'true') {
    console.warn('[build-win] WARNING: .env lacks DEV_MODE=true — the demo build will have no location switcher.');
  }
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit', env });
run('npm run build'); // typecheck + electron-vite build
run(`electron-builder --win${config}`);
