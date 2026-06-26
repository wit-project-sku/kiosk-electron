import { join } from 'node:path';
import { BrowserWindow, screen, shell } from 'electron';
import { is } from '@electron-toolkit/utils';
import type { BootstrapData } from '@shared/ipc/contracts';
import { createLogger } from '@main/core/logger';
import { applyWebContentsSecurity } from '@main/core/security';
import { baseWebPreferences, RENDERER_DIR, rendererUrl } from './windowConfig';

function bootstrapArguments(data: BootstrapData): string[] {
  // The bootstrap travels as a command-line argument, which the OS caps (~32k
  // chars on Windows). The translations/content/templates can be far larger
  // than that, so strip them here for instant first paint (theme/layout/language)
  // and let the renderer fetch the full payload over IPC (see useBootstrap).
  const slim: BootstrapData = { ...data, translations: {}, content: [], templates: [] };
  return [`--bootstrap=${encodeURIComponent(JSON.stringify(slim))}`];
}

const log = createLogger('main-window');

/**
 * The operator window (Monitor 1): dashboard, customer management, settings,
 * and display controls. Standard chrome, resizable, shown when ready to avoid
 * a white flash.
 */
export function createMainWindow(bootstrap: BootstrapData): BrowserWindow {
  // The touch kiosk fills the PRIMARY monitor; the customer display goes to the
  // 2nd monitor. Fullscreen + frameless = no taskbar/chrome. Locked in
  // production (kiosk); fullscreen-but-escapable in dev for debugging.
  const { bounds } = screen.getPrimaryDisplay();

  const window = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    fullscreen: true,
    frame: false,
    kiosk: !is.dev,
    // Stay foremost in production so an OS gesture/notification can't surface
    // over the kiosk. (Disabled in dev so devtools/editor stay reachable.)
    alwaysOnTop: !is.dev,
    autoHideMenuBar: true,
    title: 'Insadong Kiosk',
    backgroundColor: '#0b0d12',
    webPreferences: baseWebPreferences(bootstrapArguments(bootstrap)),
  });

  applyWebContentsSecurity(window.webContents, rendererUrl());

  window.once('ready-to-show', () => {
    window.show();
    window.focus(); // keep the touch screen foremost
    if (is.dev) window.webContents.openDevTools({ mode: 'detach' });
  });

  window.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: 'deny' };
  });

  const devUrl = rendererUrl();
  if (is.dev && devUrl) {
    void window.loadURL(devUrl);
  } else {
    void window.loadFile(join(RENDERER_DIR, 'index.html'));
  }

  log.info('Main window created');
  return window;
}
