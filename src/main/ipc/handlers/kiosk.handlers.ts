import { app, dialog } from 'electron';
import { is } from '@electron-toolkit/utils';
import { IpcChannels, IpcEvents } from '@shared/ipc/channels';
import { KIOSK_LOCATIONS } from '@shared/config/kioskLocations';
import type { WindowManager } from '@main/windows/WindowManager';
import type { AppContainer } from '@main/container';
import { AppError } from '@main/core/AppError';
import { createLogger } from '@main/core/logger';
import { isDevMode } from '@main/core/env';
import { kioskConfigStore } from '@main/core/KioskConfigStore';
import { planSiteSwitch } from '@shared/config/testRig';
import {
  SETUP_SITES,
  setupConfirmText,
  withoutSetupArg,
  type SetupSite,
} from '@shared/config/kioskSetup';
import { handle } from '../registry';

const log = createLogger('kiosk-switch');

/**
 * Restart the app as the newly-persisted kiosk (packaged builds).
 *
 * Two things must happen in this exact order or the relaunch silently dies:
 *  1. every window is destroyed, so no ghost customer display survives the
 *     handover on the second monitor, and
 *  2. the single-instance lock is RELEASED — `app.relaunch()` starts the new
 *     process as this one exits, and without an explicit release the new
 *     instance calls requestSingleInstanceLock() while this one still holds it,
 *     sees a second instance, and quits immediately (app closes, nothing comes
 *     back). tools/location-tester avoids this by sleeping; we release instead.
 *
 * `args` is passed explicitly because the default relaunch args drop the entry
 * path when Electron runs an unpackaged app. Quit is graceful (`app.quit()` →
 * before-quit → payment agent stopped, sync stopped, SQLite checkpointed), with
 * a hard exit as a backstop if a webview stalls the teardown.
 */
function relaunchAs(kioskId: string, windows: WindowManager): void {
  log.info('Relaunching as new kiosk location', { kioskId });
  windows.destroyAll();
  app.releaseSingleInstanceLock();
  // Without --setup: a PC opened from the 지점 설정 shortcut comes back as a kiosk.
  app.relaunch({ execPath: process.execPath, args: withoutSetupArg(process.argv.slice(1)) });
  app.quit();
  setTimeout(() => app.exit(0), 2000).unref();
}

/**
 * Kiosk navigation bridge. The touch window reports its current screen; main
 * rebroadcasts it so the customer display can swap to the matching AI-model
 * video (VideoSubtitle_Insa).
 */
export function registerKioskHandlers(windows: WindowManager, container: AppContainer): void {
  handle(IpcChannels.KioskSetScreen, ({ screen, buttonId }) => {
    windows.broadcast(IpcEvents.KioskScreenChanged, { screen, buttonId: buttonId ?? null });
    return screen;
  });

  // Home weather card tapped — tell the customer display to play the clip for
  // today's condition (Weather_Rain/Cold/Sunny). The touch window resolves the
  // key from its weather snapshot; main just rebroadcasts it.
  handle(IpcChannels.KioskPlayWeatherVideo, ({ key }) => {
    windows.broadcast(IpcEvents.KioskWeatherVideo, key);
    return true;
  });

  // Kiosk-location switch (the in-app equivalent of tools/location-tester):
  // persist the choice, then make the running app show that site. Allowed in dev
  // mode, on the test rig and on stage servers only (planSiteSwitch).
  handle(IpcChannels.KioskSwitchLocation, async ({ kioskId }) => {
    if (!(kioskId in KIOSK_LOCATIONS)) {
      throw AppError.validation(`Unknown kiosk location: ${kioskId}`, { kioskId });
    }
    const cfg = kioskConfigStore.get();
    const current = cfg.kioskId;
    // Test rig and stage machines keep their identity and only change the site
    // they show (previewSite); dev mode on any other build becomes the new kiosk.
    const plan = planSiteSwitch(cfg, kioskId, isDevMode());
    switch (plan.kind) {
      case 'denied':
        throw AppError.validation(
          'Kiosk switching is only available in dev mode, on the test rig or on a stage server.',
        );
      case 'none':
        return true;
      case 'preview':
        kioskConfigStore.update({ previewSite: plan.site } as never);
        break;
      case 'clearPreview':
        kioskConfigStore.delete('previewSite' as never);
        break;
      case 'kioskId':
        kioskConfigStore.update({ kioskId: plan.site });
        break;
    }
    // Drop the previous location's shop-API id so it re-derives from the new
    // kioskId (W004 must not keep W003's id).
    kioskConfigStore.delete('shopApiKioskId');
    log.info('Switching kiosk location', { from: current, to: kioskId });
    await restartAs(kioskId, windows, container);
    return true;
  });

  // 지점 설정 window (fresh PC, or the desktop shortcut): make this PC the chosen
  // site — any build, production included. What guards it is where it opens from
  // (the Windows desktop, behind the kiosk window) and the question asked here,
  // not a build flag.
  handle(IpcChannels.KioskSetupApply, async ({ kioskId }) => {
    const site = SETUP_SITES.find((s) => s.code === kioskId);
    if (!site) {
      throw AppError.validation(`Unknown kiosk site: ${kioskId}`, { kioskId });
    }
    if (!(await confirmSetup(site, windows))) return false;
    const from = kioskConfigStore.get().identityKioskId;
    kioskConfigStore.applySetup(site.code);
    log.info('Kiosk site set from the setup window', { from, to: site.code });
    await restartAs(site.code, windows, container, { fromSetup: true });
    return true;
  });

  // 지점 설정 opened from the desktop shortcut with the app off: 앱 실행 starts the
  // kiosk as it is — the same restart as saving, without changing the site.
  handle(IpcChannels.KioskSetupLaunch, async () => {
    const cfg = kioskConfigStore.get();
    if (cfg.setup === 'required') {
      throw AppError.validation("Choose this PC's site before starting the kiosk.");
    }
    // Over a running kiosk there is nothing to start; the window just closes.
    if (cfg.setup !== 'requested') {
      windows.closeSetupWindow();
      return true;
    }
    log.info('Starting the kiosk from the setup window', { kioskId: cfg.kioskId });
    await restartAs(cfg.kioskId, windows, container, { fromSetup: true });
    return true;
  });
}

async function confirmSetup(site: SetupSite, windows: WindowManager): Promise<boolean> {
  const options = {
    type: 'question' as const,
    title: '키오스크 지점 설정',
    buttons: ['바꾸고 다시 시작', '취소'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    ...setupConfirmText(site),
  };
  const parent = windows.getSetupWindow();
  const { response } = parent
    ? await dialog.showMessageBox(parent, options)
    : await dialog.showMessageBox(options);
  return response === 0;
}

/**
 * After the new site is persisted: become it.
 *
 * Packaged build: a real process restart, so the new kiosk boots through the
 * identical provisioned path.
 */
async function restartAs(
  kioskId: string,
  windows: WindowManager,
  container: AppContainer,
  options: { fromSetup?: boolean } = {},
): Promise<void> {
  if (!is.dev) {
    relaunchAs(kioskId, windows);
    return;
  }

  // `npm run dev`: a process restart CANNOT work here — electron-vite owns the
  // Electron process and tears down the Vite dev server when it exits, so the
  // relaunched instance has no renderer URL to load (blank/black windows).
  // Instead, reload in place. This is high-fidelity because KioskService reads
  // electron-store on EVERY call: the reloaded windows get a fresh bootstrap
  // payload (config, theme, languages, seeded content) and every kiosk-derived
  // API value (shop/button/stats kioskNum, weather coordinates) re-resolves off
  // the new id on the next call — which is why the caches are re-fetched first.
  // Only the genuinely boot-once, hardware-facing pieces do not move: the OS
  // power schedule and the card-terminal payment agent. Neither is exercisable
  // in dev; a packaged build restarts properly and picks them up.
  log.info('Dev mode: reloading in place instead of relaunching');
  await Promise.allSettled([
    container.shops.refresh(),
    container.attractions.refresh(),
    container.buttons.refresh(),
    container.banners.refresh(),
    container.backgrounds.refresh(),
    container.flights.refreshIfJeju(),
    container.sailings.refreshIfTerminal(),
    // 틀린그림찾기 puzzles are cached per kiosk; the new one needs its own set.
    container.spotDiff.refresh(),
    // The new location's Localization sheet — its sync also drops the old
    // location's strings (clearStaleTranslations), so the reloaded screens
    // read the right venue's copy instead of the previous one's.
    container.sync.syncContentNow(),
  ]);
  // A fresh PC has no kiosk windows yet. Open them BEFORE closing the setup window,
  // the only one there is — the last window closing quits the app.
  if (windows.getMainWindow()) windows.reloadAll();
  else windows.bootstrap();
  if (options.fromSetup) windows.closeSetupWindow();
  windows.broadcast(IpcEvents.ShopsChanged, null);
  windows.broadcast(IpcEvents.AttractionsChanged, null);
  windows.broadcast(IpcEvents.ButtonsChanged, null);
  windows.broadcast(IpcEvents.BannersChanged, null);
  windows.broadcast(IpcEvents.BackgroundsChanged, null);
}
