// Windows build with a structured artifact name:
//   Build_<BUILD_VER>_<buildDate>_v<appVersion>_<KIOSK_LOC>_<CHANNEL>_<RELEASE_DATE>.exe
//   e.g. Build_V4_20260430_v5.0.5_북인사_live_2026.05.01.exe
//
// Auto: build date (YYYYMMDD) and app version (from package.json, via
// electron-builder's ${version}). The label tokens default below and can be
// overridden by setting env vars before running, e.g. (PowerShell):
//   $env:BUILD_VER='V4'; $env:KIOSK_LOC='북인사'; $env:RELEASE_DATE='2026.05.01'; npm run build:win
//
// Channel selection:
//   npm run build:win           production identity (electron-builder.yml)
//   npm run build:win:beta      beta identity       (--beta / BUILD_CHANNEL=beta)
//   npm run build:win:lab       lab identity        (--lab  / BUILD_CHANNEL=lab)
//
// Runs the normal pipeline: typecheck + electron-vite build, then electron-builder --win.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const now = new Date();
const p = (n) => String(n).padStart(2, '0');
const ymd = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
const ymdDot = `${now.getFullYear()}.${p(now.getMonth() + 1)}.${p(now.getDate())}`;

// Every non-production channel: its electron-builder config (the side-by-side
// identity — own appId, productName, icon and %APPDATA% tree, so it installs
// next to production rather than over it) and the filename label it stamps into
// the artifact name. Production is the absent default.
const CHANNELS = {
  beta: { config: 'electron-builder.beta.yml', label: 'beta' },
  lab: { config: 'electron-builder.lab.yml', label: 'lab' },
};

// A flag rather than an env var so the npm scripts work in PowerShell and bash
// alike without pulling in cross-env; BUILD_CHANNEL is honoured too because that
// is the shape CI finds convenient.
const channel =
  Object.keys(CHANNELS).find((c) => process.argv.includes(`--${c}`)) ??
  (Object.keys(CHANNELS).includes((process.env.BUILD_CHANNEL || '').toLowerCase())
    ? process.env.BUILD_CHANNEL.toLowerCase()
    : null);

// Labels: honour any pre-set env var, else fall back to sensible defaults.
const env = {
  ...process.env,
  BUILD_VER: process.env.BUILD_VER || 'V1',
  BUILD_DATE: process.env.BUILD_DATE || ymd, // build day, auto
  KIOSK_LOC: process.env.KIOSK_LOC || 'insadong',
  CHANNEL: process.env.CHANNEL || (channel ? CHANNELS[channel].label : 'live'),
  RELEASE_DATE: process.env.RELEASE_DATE || ymdDot, // release/upload day, defaults to today
};

console.log(
  `[build-win] Build_${env.BUILD_VER}_${env.BUILD_DATE}_v<version>_${env.KIOSK_LOC}_${env.CHANNEL}_${env.RELEASE_DATE}.exe`,
);

const config = channel ? ` --config ${CHANNELS[channel].config}` : '';
if (channel) console.log(`[build-win] ${channel} identity: witworldwide-${channel}`);

// The IDENTITY is safe either way — electron-builder.<channel>.yml stamps
// `buildChannel: <channel>` into the packaged package.json, so the app redirects
// its userData regardless of what .env says. The update FEED is not: a test
// build shipping UPDATE_CHANNEL=latest reads latest.yml and would "update"
// itself onto production the first time it checks. CI cannot hit this (it
// force-writes the channel from the same input that picks the config); a local
// build can.
if (channel) {
  const dotenv = readFileSync('.env', 'utf8').match(/^UPDATE_CHANNEL=(.*)$/m)?.[1]?.trim();
  if (dotenv !== channel) {
    console.warn(
      [
        '',
        `[build-win] WARNING: .env has UPDATE_CHANNEL=${dotenv ?? '(unset)'}, not "${channel}".`,
        `            This installer carries the ${channel.toUpperCase()} identity but checks a`,
        '            DIFFERENT update feed, so it will replace itself with that',
        "            channel's build on its first update check.",
        `            Set UPDATE_CHANNEL=${channel} in .env before putting it on a kiosk.`,
        '',
      ].join('\n'),
    );
  }
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit', env });
run('npm run build'); // typecheck + electron-vite build
run(`electron-builder --win${config}`);
