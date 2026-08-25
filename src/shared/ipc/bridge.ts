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
import type { SpotDiffRound } from '../types/spotDiff';
import type { FootfallReport, FootfallRuntime, FootfallStats } from '../types/footfall';
import type { OutfitCatalogue } from '../types/outfit';
import type { JejuCourse, JejuCourseRecommendQuery } from '../types/jejuCourse';
import type { WeatherSnapshot } from '../types/weather';
import type { JejuFlightSnapshot } from '../types/jejuFlight';
import type { JejuSailingSnapshot } from '../types/jejuSailing';
import type { WeatherPlayKey } from '../config/weatherVideo';
import type { KioskLocationCode } from '../config/kioskLocations';
import type { ExchangeSnapshot } from '../types/exchange';
import type { VideoEntry, VideoFilesBySet } from '../types/subtitle';
import type { Shop } from '../types/shop';
import type { Attraction } from '../types/attraction';
import type { KioskButton } from '../types/buttons';
import type { KioskBanner } from '../types/banner';
import type { KioskBackground } from '../types/background';
import type { UpdateStatus } from '../types/update';
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
    /**
     * `backgroundId` is the 제주 배경 테마 (step ②) the visitor tapped, sent on as
     * the AR `background_to_use`. Omit it (or pass null) when the screen has no
     * background plates — the AR request then explicitly skips the CB template
     * set instead of letting the server pick a background on its own.
     */
    selectStyle(styleKey: string, backgroundId?: number | null): Promise<Result<PhotoWorkflowState>>;
    beginCountdown(): Promise<Result<PhotoWorkflowState>>;
    /**
     * 제주 (W006): hold the countdown until the visitor shows an open palm.
     *
     * Pressing 등록하기 is the moment they still have to WALK BACK to fit in
     * frame, so counting from that press spends the 10 seconds on the walk.
     * Arming instead leaves the camera live and the clock stopped; the customer
     * display starts it with `beginCountdown` when it sees the palm, and can
     * stop and restart it with the two calls below.
     */
    armGestureGate(): Promise<Result<PhotoWorkflowState>>;
    /** 주먹 — freeze the count at its current second. */
    holdCountdown(): Promise<Result<PhotoWorkflowState>>;
    /** 손바닥 — continue a held count from where it stopped. */
    resumeCountdown(): Promise<Result<PhotoWorkflowState>>;
    captureAndGenerate(request: {
      sessionId: string;
      dataUrl: string;
      clothingKey: string;
      styleKey: string;
    }): Promise<
      Result<{ sessionId: string; resultFileName: string; resultImagePath: string }>
    >;
    /**
     * Read a generated AI photo off local disk as a base64 data URL, so the
     * donation webview can deliver the image as bytes instead of a public URL.
     * Resolves to null if the file is missing.
     */
    getResultDataUrl(fileName: string): Promise<Result<string | null>>;
    /**
     * Hold the Monitor-2 reveal of the AI result. The school donation flow shoots
     * before payment, so the result must stay hidden until the user actually
     * reaches the payment-complete screen (revealResult). Cleared by reset().
     */
    setHoldResult(hold: boolean): Promise<Result<PhotoWorkflowState>>;
    /** Reveal a held AI result on Monitor 2 (donation payment complete). */
    revealResult(): Promise<Result<PhotoWorkflowState>>;
    /**
     * Keep Monitor 2 on the waiting screen after the AI finishes — 제주 plays
     * 틀린그림찾기 on the touch screen while generating, and the big screen must
     * not spoil the photo before the player is done. Unlike `setHoldResult`
     * (which shows a BLURRED result to push the donation payment), this shows
     * no result at all. Cleared by reset().
     */
    setDeferResultDisplay(defer: boolean): Promise<Result<PhotoWorkflowState>>;
    /** Game over — put the deferred result up on Monitor 2. */
    releaseResultDisplay(): Promise<Result<PhotoWorkflowState>>;
    reset(): Promise<Result<PhotoWorkflowState>>;
  };
  /** AR 한복 outfit catalogue + category tabs (cached from the witteria API). */
  outfits: {
    get(): Promise<Result<OutfitCatalogue>>;
  };
  /** 틀린그림찾기 round data for the generating-phase mini-game. */
  spotDiff: {
    getRound(): Promise<Result<SpotDiffRound>>;
  };
  /**
   * 제주 '제주' 뭐하지 (AI 검색) course scheduling. Live, uncached, and 제주-only —
   * the API 400s any other kiosk, which arrives as a failed Result.
   */
  jejuCourse: {
    recommend(query: JejuCourseRecommendQuery): Promise<Result<JejuCourse>>;
  };
  language: {
    get(): Promise<Result<SupportedLanguage>>;
    set(language: SupportedLanguage): Promise<Result<SupportedLanguage>>;
  };
  weather: {
    get(): Promise<Result<WeatherSnapshot | null>>;
  };
  flights: {
    get(): Promise<Result<JejuFlightSnapshot | null>>;
  };
  sailings: {
    get(): Promise<Result<JejuSailingSnapshot | null>>;
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
    /** `buttonId` (the tapped home tile's DB `buttons.id`, when known) lets the
     *  display resolve that button's video by id instead of guessing from the
     *  screen name. Omit / null for sub-states and idle navigation. */
    setScreen(screen: string, buttonId?: number | null): Promise<Result<string>>;
    /** Play the clip matching today's weather on the customer display. */
    playWeatherVideo(key: WeatherPlayKey): Promise<Result<boolean>>;
    /** Dev-mode only: persist a new kiosk id and relaunch the app as that
     *  location. On success the process exits, so this never resolves. */
    switchLocation(kioskId: KioskLocationCode): Promise<Result<boolean>>;
  };
  /** Cached shop catalogue (from the witteria API, refreshed on launch + nightly). */
  shops: {
    list(): Promise<Result<Shop[]>>;
  };
  /**
   * 제주 관광명소 — the CURATED sightseeing catalogue, not a filtered view of
   * `shops`. See `@shared/types/attraction` for what the two differ by.
   */
  attractions: {
    list(): Promise<Result<Attraction[]>>;
    /**
     * The API's own 초성 filter. Resolves to `null` when the request could
     * not be made — the caller then keeps whatever the local filter produced,
     * which is what makes the 초성 row work offline.
     */
    listByInitial(initial: string): Promise<Result<Attraction[] | null>>;
  };
  /** Cached home button layout (from the witteria API, refreshed on launch only). */
  buttons: {
    list(): Promise<Result<KioskButton[]>>;
  };
  /** Cached bottom promo banners (from the witteria API, refreshed on launch + nightly). */
  banners: {
    list(): Promise<Result<KioskBanner[]>>;
  };
  /** Cached AR 배경 테마 set (from the witteria API, refreshed on launch + nightly). */
  backgrounds: {
    list(): Promise<Result<KioskBackground[]>>;
  };
  /** Usage stats POSTed to the witteria API (offline-queued + retried on failure). */
  stats: {
    /** Report a completed menu-touch session (button tap → back to home). */
    recordMenuTouch(input: MenuTouchInput): Promise<Result<boolean>>;
  };
  /**
   * Auto-update (electron-updater + GitHub Releases). Updating is fully
   * automatic — these are read-only status plus optional operator nudges.
   */
  updates: {
    /** Current updater status (state, versions, progress, channel). */
    getStatus(): Promise<Result<UpdateStatus>>;
    /** Force an immediate check; resolves with the resulting status. */
    checkNow(): Promise<Result<UpdateStatus>>;
    /** Install a staged (downloaded) update now and restart. False if none staged. */
    installNow(): Promise<Result<boolean>>;
  };
  /**
   * 유동인구 — anonymous passer-by counting. Only the touch-screen window uses
   * this: it runs the camera pipeline and hands main integers. No frame, image,
   * or identifier ever crosses the bridge.
   */
  footfall: {
    /** What to run, on which camera, and whether to run it at all right now. */
    getRuntime(): Promise<Result<FootfallRuntime>>;
    /** Hand over a batch of line crossings plus the watch time behind them. */
    report(report: FootfallReport): Promise<Result<{ accepted: number }>>;
    /** Tell main whether a camera could actually be opened. */
    status(status: { available: boolean; deviceId: string | null }): Promise<Result<null>>;
    /** Diagnostic snapshot (today's totals, pending uploads). */
    getStats(): Promise<Result<FootfallStats>>;
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
    onFlightsChanged(listener: (flights: JejuFlightSnapshot) => void): Unsubscribe;
    onSailingsChanged(listener: (sailings: JejuSailingSnapshot) => void): Unsubscribe;
    onExchangeChanged(listener: (exchange: ExchangeSnapshot) => void): Unsubscribe;
    onKioskScreenChanged(
      listener: (payload: { screen: string; buttonId: number | null }) => void,
    ): Unsubscribe;
    onKioskWeatherVideo(listener: (key: WeatherPlayKey) => void): Unsubscribe;
    onShopsChanged(listener: () => void): Unsubscribe;
    onAttractionsChanged(listener: () => void): Unsubscribe;
    onButtonsChanged(listener: () => void): Unsubscribe;
    onBannersChanged(listener: () => void): Unsubscribe;
    onBackgroundsChanged(listener: () => void): Unsubscribe;
    onOutfitsChanged(listener: () => void): Unsubscribe;
    onUpdateStatusChanged(listener: (status: UpdateStatus) => void): Unsubscribe;
    onFootfallRuntimeChanged(listener: (runtime: FootfallRuntime) => void): Unsubscribe;
  };
}
