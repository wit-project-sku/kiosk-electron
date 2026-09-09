/**
 * Who this build says it is — and, through that, WHERE it keeps its data.
 *
 * ── The problem this solves ───────────────────────────────────────────
 * Production, beta and lab have to be installable on the SAME kiosk (the office
 * has one machine and every channel needs testing). The per-channel
 * electron-builder configs give each build its own `appId`, `productName` and
 * icon, which separates the installer, the install directory and the Start-menu
 * entry. They cannot separate the RUNTIME state: `userData` is resolved by
 * Electron at launch, and everything that makes a kiosk *that* kiosk lives
 * under it —
 *
 *   data/kiosk.db          the whole SQLite cache
 *   kiosk-config.json      the provisioned kioskId  ← two builds sharing this
 *   logs/ · media/         is what makes them one kiosk instead of two
 *   SingletonLock          the file `requestSingleInstanceLock()` takes
 *
 * Without this module a test install would adopt production's database and
 * kiosk identity, and — because the singleton lock is just a file in that same
 * directory — would exit on startup believing itself already running.
 *
 * ── Why this moves the path and does NOT rename the app ───────────────
 * ★ The obvious implementation is `app.setName('Kiosk App Beta')` early, since
 * `userData` derives from the app name. That is a FLEET-BREAKING change and was
 * tried first. Measured on a live machine (2026-08-27):
 *
 *   %APPDATA%\kiosk-app\   kiosk.db 13.8 MB, kiosk-config.json — written TODAY
 *   %APPDATA%\Kiosk App\   kiosk-config.json only — last written 2026-06-12
 *
 * The live directory is `kiosk-app`, i.e. package.json's `name`. The existing
 * `app.setName(APP_NAME)` call runs after `app.whenReady()`, and on Electron 34
 * `userData` is already resolved and cached by then — so it has NO effect on the
 * path and only ever set the display name. (The stale `Kiosk App` tree is a
 * fossil from an older Electron where it did move.)
 *
 * Hoisting that call above `whenReady()` to make it work for a test channel
 * would ALSO make it work for production, relocating every deployed kiosk from
 * `kiosk-app` to `Kiosk App` on the next auto-update: fresh empty database,
 * unprovisioned kioskId, lost logs, across the whole fleet.
 *
 * So production is left EXACTLY as it is — no early `setName`, same
 * `kiosk-app` directory it has always used — and only the test builds are
 * redirected, with an explicit `setPath` that states the directory outright
 * instead of deriving it from a name. Nothing about the production path depends
 * on this file.
 *
 * ── Ordering ──────────────────────────────────────────────────────────
 * `applyAppIdentity()` must be called at module scope in index.ts:
 *   · AFTER  `loadEnvFile()`      — the channel comes from the packaged .env
 *   · BEFORE `initLogger()`       — electron-log resolves its file path on the
 *                                   first write, and initLogger's own banner
 *                                   line is that write
 *   · BEFORE `enforceSingleInstance()` — the lock file lives in `userData`
 *   · BEFORE `app.whenReady()`    — after ready, `setPath` is too late to move
 *                                   anything Chromium has already opened
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { electronApp } from '@electron-toolkit/utils';
import { APP_ID } from '@shared/constants';
import type { UpdateChannel } from '@shared/types/update';
import { resolveUpdateChannel } from '@main/updater/updateChannel';

interface ChannelIdentity {
  /** The `%APPDATA%` tree — a sibling of production's `kiosk-app`, named so the
   *  installs sort next to each other when someone is hunting for a log file. */
  userDataDir: string;
  /** Appended to APP_ID for the AppUserModelID. MUST match `appId` in the
   *  matching electron-builder config, or Windows groups the taskbar button and
   *  the toast notifications under an application that is not the one running. */
  appIdSuffix: string;
  /** Suffix on the window/process display name. Cosmetic only. */
  displaySuffix: string;
}

/**
 * The side-by-side identity of each non-production channel.
 *
 * `latest` is deliberately absent: production takes NO redirection at all, which
 * is what guarantees the deployed fleet keeps its existing `kiosk-app` tree.
 * Adding a channel is adding a row here plus an `electron-builder.<ch>.yml`.
 */
const CHANNEL_IDENTITY: Record<Exclude<UpdateChannel, 'latest'>, ChannelIdentity> = {
  beta: { userDataDir: 'kiosk-app-beta', appIdSuffix: '.beta', displaySuffix: 'Beta' },
  lab: { userDataDir: 'kiosk-app-lab', appIdSuffix: '.lab', displaySuffix: 'Lab' },
};

/**
 * `buildChannel` from the PACKAGED package.json, written by the per-channel
 * electron-builder config's `extraMetadata`. Empty for a production build and
 * in dev, where the repo's package.json carries no such field.
 *
 * Read from `app.getAppPath()` so it resolves inside the asar when packaged.
 * Synchronous and once — this runs before the window exists.
 */
function packagedBuildChannel(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf8')) as {
      buildChannel?: unknown;
    };
    return typeof pkg.buildChannel === 'string' ? pkg.buildChannel.trim().toLowerCase() : '';
  } catch {
    // A missing or unreadable package.json is not worth failing startup over;
    // UPDATE_CHANNEL below still answers.
    return '';
  }
}

/**
 * Which channel's identity this process should wear.
 *
 * ★ The BUILD decides first, the `.env` only second. `buildChannel` is stamped
 * in by the per-channel electron-builder config and cannot drift;
 * `UPDATE_CHANNEL` is shipped config that can. Keying identity off the env alone
 * meant a local `npm run build:win:beta` against a developer .env reading
 * `UPDATE_CHANNEL=latest` would install under the beta name and icon while
 * `setPath` stayed silent — so both apps would share production's kiosk.db and
 * its singleton lock, which is the exact failure this module exists to prevent.
 *
 * UPDATE_CHANNEL is kept as the fallback so `npm run dev` can still exercise a
 * test-channel path without packaging anything.
 */
export function resolveBuildChannel(): UpdateChannel {
  const stamped = packagedBuildChannel();
  if (stamped && stamped in CHANNEL_IDENTITY) return stamped as UpdateChannel;
  return resolveUpdateChannel();
}

/** True when this build carries a side-by-side (non-production) identity. */
export const isSideBySideBuild = (): boolean => resolveBuildChannel() !== 'latest';

/**
 * Point this process at its own state directory, and tell Windows which app it
 * is. Call ONCE, first thing in the main entry point — see the ordering note.
 *
 * A production build is a no-op apart from the AppUserModelID it already set.
 *
 * Returns what it resolved, so a support ticket can say which of the installs
 * produced the log it is quoting.
 */
export function applyAppIdentity(): {
  appId: string;
  userData: string;
  channel: UpdateChannel;
  sideBySide: boolean;
} {
  const channel = resolveBuildChannel();
  const identity = channel === 'latest' ? null : CHANNEL_IDENTITY[channel];

  if (identity) {
    // `appData` is %APPDATA% (roaming) — the parent Electron would have used
    // anyway, so a test build lands beside production rather than somewhere new.
    app.setPath('userData', join(app.getPath('appData'), identity.userDataDir));
  }

  const appId = identity ? `${APP_ID}${identity.appIdSuffix}` : APP_ID;
  electronApp.setAppUserModelId(appId);

  return { appId, userData: app.getPath('userData'), channel, sideBySide: identity !== null };
}

/**
 * The window/process display name, applied after `whenReady()` exactly where it
 * always was. Cosmetic ONLY: by this point `userData` is fixed, which is
 * precisely why it is safe to vary it per channel.
 */
export function appDisplayName(baseName: string): string {
  const channel = resolveBuildChannel();
  return channel === 'latest' ? baseName : `${baseName} ${CHANNEL_IDENTITY[channel].displaySuffix}`;
}
