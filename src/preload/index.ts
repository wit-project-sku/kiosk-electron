/**
 * Preload bridge.
 *
 * Runs in an isolated context with Node access and exposes a single, frozen,
 * strongly-typed `window.api` object via contextBridge. The renderer never sees
 * ipcRenderer or any Node primitive — only the methods declared in KioskBridge.
 */

import { contextBridge, ipcRenderer, webFrame, type IpcRendererEvent } from 'electron';
import { IpcChannels, IpcEvents } from '@shared/ipc/channels';
import type { InvokeChannel, RequestOf, ResponseOf } from '@shared/ipc/contracts';
import type { BootstrapData } from '@shared/ipc/contracts';
import type { KioskBridge, Unsubscribe } from '@shared/ipc/bridge';

/** Parse bootstrap payload injected by main via additionalArguments. */
function parseInitialState(): BootstrapData | null {
  const prefix = '--bootstrap=';
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return null;
  try {
    return JSON.parse(decodeURIComponent(arg.slice(prefix.length))) as BootstrapData;
  } catch {
    return null;
  }
}


/** Typed wrapper around ipcRenderer.invoke. */
function invoke<C extends InvokeChannel>(
  channel: C,
  request?: RequestOf<C>,
): Promise<ResponseOf<C>> {
  return ipcRenderer.invoke(channel, request) as Promise<ResponseOf<C>>;
}

/**
 * Display-scaling (Chromium zoom) for the operator window.
 *
 * The factor is applied to the renderer's own frame via webFrame — a purely
 * local operation, no IPC — and persisted in localStorage so it is reapplied on
 * every reload/restart. Chromium clamps zoom to a hard 0.25 minimum.
 */
const ZOOM_BOUNDS = { min: 0.25, max: 3, step: 0.05 } as const;
const ZOOM_STORAGE_KEY = 'kiosk:operator-zoom-factor';

/**
 * The preload's tsconfig intentionally omits the DOM lib (it is shared with the
 * main process), but at runtime this script runs in the renderer and has full
 * DOM access. Reach the few browser globals we need through a narrowly typed
 * view rather than widening the lib for the whole main/preload project.
 */
const browser = globalThis as unknown as {
  localStorage?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  addEventListener(type: 'DOMContentLoaded', listener: () => void, options?: { once?: boolean }): void;
};

function clampZoom(factor: number): number {
  if (!Number.isFinite(factor)) return 1;
  return Math.min(ZOOM_BOUNDS.max, Math.max(ZOOM_BOUNDS.min, factor));
}

function applyZoom(factor: number): number {
  const clamped = clampZoom(factor);
  webFrame.setZoomFactor(clamped);
  return clamped;
}

function persistZoom(factor: number): void {
  try {
    browser.localStorage?.setItem(ZOOM_STORAGE_KEY, String(factor));
  } catch {
    /* localStorage may be unavailable; zoom still applies for this session. */
  }
}

function readPersistedZoom(): number | null {
  try {
    const raw = browser.localStorage?.getItem(ZOOM_STORAGE_KEY) ?? null;
    if (raw === null) return null;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? clampZoom(parsed) : null;
  } catch {
    return null;
  }
}

/** Subscribe to a broadcast channel and return an unsubscribe function. */
function subscribe<T>(channel: string, listener: (payload: T) => void): Unsubscribe {
  const handler = (_event: IpcRendererEvent, payload: T): void => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: KioskBridge = {
  images: {
    list: (customerId) => invoke(IpcChannels.ImageList, { customerId }),
    import: (request) => invoke(IpcChannels.ImageImport, request),
    saveCapture: (request) => invoke(IpcChannels.ImageSaveCapture, request),
    remove: (id) => invoke(IpcChannels.ImageDelete, id),
  },
  settings: {
    get: () => invoke(IpcChannels.SettingsGet),
    update: (changes) => invoke(IpcChannels.SettingsUpdate, changes),
  },
  display: {
    getState: () => invoke(IpcChannels.DisplayGetState),
    setState: (state) => invoke(IpcChannels.DisplaySetState, state),
    open: () => invoke(IpcChannels.DisplayOpen),
    close: () => invoke(IpcChannels.DisplayClose),
    toggleFullscreen: () => invoke(IpcChannels.DisplayToggleFullscreen),
  },
  system: {
    getMonitors: () => invoke(IpcChannels.SystemGetMonitors),
    getVersion: () => invoke(IpcChannels.SystemGetVersion),
  },
  app: {
    bootstrap: () => invoke(IpcChannels.AppBootstrap),
  },
  analytics: {
    track: (event) => invoke(IpcChannels.AnalyticsTrack, event),
    report: (range) => invoke(IpcChannels.AnalyticsReport, range),
  },
  sessions: {
    start: (customerId, metadata) => invoke(IpcChannels.SessionStart, { customerId, metadata }),
    end: (id, status) => invoke(IpcChannels.SessionEnd, { id, status }),
    listRecent: (limit) => invoke(IpcChannels.SessionListRecent, { limit }),
  },
  templates: {
    list: () => invoke(IpcChannels.TemplateList),
    upsert: (template) => invoke(IpcChannels.TemplateUpsert, template),
  },
  sync: {
    stats: () => invoke(IpcChannels.SyncStats),
    listByStatus: (status, limit) => invoke(IpcChannels.SyncListByStatus, { status, limit }),
    retry: (id) => invoke(IpcChannels.SyncRetry, id),
  },
  camera: {
    listDevices: () => invoke(IpcChannels.CameraListDevices),
    getSelected: () => invoke(IpcChannels.CameraGetSelected),
    setPreferred: (deviceId) => invoke(IpcChannels.CameraSetPreferred, { deviceId }),
    setRotation: (rotation) => invoke(IpcChannels.CameraSetRotation, { rotation }),
  },
  photo: {
    getOptions: () => invoke(IpcChannels.PhotoGetOptions),
    getWorkflow: () => invoke(IpcChannels.PhotoGetWorkflow),
    startWorkflow: () => invoke(IpcChannels.PhotoStartWorkflow),
    selectClothing: (clothingKey) => invoke(IpcChannels.PhotoSelectClothing, { clothingKey }),
    selectStyle: (styleKey) => invoke(IpcChannels.PhotoSelectStyle, { styleKey }),
    beginCountdown: () => invoke(IpcChannels.PhotoBeginCountdown),
    captureNow: () => invoke(IpcChannels.PhotoCaptureNow),
    captureAndGenerate: (request) => invoke(IpcChannels.PhotoCaptureAndGenerate, request),
    getResultDataUrl: (fileName) => invoke(IpcChannels.PhotoGetResultDataUrl, { fileName }),
    setHoldResult: (hold) => invoke(IpcChannels.PhotoSetHoldResult, { hold }),
    revealResult: () => invoke(IpcChannels.PhotoRevealResult),
    reset: () => invoke(IpcChannels.PhotoReset),
  },
  language: {
    get: () => invoke(IpcChannels.LanguageGet),
    set: (language) => invoke(IpcChannels.LanguageSet, language),
    getAvailable: () => invoke(IpcChannels.LanguageGetAvailable),
  },
  weather: {
    get: () => invoke(IpcChannels.WeatherGet),
  },
  exchange: {
    get: () => invoke(IpcChannels.ExchangeGet),
  },
  subtitles: {
    get: () => invoke(IpcChannels.SubtitlesGet),
  },
  videos: {
    list: () => invoke(IpcChannels.VideosList),
  },
  kiosk: {
    setScreen: (screen, buttonId) =>
      invoke(IpcChannels.KioskSetScreen, { screen, buttonId: buttonId ?? null }),
    playWeatherVideo: (key) => invoke(IpcChannels.KioskPlayWeatherVideo, { key }),
    switchLocation: (kioskId) => invoke(IpcChannels.KioskSwitchLocation, { kioskId }),
  },
  shops: {
    list: () => invoke(IpcChannels.ShopsList),
  },
  buttons: {
    list: () => invoke(IpcChannels.ButtonsList),
  },
  banners: {
    list: () => invoke(IpcChannels.BannersList),
  },
  stats: {
    recordMenuTouch: (input) => invoke(IpcChannels.StatsMenuTouch, input),
  },
  updates: {
    getStatus: () => invoke(IpcChannels.UpdateGetStatus),
    checkNow: () => invoke(IpcChannels.UpdateCheckNow),
    installNow: () => invoke(IpcChannels.UpdateInstallNow),
  },
  eventsApi: {
    list: (query) => invoke(IpcChannels.EventsGet, query),
    recommend: (query) => invoke(IpcChannels.EventsRecommend, query),
    detail: (eventId) => invoke(IpcChannels.EventsDetailGet, { eventId }),
  },
  view: {
    bounds: ZOOM_BOUNDS,
    getZoomFactor: () => webFrame.getZoomFactor(),
    setZoomFactor: (factor) => {
      const applied = applyZoom(factor);
      persistZoom(applied);
      return applied;
    },
  },
  events: {
    onDisplayStateChanged: (listener) => subscribe(IpcEvents.DisplayStateChanged, listener),
    onSettingsChanged: (listener) => subscribe(IpcEvents.SettingsChanged, listener),
    onMonitorsChanged: (listener) => subscribe(IpcEvents.MonitorsChanged, listener),
    onSyncStatsChanged: (listener) => subscribe(IpcEvents.SyncStatsChanged, listener),
    onContentChanged: (listener) => subscribe(IpcEvents.ContentChanged, listener),
    onPhotoWorkflowChanged: (listener) => subscribe(IpcEvents.PhotoWorkflowChanged, listener),
    onLanguageChanged: (listener) => subscribe(IpcEvents.LanguageChanged, listener),
    onWeatherChanged: (listener) => subscribe(IpcEvents.WeatherChanged, listener),
    onExchangeChanged: (listener) => subscribe(IpcEvents.ExchangeChanged, listener),
    onKioskScreenChanged: (listener) => subscribe(IpcEvents.KioskScreenChanged, listener),
    onKioskWeatherVideo: (listener) => subscribe(IpcEvents.KioskWeatherVideo, listener),
    onShopsChanged: (listener) => subscribe(IpcEvents.ShopsChanged, listener),
    onButtonsChanged: (listener) => subscribe(IpcEvents.ButtonsChanged, listener),
    onBannersChanged: (listener) => subscribe(IpcEvents.BannersChanged, listener),
    onUpdateStatusChanged: (listener) => subscribe(IpcEvents.UpdateStatusChanged, listener),
  },
};

const initialState = parseInitialState();

// Only the operator window receives bootstrap state. Reapply its saved display
// scaling on every load so the chosen factor survives reloads and restarts; the
// customer display is left at 100%.
if (initialState) {
  const saved = readPersistedZoom();
  if (saved !== null) {
    browser.addEventListener('DOMContentLoaded', () => applyZoom(saved), { once: true });
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api);
  if (initialState) {
    contextBridge.exposeInMainWorld('__INITIAL_STATE__', initialState);
  }
} else {
  // Fallback for the (unsupported) non-isolated case; never hit in production.
  const g = globalThis as unknown as { api: KioskBridge; __INITIAL_STATE__?: BootstrapData };
  g.api = api;
  if (initialState) g.__INITIAL_STATE__ = initialState;
}
