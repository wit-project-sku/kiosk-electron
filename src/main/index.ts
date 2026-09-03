/**
 * Main process entry point.
 *
 * Orchestrates startup in a strict, fail-fast order:
 *   logger -> single-instance lock -> privileged scheme -> app ready ->
 *   media protocol -> database + migrations -> container -> windows -> IPC.
 *
 * Shutdown reverses the resource-owning steps: dispose window listeners, then
 * checkpoint and close the database.
 */

import { app, BrowserWindow, protocol } from 'electron';
import { optimizer } from '@electron-toolkit/utils';
import { APP_NAME } from '@shared/constants';
import { IpcEvents } from '@shared/ipc/channels';
import { initLogger, createLogger } from './core/logger';
import { loadEnvFile } from './core/env';
import { enforceSingleInstance, suppressEmbedAuthDialog } from './core/security';
import { applyAppIdentity, appDisplayName } from './core/appIdentity';
import { MEDIA_SCHEME_PRIVILEGES, registerMediaProtocol } from './core/mediaProtocol';
import {
  APP_RESOURCE_SCHEME_PRIVILEGES,
  registerAppResourceProtocol,
} from './core/appResourceProtocol';
import { setupKioskPower } from './core/PowerManager';
import { PaymentAgentManager } from './core/PaymentAgentManager';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { database } from './database/Database';
import { createContainer, getContainer } from './container';
import { WindowManager } from './windows/WindowManager';
import { languageStore } from './core/LanguageStore';
import { registerIpcHandlers } from './ipc/registerIpc';
import type { AppContainer } from './container';
import {
  DEFAULT_CLOTHING_OPTIONS,
  DEFAULT_STYLE_OPTIONS,
} from '@shared/constants/photoOptions';

/** Ensures cached kiosk content exists locally before first paint. */
// test:seedLocalContent
function seedLocalContent(container: AppContainer): void {
  const { kioskId, layout } = container.kiosk.getConfig();

  if (!container.cache.get('home')) {
    const titles: Record<string, { title: string; subtitle: string }> = {
      W001: { title: '북인사마당', subtitle: '전통과 현대가 어우러진 인사동' },
      W002: { title: '인사동센터', subtitle: '인사동 관광 안내 센터' },
      W003: { title: '남인사마당', subtitle: '남인사동 문화 거리' },
    };
    const copy = titles[kioskId] ?? titles['W001']!;
    container.cache.upsert(
      'home',
      { title: copy.title, subtitle: copy.subtitle, body: '버튼을 눌러 안내를 시작하세요.' },
      'seed',
    );
  }

  const screenKeys =
    layout === 'NAM_INSADONG'
      ? ['intro', 'food', 'shopping', 'culture']
      : ['intro', 'guide', 'events', 'facilities'];

  for (const key of screenKeys) {
    if (!container.cache.get(key)) {
      container.cache.upsert(key, { title: key, body: '콘텐츠가 곧 업데이트됩니다.' }, 'seed');
    }
  }

  if (!container.cache.get('photo_clothing')) {
    container.cache.upsert('photo_clothing', { options: DEFAULT_CLOTHING_OPTIONS }, 'seed');
  }
  if (!container.cache.get('photo_styles')) {
    container.cache.upsert('photo_styles', { options: DEFAULT_STYLE_OPTIONS }, 'seed');
  }
}

// Give Chromium a 512 MB disk cache so embedded web screens (WITStore, events,
// taxfree) are served from disk on repeat visits instead of the network.
// Must be set before app.whenReady().
app.commandLine.appendSwitch('disk-cache-size', '536870912');

loadEnvFile();

// ★ IDENTITY BEFORE EVERYTHING — before the logger, before the lock, before
// whenReady. On a BETA build this repoints `userData`, and that directory holds
// kiosk.db, the provisioned kioskId, the log file and the SingletonLock taken
// below. Beta installs alongside production (electron-builder.beta.yml), so
// anything resolving `userData` ahead of this line would land in production's
// tree — and beta would then exit on startup, having found "itself" running.
//
// It sits above `initLogger()` because electron-log resolves its file path on
// the FIRST WRITE and initLogger's own banner line is that write. Only
// `loadEnvFile()` must precede it, for UPDATE_CHANNEL.
//
// A PRODUCTION build is unaffected: it keeps the `kiosk-app` directory it has
// always used. See core/appIdentity.ts for why that matters.
const identity = applyAppIdentity();

initLogger();
const log = createLogger('main');
log.info('App identity', identity);

let windowManager: WindowManager | null = null;
const paymentAgent = new PaymentAgentManager();

// A kiosk must be a singleton; focus the existing window on a second launch.
const hasLock = enforceSingleInstance(() => windowManager?.focusMain());
if (!hasLock) {
  log.warn('Another instance is already running; exiting.');
} else {
  // ONE call, every custom scheme — Electron honours only the first.
  protocol.registerSchemesAsPrivileged([
    MEDIA_SCHEME_PRIVILEGES,
    APP_RESOURCE_SCHEME_PRIVILEGES,
  ]);
  void bootstrap();
}

async function bootstrap(): Promise<void> {
  await app.whenReady();

  // Display name only — `userData` was already fixed by applyAppIdentity(), so
  // varying this per channel is safe. "Kiosk App Beta" is what a support ticket
  // and the window title report on a side-by-side install.
  app.setName(appDisplayName(APP_NAME));

  // F12 toggles devtools in dev; ignored in production builds.
  app.on('browser-window-created', (_event, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerMediaProtocol();
  registerAppResourceProtocol();
  suppressEmbedAuthDialog();

  try {
    database.init();
  } catch (error) {
    log.error('Fatal: database initialization failed', error);
    app.quit();
    return;
  }

  const container = createContainer();

  // Provision OS-level kiosk power behavior + auto-start on boot so the fleet
  // self-heals without anyone running the .bat helpers. Osaek (W004) gets an
  // 08:00 시작 / 22:00 종료 cycle; every other kiosk keeps the 02:00 reboot.
  // Best-effort: never blocks or fails startup.
  void setupKioskPower(container.kiosk.getConfig().kioskId);

  // Seed rarely-changing config and local content before windows open so the
  // renderer renders instantly from injected bootstrap data — no network, no spinners.
  container.templates.ensureSeeded();
  seedLocalContent(container);
  // Refresh the shop catalogue at every midnight sync too (not just on launch),
  // then tell the renderer to reload its store.
  container.sync.addNightTask(() =>
    container.shops.refresh().then(() => {
      windowManager?.broadcast(IpcEvents.ShopsChanged, null);
    }),
  );
  // 제주 관광명소 is catalogue content on the same footing as the shops above, so
  // it rides the same nightly refresh rather than waiting for a reboot.
  container.sync.addNightTask(() =>
    container.attractions.refresh().then(() => {
      windowManager?.broadcast(IpcEvents.AttractionsChanged, null);
    }),
  );
  // Banners are date-windowed promo content, so refresh them at the nightly sync
  // too (unlike the home button layout) — a same-day CMS change then appears
  // without waiting for the next reboot.
  container.sync.addNightTask(() =>
    container.banners.refresh().then(() => {
      windowManager?.broadcast(IpcEvents.BannersChanged, null);
    }),
  );
  // The AR 배경 테마 set is operator-swappable CMS content like the banners, so
  // it refreshes nightly too — a background retired today disappears from the
  // 제주 outfit screen without waiting for the next reboot.
  container.sync.addNightTask(() =>
    container.backgrounds.refresh().then(async () => {
      // Mirror the tiles BEFORE telling the renderer, so the reload it triggers
      // already reads local files instead of re-fetching every one. Nothing is
      // on screen at 02:00, so there is no reason to show the set early here.
      await container.backgrounds.cacheImages();
      windowManager?.broadcast(IpcEvents.BackgroundsChanged, null);
    }),
  );
  // The outfit catalogue is CMS content an operator edits during the day, so it
  // refreshes nightly like the banners — a new outfit appears on the picker
  // without a rebuild, which is the whole point of moving it off the bundle.
  container.sync.addNightTask(() =>
    container.outfits.refresh().then(async () => {
      await container.outfits.cacheImages();
      windowManager?.broadcast(IpcEvents.OutfitsChanged, null);
    }),
  );
  // Waiting-game rounds are rotating promo-ish content like the banners, so they
  // refresh nightly too — a new round set goes live without a reboot.
  container.sync.addNightTask(() => container.spotDiff.refresh().then(() => undefined));
  container.sync.start();

  windowManager = new WindowManager(container);
  registerIpcHandlers(container, windowManager);
  // Every launch starts in Korean; the visitor's in-session choice is cleared on
  // the next restart or idle timeout (see useKioskController.handleIdle).
  languageStore.set('ko');
  windowManager.bootstrap();

  // Begin weather polling after the window subscription is wired so the first
  // refresh is broadcast to the renderer.
  container.weather.start();
  container.flights.start();
  container.sailings.start();
  container.exchange.start();
  container.subtitles.start();

  // Launch the embedded payment agent ONLY on kiosks with a physical card
  // terminal (hasCardTerminal — W003 남인사마당 / W004 오색시장 / W005 화성휴게소).
  // Runs as an isolated child process; best-effort.
  if (getKioskLocation(container.kiosk.getConfig().kioskId).hasCardTerminal) {
    paymentAgent.start();
  }

  // Background auto-update (electron-updater + GitHub Releases). Packaged builds
  // only. Production checks on a weekly maintenance window (UPDATE_DAY/UPDATE_TIME,
  // with missed-window catch-up on startup); beta polls every few minutes.
  // Downloads in the background, and restarts to install only while the kiosk is
  // idle (never mid photo/payment) — nightly reboot is the guaranteed fallback.
  // Channel + schedule come from UPDATE_CHANNEL / UPDATE_* (see .env).
  // Block a restart ONLY during the phases where it would destroy work the
  // customer can't get back: `countdown` (about to shoot) and `generating` (AI
  // is processing their photo). Browsing phases and a parked `result` screen do
  // NOT block — the workflow only returns to `idle` when the renderer calls
  // `photo:reset`, so a customer who walks away mid-flow would otherwise leave
  // the phase non-idle forever and defer the install indefinitely.
  container.updater.setBusyCheck(() => {
    const { phase } = container.photoWorkflow.getState();
    return phase === 'countdown' || phase === 'generating';
  });
  container.updater.start();
  // Second, operator-initiated trigger: polls the witteria API for an "update
  // now" timestamp set from the admin site, and forces an immediate check when
  // it sees a newer one. Independent of — and does not disturb — the weekly
  // window above. Install is still gated on the same idle check.
  container.updateCommands.start();

  // 유동인구 counting. Started after the window subscription is wired so the
  // renderer's counting loop receives the first runtime broadcast, and after the
  // photo workflow exists so a capture already in progress at boot (there never
  // is one, but the ordering should not depend on that) suppresses it. The
  // camera pipeline itself lives in the renderer; this half owns the counts.
  container.footfall.start();
  // Pushes the day's counts at 21:30 local. With no FOOTFALL_API_URL configured
  // it is a no-op that keeps the rows pending — pointing it at a real endpoint
  // later uploads the whole backlog on the first night.
  container.footfallUploader.start();

  // 키 측정 — the headless ZED height sidecar. 제주 only; the service checks the
  // layout itself and does nothing anywhere else, so there is no condition here
  // to keep in sync with one inside it. Best-effort in every direction: a
  // missing ZED SDK, an unplugged camera or a crashed child costs a null height
  // and never touches the photo flow.
  container.height.start();
  // 키 측정 rows are one per capture, so unlike 유동인구's hourly buckets they grow
  // with how busy the kiosk is. Pruned on the same 02:00 pass that refreshes
  // content, rather than on a scheduler of its own.
  container.sync.addNightTask(() => container.height.pruneOldMeasurements());

  // Refresh sheet content into SQLite in the background on every launch (in
  // addition to the 02:00 night sync). The current window already rendered from
  // the last-synced/bundled data; the next bootstrap picks up these results.
  void container.sync.syncContentNow();
  // Refresh the shop catalogue from the witteria API into SQLite (background),
  // then tell the renderer to reload — fixes empty data on the very first launch
  // (cache is empty until this first fetch completes).
  void container.shops.refresh().then(() => {
    windowManager?.broadcast(IpcEvents.ShopsChanged, null);
  });
  // Same for 제주's 관광명소 catalogue — without this the tab is empty on a
  // machine's very first launch, since the SQLite cache starts out empty.
  void container.attractions.refresh().then(() => {
    windowManager?.broadcast(IpcEvents.AttractionsChanged, null);
  });
  // Refresh the home button layout from the witteria API into SQLite (background),
  // then tell the renderer to reload. Deliberately NOT added to the nightly sync:
  // the layout is only re-fetched when the app is closed and reopened, otherwise
  // it serves the last-cached layout (offline-safe).
  void container.buttons.refresh().then(() => {
    windowManager?.broadcast(IpcEvents.ButtonsChanged, null);
  });
  // Refresh the bottom promo banners from the witteria API into SQLite
  // (background), then tell the renderer to reload — fixes empty banners on the
  // very first launch (cache is empty until this first fetch completes).
  void container.banners.refresh().then(() => {
    windowManager?.broadcast(IpcEvents.BannersChanged, null);
  });
  // Refresh the AR 배경 테마 set from the witteria API into SQLite (background),
  // then tell the renderer to reload — same first-launch reason as the banners.
  void container.backgrounds.refresh().then(async () => {
    // Broadcast FIRST at boot, then mirror: the picker should open on whatever
    // is already known rather than wait behind a download. The second broadcast
    // swaps the tiles onto local files once they land, and costs the renderer
    // only a re-read of SQLite.
    windowManager?.broadcast(IpcEvents.BackgroundsChanged, null);
    await container.backgrounds.cacheImages();
    windowManager?.broadcast(IpcEvents.BackgroundsChanged, null);
  });
  // 틀린그림찾기 rounds for the AR 한복 waiting game. No broadcast: the renderer
  // asks for a round when a photo session starts, not at boot, so a late arrival
  // here is picked up by the next session on its own.
  void container.spotDiff.refresh();
  // The outfit catalogue, on the other hand, IS on screen as soon as someone
  // taps AR 한복체험, so the renderer is told when it lands.
  void container.outfits.refresh().then(async () => {
    windowManager?.broadcast(IpcEvents.OutfitsChanged, null);
    await container.outfits.cacheImages();
    windowManager?.broadcast(IpcEvents.OutfitsChanged, null);
  });

  app.on('activate', () => {
    // macOS: re-open a window when the dock icon is clicked.
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager?.bootstrap();
    }
  });

  log.info('Application ready');
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  log.info('Shutting down');
  paymentAgent.stop();
  try {
    getContainer().sync.stop();
    getContainer().weather.stop();
    getContainer().exchange.stop();
    getContainer().updater.stop();
    getContainer().updateCommands.stop();
    // Persists whatever the last minute counted; without this, a nightly reboot
    // would drop up to a minute of 유동인구 every single night.
    getContainer().footfall.stop();
    getContainer().footfallUploader.stop();
    // Kills the Python child. Without this it outlives the app and keeps the
    // ZED open, so the next launch cannot claim the camera.
    getContainer().height.stop();
  } catch {
    // Container may not exist if startup failed; ignore.
  }
  windowManager?.dispose();
  database.close();
});

// Last-resort safety nets; electron-log also captures these.
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception', error);
});
process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection', reason);
});
