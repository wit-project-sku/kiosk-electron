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
  PhotoPauseCountdown: 'photo:pauseCountdown',
  PhotoResumeCountdown: 'photo:resumeCountdown',
  PhotoCaptureAndGenerate: 'photo:captureAndGenerate',
  PhotoStartEffects: 'photo:startEffects',
  PhotoCaptureEffects: 'photo:captureEffects',
  PhotoReset: 'photo:reset',

  // Language / Translations
  LanguageGet: 'language:get',
  LanguageSet: 'language:set',
  LanguageGetAvailable: 'language:getAvailable',

  // Weather (cached; refreshed in main every 30 min)
  WeatherGet: 'weather:get',

  // Exchange rates (cached; refreshed in main every 6h)
  ExchangeGet: 'exchange:get',

  // Kiosk navigation (touch screen → customer display video sync)
  KioskSetScreen: 'kiosk:setScreen',
  // Advance the customer-display video to the next clip for the current screen
  // (e.g. tapping the home weather card).
  KioskAdvanceVideo: 'kiosk:advanceVideo',
  // Touch screen picked an AR wearable for the 인스타 효과 screen; the customer
  // display anchors it to the face.
  KioskSetEffectsWearable: 'kiosk:setEffectsWearable',

  // Shops (cached from the witteria API)
  ShopsList: 'shops:list',

  // Stats (usage analytics POSTed to the witteria API)
  StatsMenuTouch: 'stats:menuTouch',
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
  /** Touch screen requested the next clip for the current screen (weather card). */
  KioskVideoAdvanced: 'event:kiosk:videoAdvanced',
  /** Touch screen picked an AR wearable; the customer display anchors it. */
  EffectsWearableChanged: 'event:kiosk:effectsWearableChanged',
  /** Shop catalogue refreshed into SQLite; the renderer reloads its store. */
  ShopsChanged: 'event:shops:changed',
} as const;

export type IpcEventChannel = (typeof IpcEvents)[keyof typeof IpcEvents];
