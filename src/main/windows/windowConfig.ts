import { join } from 'node:path';
import type { BrowserWindowConstructorOptions } from 'electron';
import { is } from '@electron-toolkit/utils';

/**
 * Shared, security-hardened defaults for every BrowserWindow.
 *
 * These options implement the core of the Electron security model:
 *  - contextIsolation: true    -> renderer cannot touch the preload's scope
 *  - nodeIntegration: false    -> no Node.js in the renderer
 *  - sandbox: false            -> required for an ESM preload bridge
 *  - the preload exposes only a tiny, typed API surface (see preload/).
 */
export const PRELOAD_PATH = join(__dirname, '../preload/index.mjs');

export const RENDERER_DIR = join(__dirname, '../renderer');

export function baseWebPreferences(
  additionalArguments: string[] = [],
): BrowserWindowConstructorOptions['webPreferences'] {
  return {
    preload: PRELOAD_PATH,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
    webSecurity: true,
    // Enables <webview> so the kiosk can embed first-party sites (WITStore,
    // events) in their own isolated process — robust against X-Frame-Options.
    webviewTag: true,
    additionalArguments,
    // DevTools is only ever available in development builds.
    devTools: is.dev,
    spellcheck: false,
  };
}

/** Dev server URL injected by electron-vite, undefined in production. */
export function rendererUrl(): string | undefined {
  return process.env['ELECTRON_RENDERER_URL'];
}
