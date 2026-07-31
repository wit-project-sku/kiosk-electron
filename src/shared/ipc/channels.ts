/**
 * Canonical IPC channel names.
 *
 * Centralizing channel strings prevents typos and makes it trivial to audit
 * the full IPC surface. Channels are grouped by domain and namespaced to
 * avoid collisions.
 *
 * Naming convention: `domain:action`.
 *  - `invoke` channels are request/response (renderer -> main -> renderer).
 *  - `event`  channels are one-way broadcasts (main -> renderer).
 */

export const IpcChannels = {
  // Images
  ImageList: 'image:list',
  ImageImport: 'image:import',
  ImageSaveCapture: 'image:saveCapture',
  ImageDelete: 'image:delete',

  // Settings
  SettingsGet: 'settings:get',
  SettingsUpdate: 'settings:update',

  // Display window control
  DisplayGetState: 'display:getState',
  DisplaySetState: 'display:setState',
  DisplayOpen: 'display:open',
  DisplayClose: 'display:close',
  DisplayToggleFullscreen: 'display:toggleFullscreen',

  // System / monitors
  SystemGetMonitors: 'system:getMonitors',
  SystemGetVersion: 'system:getVersion',

  // App bootstrap (single aggregate call for instant startup)
  AppBootstrap: 'app:bootstrap',

  // Analytics
  AnalyticsTrack: 'analytics:track',
  AnalyticsReport: 'analytics:report',

  // Sessions
  SessionStart: 'session:start',
  SessionEnd: 'session:end',
  SessionListRecent: 'session:listRecent',

  // Templates (memory-cached config)
  TemplateList: 'template:list',
  TemplateUpsert: 'template:upsert',

  // Sync queue
  SyncStats: 'sync:stats',
  SyncListByStatus: 'sync:listByStatus',
  SyncRetry: 'sync:retry',

  // Camera
  CameraListDevices: 'camera:listDevices',
  CameraGetSelected: 'camera:getSelected',
  CameraSetPreferred: 'camera:setPreferred',

  // AI Photo workflow
  PhotoGetOptions: 'photo:getOptions',
  PhotoGetWorkflow: 'photo:getWorkflow',
  PhotoStartWorkflow: 'photo:startWorkflow',
  PhotoSelectClothing: 'photo:selectClothing',
  PhotoSelectStyle: 'photo:selectStyle',
  PhotoBeginCountdown: 'photo:beginCountdown',
  PhotoCaptureAndGenerate: 'photo:captureAndGenerate',
  PhotoGetResultDataUrl: 'photo:getResultDataUrl',
  PhotoSetHoldResult: 'photo:setHoldResult',
  PhotoRevealResult: 'photo:revealResult',
  PhotoReset: 'photo:reset',

  // Language / Translations
  LanguageGet: 'language:get',
  LanguageSet: 'language:set',
  LanguageGetAvailable: 'language:getAvailable',

  // Weather (cached; refreshed in main every 30 min)
  WeatherGet: 'weather:get',

  // Exchange rates (cached; refreshed in main every 6h)
  ExchangeGet: 'exchange:get',

  // AI-model video subtitles (fetched once per session from the witteria API)
  SubtitlesGet: 'subtitles:get',

  // Real display-video file names present on disk, per set (listed at runtime so
  // newly-added videos resolve without a rebuild; no build-time manifest).
  VideosList: 'videos:list',

  // Kiosk navigation (touch screen → customer display video sync)
  KioskSetScreen: 'kiosk:setScreen',
  // Play the customer-display clip matching today's weather (tapping the home
  // weather card). Carries the resolved Weather_* playKey.
  KioskPlayWeatherVideo: 'kiosk:playWeatherVideo',
  // Dev-mode only: persist a new kiosk location id and relaunch as that kiosk.
  KioskSwitchLocation: 'kiosk:switchLocation',

  // Shops (cached from the witteria API)
  ShopsList: 'shops:list',

  // Home buttons (layout cached from the witteria API)
  ButtonsList: 'buttons:list',

  // Bottom promo banners (cached from the witteria API)
  BannersList: 'banners:list',

  // Stats (usage analytics POSTed to the witteria API)
  StatsMenuTouch: 'stats:menuTouch',

  // Events (live paginated list from the witteria API)
  EventsGet: 'events:get',
  // Events MBTI recommendation
  EventsRecommend: 'events:recommend',
  // Event detail (GET /api/events/{eventId})
  EventsDetailGet: 'events:detail',

  // Auto-update (electron-updater). Status is read-only; check/install are
  // optional operator nudges — updating is otherwise fully automatic.
  UpdateGetStatus: 'update:getStatus',
  UpdateCheckNow: 'update:checkNow',
  UpdateInstallNow: 'update:installNow',
} as const;

export type IpcInvokeChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

/**
 * One-way broadcast channels (main -> renderer). The display window subscribes
 * to `DisplayStateChanged`; both windows can react to theme changes.
 */
export const IpcEvents = {
  DisplayStateChanged: 'event:display:stateChanged',
  SettingsChanged: 'event:settings:changed',
  MonitorsChanged: 'event:system:monitorsChanged',
  SyncStatsChanged: 'event:sync:statsChanged',
  ContentChanged: 'event:content:changed',
  PhotoWorkflowChanged: 'event:photo:workflowChanged',
  LanguageChanged: 'event:language:changed',
  WeatherChanged: 'event:weather:changed',
  ExchangeChanged: 'event:exchange:changed',
  /** Touch screen navigated; the customer display swaps its AI-model video. */
  KioskScreenChanged: 'event:kiosk:screenChanged',
  /** Weather card tapped; the customer display plays that condition's clip. */
  KioskWeatherVideo: 'event:kiosk:weatherVideo',
  /** Shop catalogue refreshed into SQLite; the renderer reloads its store. */
  ShopsChanged: 'event:shops:changed',
  /** Home button layout refreshed into SQLite; the renderer reloads its store. */
  ButtonsChanged: 'event:buttons:changed',
  /** Bottom banners refreshed into SQLite; the renderer reloads its store. */
  BannersChanged: 'event:banners:changed',
  /** Auto-update status changed (checking / downloading / downloaded / …). */
  UpdateStatusChanged: 'event:update:statusChanged',
} as const;

export type IpcEventChannel = (typeof IpcEvents)[keyof typeof IpcEvents];
