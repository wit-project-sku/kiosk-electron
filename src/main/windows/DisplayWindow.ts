import { join } from 'node:path';
import { BrowserWindow, screen, type Display } from 'electron';
import { is } from '@electron-toolkit/utils';
import { createLogger } from '@main/core/logger';
import { applyWebContentsSecurity } from '@main/core/security';
import { baseWebPreferences, RENDERER_DIR, rendererUrl } from './windowConfig';

const log = createLogger('display-window');

export interface DisplayWindowOptions {
  /** Target display; falls back to primary if it has disconnected. */
  display: Display;
  /** Kiosk mode locks the window fullscreen and blocks accidental exits. */
  kiosk: boolean;
}

/**
 * The customer-facing window (Monitor 2): a borderless, fullscreen surface for
 * images, video, and slideshows. Positioned on the chosen monitor and, in
 * kiosk mode, made resistant to accidental closing/minimizing.
 */
export function createDisplayWindow(options: DisplayWindowOptions): BrowserWindow {
  const { bounds } = options.display;
  // Borderless fullscreen on the customer monitor (no taskbar/chrome). Locked
  // in production; fullscreen-but-escapable in dev.
  const window = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    frame: false,
    fullscreen: true,
    kiosk: is.dev ? false : options.kiosk,
    autoHideMenuBar: true,
    title: 'Customer Display',
    backgroundColor: '#000000',
    // Always keep it in the taskbar so the operator can re-select it when it
    // slips behind the main window (esp. single-monitor setups).
    skipTaskbar: false,
    webPreferences: baseWebPreferences(),
  });

  applyWebContentsSecurity(window.webContents, rendererUrl());

  window.once('ready-to-show', () => {
    // `showInactive`, never `show` + `focus`. It draws on its own monitor either
    // way, and keyboard focus is not this window's to take:
    //
    //  - on a single monitor (dev) a focused fullscreen display covers the
    //    kiosk and the operator cannot see it;
    //  - on a real 2-monitor kiosk it used to call `focus()` here, which handed
    //    the KEYBOARD to a window that has no keyboard handling in it. 제주's
    //    barrier-free keypad is an ordinary USB keyboard, so from boot every
    //    press went to display.html and the pad appeared to be dead hardware.
    //    Nothing ever gave focus back, because nothing ever took it away.
    //
    // The customer display is a passive surface — images, video, slideshows —
    // and has never needed focus for anything.
    window.showInactive();
  });

  const devUrl = rendererUrl();
  if (is.dev && devUrl) {
    void window.loadURL(`${devUrl}/display.html`);
  } else {
    void window.loadFile(join(RENDERER_DIR, 'display.html'));
  }

  log.info('Display window created', {
    displayId: options.display.id,
    kiosk: options.kiosk,
  });
  return window;
}

/**
 * Choose the best monitor for the customer display: the preferred one if still
 * connected, otherwise the first non-primary display, otherwise the primary.
 */
export function pickDisplay(preferredId: number | null): Display {
  const displays = screen.getAllDisplays();
  if (preferredId !== null) {
    const preferred = displays.find((d) => d.id === preferredId);
    if (preferred) return preferred;
  }
  const primary = screen.getPrimaryDisplay();
  const secondary = displays.find((d) => d.id !== primary.id);
  return secondary ?? primary;
}
