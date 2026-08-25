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
  // 제주 손동작 게이트 — the customer display drives these from what it sees in
  // the camera feed (open palm / closed fist).
  PhotoArmGestureGate: 'photo:armGestureGate',
  PhotoHoldCountdown: 'photo:holdCountdown',
  PhotoResumeCountdown: 'photo:resumeCountdown',
  PhotoCaptureAndGenerate: 'photo:captureAndGenerate',
  PhotoGetResultDataUrl: 'photo:getResultDataUrl',
  PhotoSetHoldResult: 'photo:setHoldResult',
  PhotoRevealResult: 'photo:revealResult',
  PhotoDeferResultDisplay: 'photo:deferResultDisplay',
  PhotoReleaseResultDisplay: 'photo:releaseResultDisplay',
  PhotoReset: 'photo:reset',

  // 틀린그림찾기 — the mini-game played on the touch screen while the AR 한복
  // photo generates (제주 W006).
  SpotDiffGetRound: 'spotDiff:getRound',

  // Language / Translations
  LanguageGet: 'language:get',
  LanguageSet: 'language:set',

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

  // 제주 관광명소 (curated sightseeing catalogue, cached from the witteria API)
  AttractionsList: 'attractions:list',
  // 초성-filtered variant, straight off the API's `initial` param.
  AttractionsListByInitial: 'attractions:listByInitial',

  // Home buttons (layout cached from the witteria API)
  ButtonsList: 'buttons:list',

  // Bottom promo banners (cached from the witteria API)
  BannersList: 'banners:list',

  // AR 배경 테마 set for this kiosk (cached from the witteria API)
  BackgroundsList: 'backgrounds:list',

  // AR 한복 outfit catalogue + its category tabs (cached from the witteria API)
  OutfitsGet: 'outfits:get',

  // Stats (usage analytics POSTed to the witteria API)
  StatsMenuTouch: 'stats:menuTouch',

  // Events (live paginated list from the witteria API)
  EventsGet: 'events:get',
  // Events MBTI recommendation
  EventsRecommend: 'events:recommend',
  // Event detail (GET /api/events/{eventId})
  EventsDetailGet: 'events:detail',

  // 제주 AI 코스 추천 (live POST; 제주 kiosks only)
  JejuCourseRecommend: 'jejuCourse:recommend',

  // Auto-update (electron-updater). Status is read-only; check/install are
  // optional operator nudges — updating is otherwise fully automatic.
  UpdateGetStatus: 'update:getStatus',
  UpdateCheckNow: 'update:checkNow',
  UpdateInstallNow: 'update:installNow',

  // 유동인구 (footfall) — anonymous passer-by counting. The renderer runs the
  // camera pipeline and reports integers; main owns the counts and the upload.
  FootfallGetRuntime: 'footfall:getRuntime',
  FootfallReport: 'footfall:report',
  FootfallStatus: 'footfall:status',
  FootfallGetStats: 'footfall:getStats',
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
  /** 제주 관광명소 refreshed into SQLite; the renderer reloads its store. */
  AttractionsChanged: 'event:attractions:changed',
  /** Home button layout refreshed into SQLite; the renderer reloads its store. */
  ButtonsChanged: 'event:buttons:changed',
  /** Bottom banners refreshed into SQLite; the renderer reloads its store. */
  BannersChanged: 'event:banners:changed',
  /** AR background set refreshed into SQLite; the renderer reloads its store. */
  BackgroundsChanged: 'event:backgrounds:changed',
  /** Outfit catalogue refreshed into SQLite; the renderer reloads its store. */
  OutfitsChanged: 'event:outfits:changed',
  /** Auto-update status changed (checking / downloading / downloaded / …). */
  UpdateStatusChanged: 'event:update:statusChanged',
  /**
   * 유동인구 counting was armed or told to stand down (a photo session took the
   * camera, the cool-down after one ended, no camera present). The renderer
   * releases or re-opens its stream on this.
   */
  FootfallRuntimeChanged: 'event:footfall:runtimeChanged',
} as const;

export type IpcEventChannel = (typeof IpcEvents)[keyof typeof IpcEvents];
