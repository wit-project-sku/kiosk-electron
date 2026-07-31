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

import { app, BrowserWindow } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { APP_NAME } from '@shared/constants';
import { IpcEvents } from '@shared/ipc/channels';
import { initLogger, createLogger } from './core/logger';
import { loadEnvFile } from './core/env';
import { enforceSingleInstance, suppressEmbedAuthDialog } from './core/security';
import { registerMediaScheme, registerMediaProtocol } from './core/mediaProtocol';
import { setupKioskPower } from './core/PowerManager';
import { PaymentAgentManager } from './core/PaymentAgentManager';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { database } from './database/Database';
import { createContainer, getContainer } from './container';
import { WindowManager } from './windows/WindowManager';
import { registerIpcHandlers } from './ipc/registerIpc';
import type { AppContainer } from './container';
import {
  DEFAULT_CLOTHING_OPTIONS,
  DEFAULT_STYLE_OPTIONS,
} from '@shared/constants/photoOptions';

/** Ensures cached kiosk content exists locally before first paint. */
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
initLogger();
const log = createLogger('main');

let windowManager: WindowManager | null = null;
const paymentAgent = new PaymentAgentManager();

// A kiosk must be a singleton; focus the existing window on a second launch.
const hasLock = enforceSingleInstance(() => windowManager?.focusMain());
if (!hasLock) {
  log.warn('Another instance is already running; exiting.');
} else {
  registerMediaScheme();
  void bootstrap();
}

async function bootstrap(): Promise<void> {
  await app.whenReady();

  electronApp.setAppUserModelId('com.kioskapp.desktop');
  app.setName(APP_NAME);

  // F12 toggles devtools in dev; ignored in production builds.
  app.on('browser-window-created', (_event, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerMediaProtocol();
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
  // Banners are date-windowed promo content, so refresh them at the nightly sync
  // too (unlike the home button layout) — a same-day CMS change then appears
  // without waiting for the next reboot.
  container.sync.addNightTask(() =>
    container.banners.refresh().then(() => {
      windowManager?.broadcast(IpcEvents.BannersChanged, null);
    }),
  );
  container.sync.start();

  windowManager = new WindowManager(container);
  registerIpcHandlers(container, windowManager);
  windowManager.bootstrap();

  // Begin weather polling after the window subscription is wired so the first
  // refresh is broadcast to the renderer.
  container.weather.start();
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
  container.updater.setBusyCheck(() => container.photoWorkflow.getState().phase !== 'idle');
  container.updater.start();

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
