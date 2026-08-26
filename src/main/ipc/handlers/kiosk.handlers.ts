import { app } from 'electron';
import { is } from '@electron-toolkit/utils';
import { IpcChannels, IpcEvents } from '@shared/ipc/channels';
import { KIOSK_LOCATIONS } from '@shared/config/kioskLocations';
import type { WindowManager } from '@main/windows/WindowManager';
import type { AppContainer } from '@main/container';
import { AppError } from '@main/core/AppError';
import { createLogger } from '@main/core/logger';
import { isDevMode } from '@main/core/env';
import { kioskConfigStore } from '@main/core/KioskConfigStore';
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
  app.relaunch({ execPath: process.execPath, args: process.argv.slice(1) });
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

  // Dev-mode kiosk-location switch (the in-app equivalent of
  // tools/location-tester): persist the new kioskId, then make the running app
  // become that kiosk.
  handle(IpcChannels.KioskSwitchLocation, async ({ kioskId }) => {
    if (!isDevMode()) {
      throw AppError.validation('Kiosk switching is only available in dev mode.');
    }
    if (!(kioskId in KIOSK_LOCATIONS)) {
      throw AppError.validation(`Unknown kiosk location: ${kioskId}`, { kioskId });
    }

    const current = kioskConfigStore.get().kioskId;
    if (kioskId === current) return true;

    kioskConfigStore.update({ kioskId });
    // Drop the previous location's shop-API id so it re-derives from the new
    // kioskId (W004 must not keep W003's id).
    kioskConfigStore.delete('shopApiKioskId');
    log.info('Switching kiosk location', { from: current, to: kioskId });

    // Packaged build: a real process restart, so the new kiosk boots through the
    // identical provisioned path.
    if (!is.dev) {
      relaunchAs(kioskId, windows);
      return true;
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
    ]);
    windows.reloadAll();
    windows.broadcast(IpcEvents.ShopsChanged, null);
    windows.broadcast(IpcEvents.AttractionsChanged, null);
    windows.broadcast(IpcEvents.ButtonsChanged, null);
    windows.broadcast(IpcEvents.BannersChanged, null);
    windows.broadcast(IpcEvents.BackgroundsChanged, null);
    return true;
  });
}
