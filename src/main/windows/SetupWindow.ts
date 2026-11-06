import { join } from 'node:path';
import { BrowserWindow, screen } from 'electron';
import { is } from '@electron-toolkit/utils';
import { createLogger } from '@main/core/logger';
import { applyWebContentsSecurity } from '@main/core/security';
import { baseWebPreferences, RENDERER_DIR, rendererUrl } from './windowConfig';

const log = createLogger('setup-window');

const WIDTH = 640;
const HEIGHT = 720;
/** Kiosk monitors are 2160 wide and often unscaled: size the window to stay readable there. */
const COMFORTABLE_SCREEN_WIDTH = 1200;
const MAX_ZOOM = 2.5;

/**
 * 지점 설정 — an ordinary window with a title bar and standard controls, for staff
 * at a keyboard or on TeamViewer. `kiosk` is the fullscreen touch window when one
 * is open: that window stays foremost by design, and only a window it owns is
 * reliably drawn above it on Windows.
 */
export function createSetupWindow(kiosk: BrowserWindow | null): BrowserWindow {
  const { workArea } = kiosk
    ? screen.getDisplayMatching(kiosk.getBounds())
    : screen.getPrimaryDisplay();
  const zoomFactor = Math.min(MAX_ZOOM, Math.max(1, workArea.width / COMFORTABLE_SCREEN_WIDTH));
  const width = Math.min(workArea.width, Math.round(WIDTH * zoomFactor));
  const height = Math.min(workArea.height, Math.round(HEIGHT * zoomFactor));

  const window = new BrowserWindow({
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height,
    show: false,
    parent: kiosk ?? undefined,
    alwaysOnTop: kiosk != null && !is.dev,
    title: '키오스크 지점 설정',
    autoHideMenuBar: true,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#ffffff',
    webPreferences: { ...baseWebPreferences(), zoomFactor },
  });

  applyWebContentsSecurity(window.webContents, rendererUrl());

  window.once('ready-to-show', () => {
    window.show();
    window.focus();
  });

  const devUrl = rendererUrl();
  if (is.dev && devUrl) {
    void window.loadURL(`${devUrl}/setup.html`);
  } else {
    void window.loadFile(join(RENDERER_DIR, 'setup.html'));
  }

  log.info('Setup window created', { width, height, zoomFactor });
  return window;
}
