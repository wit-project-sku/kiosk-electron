/**
 * Application-wide Electron security hardening.
 *
 * Implements the recommendations from the Electron security checklist that are
 * not already enforced per-window by `BrowserWindow` options:
 *  - block navigation to untrusted origins
 *  - block creation of arbitrary child windows
 *  - deny all permission requests by default (camera is granted explicitly)
 */

import { app, shell, type WebContents } from 'electron';
import { is } from '@electron-toolkit/utils';
import { createLogger } from './logger';

const log = createLogger('security');

/**
 * Strict Content-Security-Policy for production. Applied via response headers
 * (not an HTML meta) so it never interferes with Vite's HMR websocket / React
 * Fast Refresh in development. `media:` covers the custom media:// asset scheme.
 *
 * `https:` is allowed for img-src/media-src because shop cards render remote
 * photos served from the witteria S3/CDN (the URLs come from the shops API and
 * can't be enumerated as a fixed allowlist). Images/media can't execute code, so
 * this stays safe while script/connect remain locked to 'self' (+ our own
 * media:/blob: for the bundled MediaPipe runtime, below).
 *
 * MediaPipe face detection (customer-display camera gating) needs:
 *  - `connect-src media:`        → fetch the BlazeFace model + wasm served from
 *                                  the bundled `media://app/*` scheme.
 *  - `script-src 'wasm-unsafe-eval' media: blob:` → dynamically import the wasm
 *                                  loader JS (from media:) and compile the wasm.
 *  - `worker-src blob:`          → the Emscripten runtime may spin a blob worker.
 * These only widen to our own app-controlled schemes (media:// serves bundled
 * files; blob: is same-origin), and `'wasm-unsafe-eval'` permits WebAssembly
 * without enabling general eval(). Without them the detector silently fails and
 * presence gating turns off in production.
 */
const PRODUCTION_CSP =
  "default-src 'self'; img-src 'self' https: media: data: blob:; " +
  "media-src 'self' https: media: blob:; " +
  "style-src 'self' 'unsafe-inline'; " +
  "script-src 'self' 'wasm-unsafe-eval' media: blob:; " +
  "worker-src 'self' blob:; " +
  "connect-src 'self' media:";

let cspApplied = false;
function applyProductionCsp(contents: WebContents): void {
  if (is.dev || cspApplied) return;
  cspApplied = true; // defaultSession is shared across windows — register once.
  contents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [PRODUCTION_CSP],
      },
    });
  });
}

/**
 * Block browser/OS shortcuts that would let a user escape the kiosk in
 * production: DevTools, reload, zoom, print, and — critically — the window/app
 * switching and close combos (Alt+Tab, Alt+Esc, Alt+F4, Ctrl+Esc, Ctrl+Shift+Esc,
 * and the ⊞ Win key). In development everything stays available for debugging.
 *
 * NOTE: `before-input-event` only catches keys delivered to the focused window.
 * Some combos (Ctrl+Alt+Del, and on many systems the ⊞ Win key and Alt+Tab) are
 * intercepted by the Windows shell BEFORE the app sees them, so they can't be
 * blocked here — those require OS-level lockdown (see scripts/lockdown-kiosk.ps1
 * and Windows Assigned Access).
 */
function blockReservedShortcuts(contents: WebContents): void {
  if (is.dev) return;
  contents.on('before-input-event', (event, input) => {
    const key = input.key.toLowerCase();
    const ctrlOrCmd = input.control || input.meta;

    const isDevtools =
      key === 'f12' || (ctrlOrCmd && input.shift && (key === 'i' || key === 'j' || key === 'c'));
    const isReload = key === 'f5' || (ctrlOrCmd && key === 'r');
    const isPrint = ctrlOrCmd && key === 'p';
    const isZoom = ctrlOrCmd && (key === '+' || key === '-' || key === '=' || key === '0');
    // App/window escape combos.
    const isAltSwitch = input.alt && (key === 'tab' || key === 'escape' || key === 'f4');
    const isCtrlEsc = input.control && key === 'escape'; // opens Start menu
    const isTaskMgr = input.control && input.shift && key === 'escape';
    const isWinKey = key === 'meta' || key === 'super' || key === 'os'; // ⊞ Win
    const isContextMenu = key === 'contextmenu' || key === 'apps';

    if (
      isDevtools ||
      isReload ||
      isPrint ||
      isZoom ||
      isAltSwitch ||
      isCtrlEsc ||
      isTaskMgr ||
      isWinKey ||
      isContextMenu
    ) {
      event.preventDefault();
    }
  });
}

/** Origins the renderer is allowed to navigate to (dev server + file://). */
function isAllowedNavigation(url: string, devServerUrl: string | undefined): boolean {
  if (url.startsWith('file://')) return true;
  if (devServerUrl && url.startsWith(devServerUrl)) return true;
  return false;
}

export function applyWebContentsSecurity(
  contents: WebContents,
  devServerUrl: string | undefined,
): void {
  // Prevent in-app navigation away from the application shell.
  contents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url, devServerUrl)) {
      event.preventDefault();
      log.warn('Blocked navigation to untrusted URL', { url });
    }
  });

  // Open external links in the OS browser; never spawn in-app windows.
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Deny every permission except media (camera/mic) which the kiosk needs.
  contents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    const granted = permission === 'media';
    if (!granted) log.warn('Denied permission request', { permission });
    callback(granted);
  });

  applyProductionCsp(contents);
  blockReservedShortcuts(contents);
}

/**
 * Enforce a single application instance. A second launch focuses the existing
 * window instead of starting a competing process (kiosks must be singletons).
 */
export function enforceSingleInstance(onSecondInstance: () => void): boolean {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return false;
  }
  app.on('second-instance', onSecondInstance);
  return true;
}
