import { BrowserWindow, screen, type Display } from 'electron';
import type { MonitorInfo } from '@shared/types/domain';
import { IpcEvents } from '@shared/ipc/channels';
import type { EventChannel, PayloadOf } from '@shared/ipc/contracts';
import { createLogger } from '@main/core/logger';
import type { AppContainer } from '@main/container';
import { buildBootstrapData } from '@main/bootstrap';
import { createMainWindow } from './MainWindow';
import { createDisplayWindow, pickDisplay } from './DisplayWindow';

const log = createLogger('window-manager');

/**
 * Owns the lifecycle of both application windows and all main->renderer
 * broadcasting. Centralizing this prevents window references from leaking into
 * services and guarantees listeners are cleaned up when windows close.
 */
export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private displayWindow: BrowserWindow | null = null;
  private unsubscribeDisplay: (() => void) | null = null;
  private unsubscribeSync: (() => void) | null = null;
  private unsubscribeContent: (() => void) | null = null;
  private unsubscribePhoto: (() => void) | null = null;
  private unsubscribeWeather: (() => void) | null = null;
  private unsubscribeFlights: (() => void) | null = null;
  private unsubscribeExchange: (() => void) | null = null;
  private unsubscribeUpdater: (() => void) | null = null;

  constructor(private readonly container: AppContainer) {}

  /** Create the operator window and auto-open the display on a 2nd monitor. */
  bootstrap(): void {
    const bootstrap = buildBootstrapData(this.container);
    this.mainWindow = createMainWindow(bootstrap);
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
    this.mainWindow.webContents.once('did-finish-load', () => {
      const flights = this.container.flights.getCurrent();
      if (flights) this.broadcast(IpcEvents.FlightsChanged, flights);
    });

    // Forward every display-state change to the customer window.
    this.unsubscribeDisplay = this.container.display.subscribe((state) => {
      this.broadcast(IpcEvents.DisplayStateChanged, state);
    });

    // Forward sync-queue stats so the UI can show live sync status.
    this.unsubscribeSync = this.container.sync.subscribe((stats) => {
      this.broadcast(IpcEvents.SyncStatsChanged, stats);
    });

    this.unsubscribeContent = this.container.sync.subscribeContent((content) => {
      this.broadcast(IpcEvents.ContentChanged, content);
    });

    this.unsubscribePhoto = this.container.photoWorkflow.subscribe((state) => {
      this.broadcast(IpcEvents.PhotoWorkflowChanged, state);
    });

    // Forward weather refreshes so the kiosk header updates without a reload.
    this.unsubscribeWeather = this.container.weather.subscribe((snapshot) => {
      this.broadcast(IpcEvents.WeatherChanged, snapshot);
    });

    this.unsubscribeFlights = this.container.flights.subscribe((snapshot) => {
      this.broadcast(IpcEvents.FlightsChanged, snapshot);
    });

    // Forward FX refreshes so the 환율 screen updates without a reload.
    this.unsubscribeExchange = this.container.exchange.subscribe((snapshot) => {
      this.broadcast(IpcEvents.ExchangeChanged, snapshot);
    });

    // Forward auto-update status so the UI can show checking/downloading/etc.
    this.unsubscribeUpdater = this.container.updater.subscribe((status) => {
      this.broadcast(IpcEvents.UpdateStatusChanged, status);
    });

    // Re-evaluate monitors when the hardware setup changes.
    screen.on('display-added', this.handleDisplaysChanged);
    screen.on('display-removed', this.handleDisplaysChanged);

    // Auto-open the customer display if a second monitor is present.
    if (this.hasSecondaryDisplay()) {
      this.openDisplayWindow();
    }
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  focusMain(): void {
    if (!this.mainWindow) return;
    if (this.mainWindow.isMinimized()) this.mainWindow.restore();
    this.mainWindow.focus();
  }

  /** Open (or focus) the customer display window. Returns true if open. */
  openDisplayWindow(): boolean {
    if (this.displayWindow && !this.displayWindow.isDestroyed()) {
      this.displayWindow.focus();
      return true;
    }

    const settings = this.container.settings.get();
    const display = pickDisplay(settings.preferredDisplayId);

    this.displayWindow = createDisplayWindow({
      display,
      kiosk: settings.displayKioskMode,
    });

    // Push the current state as soon as the window's renderer is ready.
    this.displayWindow.webContents.once('did-finish-load', () => {
      this.sendToDisplay(IpcEvents.DisplayStateChanged, this.container.display.getState());
    });

    this.displayWindow.on('closed', () => {
      this.displayWindow = null;
    });

    return true;
  }

  closeDisplayWindow(): boolean {
    if (this.displayWindow && !this.displayWindow.isDestroyed()) {
      this.displayWindow.close();
      this.displayWindow = null;
      return true;
    }
    return false;
  }

  toggleDisplayFullscreen(): boolean {
    if (!this.displayWindow || this.displayWindow.isDestroyed()) return false;
    const next = !this.displayWindow.isFullScreen();
    this.displayWindow.setFullScreen(next);
    return next;
  }

  listMonitors(): MonitorInfo[] {
    const primary = screen.getPrimaryDisplay();
    return screen.getAllDisplays().map((d) => this.toMonitorInfo(d, primary.id));
  }

  /** Broadcast an event to every live window. */
  broadcast<E extends EventChannel>(channel: E, payload: PayloadOf<E>): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue;
      const wc = win.webContents;
      // A window can exist while its render frame is still being (re)created
      // during startup/reload — sending then throws "Render frame was disposed".
      if (wc.isDestroyed() || wc.isCrashed() || wc.isLoading()) continue;
      try {
        wc.send(channel, payload);
      } catch {
        /* frame mid-navigation/disposed; safe to skip this window */
      }
    }
  }

  private sendToDisplay<E extends EventChannel>(channel: E, payload: PayloadOf<E>): void {
    if (this.displayWindow && !this.displayWindow.isDestroyed()) {
      this.displayWindow.webContents.send(channel, payload);
    }
  }

  /**
   * Reload every live window (dev-mode kiosk switch). The renderer re-fetches
   * `app:bootstrap` on mount, so a reload is enough to pick up a changed kiosk
   * identity — config, theme, languages and content all come from that payload.
   */
  reloadAll(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
      win.webContents.reload();
    }
  }

  /**
   * Destroy every window immediately, without firing close handlers.
   *
   * Used right before a relaunch: `close()` is asynchronous and can leave the
   * customer-display window painted on the second monitor while the process is
   * already handing over, which shows up as a stuck black screen.
   */
  destroyAll(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.destroy();
    }
    this.mainWindow = null;
    this.displayWindow = null;
  }

  /** Release listeners. Called on app shutdown. */
  dispose(): void {
    this.unsubscribeDisplay?.();
    this.unsubscribeDisplay = null;
    this.unsubscribeSync?.();
    this.unsubscribeSync = null;
    this.unsubscribeContent?.();
    this.unsubscribeContent = null;
    this.unsubscribePhoto?.();
    this.unsubscribePhoto = null;
    this.unsubscribeWeather?.();
    this.unsubscribeWeather = null;
    this.unsubscribeFlights?.();
    this.unsubscribeFlights = null;
    this.unsubscribeExchange?.();
    this.unsubscribeExchange = null;
    this.unsubscribeUpdater?.();
    this.unsubscribeUpdater = null;
    screen.removeListener('display-added', this.handleDisplaysChanged);
    screen.removeListener('display-removed', this.handleDisplaysChanged);
  }

  private hasSecondaryDisplay(): boolean {
    return screen.getAllDisplays().length > 1;
  }

  private readonly handleDisplaysChanged = (): void => {
    const monitors = this.listMonitors();
    log.info('Monitor configuration changed', { count: monitors.length });
    this.broadcast(IpcEvents.MonitorsChanged, monitors);
  };

  private toMonitorInfo(display: Display, primaryId: number): MonitorInfo {
    return {
      id: display.id,
      label: display.label || `Display ${display.id}`,
      bounds: display.bounds,
      isPrimary: display.id === primaryId,
    };
  }
}
