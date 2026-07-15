/**
 * The shape of the API exposed to the renderer via `window.api`.
 *
 * This is the ONLY surface the renderer can use to reach the main process.
 * It is fully typed from the IPC contract, so renderer call sites get
 * autocomplete and compile-time checking, and the bridge stays minimal and
 * auditable (no raw ipcRenderer, no Node access).
 */

import type {
  AnalyticsReportRange,
  AppVersionInfo,
  BootstrapData,
  ImportImagesRequest,
  SaveCaptureRequest,
} from './contracts';
import type { Result } from '../types/result';
import type {
  AppSettings,
  DisplayState,
  EntityId,
  ImageAsset,
  MonitorInfo,
} from '../types/domain';
import type {
  AnalyticsEvent,
  AnalyticsReport,
  CreateAnalyticsEvent,
  MenuTouchInput,
  Session,
  SessionStatus,
  SyncJob,
  SyncJobStatus,
  SyncQueueStats,
  Template,
} from '../types/data';
import type { CachedContent, SupportedLanguage } from '../types/kiosk';
import type { CameraDeviceInfo, PhotoOption, PhotoWorkflowState } from '../types/photo';
import type { WeatherSnapshot } from '../types/weather';
import type { ExchangeSnapshot } from '../types/exchange';
import type { VideoEntry, VideoFilesBySet } from '../types/subtitle';
import type { Shop } from '../types/shop';
import type { KioskButton } from '../types/buttons';
import type {
  EventDetail,
  EventRecommendation,
  EventsPage,
  EventsQuery,
  EventsRecommendQuery,
} from '../types/events';

/** Unsubscribe handle returned by every event subscription. */
export type Unsubscribe = () => void;

export interface KioskBridge {
  images: {
    list(customerId: EntityId | null): Promise<Result<ImageAsset[]>>;
    import(request: ImportImagesRequest): Promise<Result<ImageAsset[]>>;
    saveCapture(request: SaveCaptureRequest): Promise<Result<ImageAsset>>;
    remove(id: EntityId): Promise<Result<EntityId>>;
  };
  settings: {
    get(): Promise<Result<AppSettings>>;
    update(changes: Partial<AppSettings>): Promise<Result<AppSettings>>;
  };
  display: {
    getState(): Promise<Result<DisplayState>>;
    setState(state: DisplayState): Promise<Result<DisplayState>>;
    open(): Promise<Result<boolean>>;
    close(): Promise<Result<boolean>>;
    toggleFullscreen(): Promise<Result<boolean>>;
  };
  system: {
    getMonitors(): Promise<Result<MonitorInfo[]>>;
    getVersion(): Promise<Result<AppVersionInfo>>;
  };
  app: {
    bootstrap(): Promise<Result<BootstrapData>>;
  };
  analytics: {
    track(event: CreateAnalyticsEvent): Promise<Result<AnalyticsEvent>>;
    report(range: AnalyticsReportRange): Promise<Result<AnalyticsReport>>;
  };
  sessions: {
    start(
      customerId: EntityId | null,
      metadata: Record<string, unknown> | null,
    ): Promise<Result<Session>>;
    end(id: EntityId, status: SessionStatus): Promise<Result<Session>>;
    listRecent(limit: number): Promise<Result<Session[]>>;
  };
  templates: {
    list(): Promise<Result<Template[]>>;
    upsert(
      template: Pick<Template, 'key' | 'name' | 'content' | 'enabled'>,
    ): Promise<Result<Template>>;
  };
  sync: {
    stats(): Promise<Result<SyncQueueStats>>;
    listByStatus(status: SyncJobStatus, limit: number): Promise<Result<SyncJob[]>>;
    retry(id: EntityId): Promise<Result<SyncJob | null>>;
  };
  camera: {
    listDevices(): Promise<Result<CameraDeviceInfo[]>>;
    getSelected(): Promise<Result<{ deviceId: string | null; devices: CameraDeviceInfo[] }>>;
    setPreferred(deviceId: string): Promise<Result<{ deviceId: string }>>;
  };
  photo: {
    getOptions(): Promise<Result<{ clothing: PhotoOption[]; styles: PhotoOption[] }>>;
    getWorkflow(): Promise<Result<PhotoWorkflowState>>;
    startWorkflow(): Promise<Result<PhotoWorkflowState>>;
    selectClothing(clothingKey: string): Promise<Result<PhotoWorkflowState>>;
    selectStyle(styleKey: string): Promise<Result<PhotoWorkflowState>>;
    beginCountdown(): Promise<Result<PhotoWorkflowState>>;
    captureAndGenerate(request: {
      sessionId: string;
      dataUrl: string;
      clothingKey: string;
      styleKey: string;
    }): Promise<
      Result<{ sessionId: string; resultFileName: string; resultImagePath: string }>
    >;
    reset(): Promise<Result<PhotoWorkflowState>>;
  };
  language: {
    get(): Promise<Result<SupportedLanguage>>;
    set(language: SupportedLanguage): Promise<Result<SupportedLanguage>>;
    getAvailable(): Promise<Result<SupportedLanguage[]>>;
  };
  weather: {
    get(): Promise<Result<WeatherSnapshot | null>>;
  };
  exchange: {
    get(): Promise<Result<ExchangeSnapshot | null>>;
  };
  subtitles: {
    get(): Promise<Result<VideoEntry[] | null>>;
  };
  /** Real display-video file names on disk, per set — listed fresh at runtime so
   *  newly-added videos resolve without a rebuild. */
  videos: {
    list(): Promise<Result<VideoFilesBySet>>;
  };
  /** Touch-screen navigation; tells the customer display which video to show. */
  kiosk: {
    setScreen(screen: string): Promise<Result<string>>;
    /** Advance the customer display to the next clip for the current screen. */
    advanceVideo(): Promise<Result<boolean>>;
  };
  /** Cached shop catalogue (from the witteria API, refreshed on launch + nightly). */
  shops: {
    list(): Promise<Result<Shop[]>>;
  };
  /** Cached home button layout (from the witteria API, refreshed on launch only). */
  buttons: {
    list(): Promise<Result<KioskButton[]>>;
  };
  /** Usage stats POSTed to the witteria API (offline-queued + retried on failure). */
  stats: {
    /** Report a completed menu-touch session (button tap → back to home). */
    recordMenuTouch(input: MenuTouchInput): Promise<Result<boolean>>;
  };
  /** Live paginated events list (from the witteria API, fetched per interaction). */
  eventsApi: {
    list(query: EventsQuery): Promise<Result<EventsPage>>;
    /** MBTI-based recommendation (~2 events) for a region + MBTI string. */
    recommend(query: EventsRecommendQuery): Promise<Result<EventRecommendation[]>>;
    /** Full record for one event (GET /api/events/{eventId}). */
    detail(eventId: number): Promise<Result<EventDetail>>;
  };
  /**
   * Local display-scaling controls for the operator window. These act on the
   * renderer's own frame (Chromium zoom) — no main-process round-trip — and the
   * chosen factor is persisted so it survives reloads and restarts.
   */
  view: {
    /** Allowed zoom-factor bounds (Chromium clamps to a 0.25 minimum). */
    readonly bounds: { min: number; max: number; step: number };
    /** Current applied zoom factor (1 = 100%). */
    getZoomFactor(): number;
    /** Apply and persist a zoom factor; returns the clamped value used. */
    setZoomFactor(factor: number): number;
  };
  events: {
    onDisplayStateChanged(listener: (state: DisplayState) => void): Unsubscribe;
    onSettingsChanged(listener: (settings: AppSettings) => void): Unsubscribe;
    onMonitorsChanged(listener: (monitors: MonitorInfo[]) => void): Unsubscribe;
    onSyncStatsChanged(listener: (stats: SyncQueueStats) => void): Unsubscribe;
    onContentChanged(listener: (content: CachedContent[]) => void): Unsubscribe;
    onPhotoWorkflowChanged(listener: (state: PhotoWorkflowState) => void): Unsubscribe;
    onLanguageChanged(listener: (language: SupportedLanguage) => void): Unsubscribe;
    onWeatherChanged(listener: (weather: WeatherSnapshot) => void): Unsubscribe;
    onExchangeChanged(listener: (exchange: ExchangeSnapshot) => void): Unsubscribe;
    onKioskScreenChanged(listener: (screen: string) => void): Unsubscribe;
    onKioskVideoAdvanced(listener: () => void): Unsubscribe;
    onShopsChanged(listener: () => void): Unsubscribe;
    onButtonsChanged(listener: () => void): Unsubscribe;
  };
}
