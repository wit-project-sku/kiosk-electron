/**
 * Strongly-typed IPC contracts.
 *
 * `IpcContract` maps each invoke channel to its request argument and response
 * value. Both the preload bridge and the main-process handler registry are
 * built from this map, so a change here produces compile errors everywhere the
 * channel is used — the contract cannot drift between processes.
 */

import type { IpcChannels, IpcEvents } from './channels';
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
import type { CachedContent, KioskConfig, KioskTheme } from '../types/kiosk';
import type {
  CameraDeviceInfo,
  PhotoOption,
  PhotoWorkflowState,
} from '../types/photo';
import type { SupportedLanguage } from '../types/kiosk';
import type { WeatherSnapshot } from '../types/weather';
import type { WeatherPlayKey } from '../config/weatherVideo';
import type { KioskLocationCode } from '../config/kioskLocations';
import type { ExchangeSnapshot } from '../types/exchange';
import type { VideoEntry, VideoFilesBySet } from '../types/subtitle';
import type { Shop } from '../types/shop';
import type { KioskButton } from '../types/buttons';
import type { KioskBanner } from '../types/banner';
import type {
  EventDetail,
  EventRecommendation,
  EventsPage,
  EventsQuery,
  EventsRecommendQuery,
} from '../types/events';
import type { UpdateStatus } from '../types/update';

/** Request payload for importing one or more image files. */
export interface ImportImagesRequest {
  customerId: EntityId | null;
  /** Absolute source paths chosen by the user via the OS file dialog. */
  sourcePaths: string[];
}

/** Request payload for saving an in-app camera capture. */
export interface SaveCaptureRequest {
  customerId: EntityId | null;
  /** `data:image/...;base64,...` URL produced by a canvas. */
  dataUrl: string;
  fileName: string;
}

export interface AppVersionInfo {
  app: string;
  electron: string;
  chrome: string;
  node: string;
}

/**
 * Aggregate startup payload. Fetched once at launch so the renderer can warm its
 * in-memory caches (settings, templates) in a single round-trip and render
 * instantly without per-page loading spinners.
 */
export interface BootstrapData {
  settings: AppSettings;
  templates: Template[];
  syncStats: SyncQueueStats;
  version: AppVersionInfo;
  kioskConfig: KioskConfig;
  theme: KioskTheme;
  content: CachedContent[];
  currentLanguage: SupportedLanguage;
  translations: Record<string, Partial<Record<SupportedLanguage, string>>>;
  /** `DEV_MODE=true` in the app's `.env` — enables the in-app kiosk-location
   *  switcher for testing. False on every normal deployment. */
  devMode: boolean;
}

export interface AnalyticsReportRange {
  rangeStart: string | null;
  rangeEnd: string | null;
}

/**
 * The canonical request/response contract for every invoke channel.
 * Responses are always wrapped in a `Result` (see result.ts).
 */
export interface IpcContract {
  [IpcChannels.ImageList]: {
    request: { customerId: EntityId | null };
    response: Result<ImageAsset[]>;
  };
  [IpcChannels.ImageImport]: {
    request: ImportImagesRequest;
    response: Result<ImageAsset[]>;
  };
  [IpcChannels.ImageSaveCapture]: {
    request: SaveCaptureRequest;
    response: Result<ImageAsset>;
  };
  [IpcChannels.ImageDelete]: {
    request: EntityId;
    response: Result<EntityId>;
  };

  [IpcChannels.SettingsGet]: {
    request: void;
    response: Result<AppSettings>;
  };
  [IpcChannels.SettingsUpdate]: {
    request: Partial<AppSettings>;
    response: Result<AppSettings>;
  };

  [IpcChannels.DisplayGetState]: {
    request: void;
    response: Result<DisplayState>;
  };
  [IpcChannels.DisplaySetState]: {
    request: DisplayState;
    response: Result<DisplayState>;
  };
  [IpcChannels.DisplayOpen]: {
    request: void;
    response: Result<boolean>;
  };
  [IpcChannels.DisplayClose]: {
    request: void;
    response: Result<boolean>;
  };
  [IpcChannels.DisplayToggleFullscreen]: {
    request: void;
    response: Result<boolean>;
  };

  [IpcChannels.SystemGetMonitors]: {
    request: void;
    response: Result<MonitorInfo[]>;
  };
  [IpcChannels.SystemGetVersion]: {
    request: void;
    response: Result<AppVersionInfo>;
  };

  [IpcChannels.AppBootstrap]: {
    request: void;
    response: Result<BootstrapData>;
  };

  [IpcChannels.AnalyticsTrack]: {
    request: CreateAnalyticsEvent;
    response: Result<AnalyticsEvent>;
  };
  [IpcChannels.AnalyticsReport]: {
    request: AnalyticsReportRange;
    response: Result<AnalyticsReport>;
  };

  [IpcChannels.SessionStart]: {
    request: { customerId: EntityId | null; metadata: Record<string, unknown> | null };
    response: Result<Session>;
  };
  [IpcChannels.SessionEnd]: {
    request: { id: EntityId; status: SessionStatus };
    response: Result<Session>;
  };
  [IpcChannels.SessionListRecent]: {
    request: { limit: number };
    response: Result<Session[]>;
  };

  [IpcChannels.TemplateList]: {
    request: void;
    response: Result<Template[]>;
  };
  [IpcChannels.TemplateUpsert]: {
    request: Pick<Template, 'key' | 'name' | 'content' | 'enabled'>;
    response: Result<Template>;
  };

  [IpcChannels.SyncStats]: {
    request: void;
    response: Result<SyncQueueStats>;
  };
  [IpcChannels.SyncListByStatus]: {
    request: { status: SyncJobStatus; limit: number };
    response: Result<SyncJob[]>;
  };
  [IpcChannels.SyncRetry]: {
    request: EntityId;
    response: Result<SyncJob | null>;
  };

  [IpcChannels.CameraListDevices]: {
    request: void;
    response: Result<CameraDeviceInfo[]>;
  };
  [IpcChannels.CameraGetSelected]: {
    request: void;
    response: Result<{ deviceId: string | null; devices: CameraDeviceInfo[] }>;
  };
  [IpcChannels.CameraSetPreferred]: {
    request: { deviceId: string };
    response: Result<{ deviceId: string }>;
  };

  [IpcChannels.PhotoGetOptions]: {
    request: void;
    response: Result<{ clothing: PhotoOption[]; styles: PhotoOption[] }>;
  };
  [IpcChannels.PhotoGetWorkflow]: {
    request: void;
    response: Result<PhotoWorkflowState>;
  };
  [IpcChannels.PhotoStartWorkflow]: {
    request: void;
    response: Result<PhotoWorkflowState>;
  };
  [IpcChannels.PhotoSelectClothing]: {
    request: { clothingKey: string };
    response: Result<PhotoWorkflowState>;
  };
  [IpcChannels.PhotoSelectStyle]: {
    request: { styleKey: string };
    response: Result<PhotoWorkflowState>;
  };
  [IpcChannels.PhotoBeginCountdown]: {
    request: void;
    response: Result<PhotoWorkflowState>;
  };
  [IpcChannels.PhotoCaptureAndGenerate]: {
    request: {
      sessionId: string;
      dataUrl: string;
      clothingKey: string;
      styleKey: string;
    };
    response: Result<{
      sessionId: string;
      resultFileName: string;
      resultImagePath: string;
    }>;
  };
  [IpcChannels.PhotoGetResultDataUrl]: {
    request: { fileName: string };
    response: Result<string | null>;
  };
  /** 기부(학교) 흐름: 결제 완료 전까지 Monitor 2 의 AI 결과 노출을 보류한다. */
  [IpcChannels.PhotoSetHoldResult]: {
    request: { hold: boolean };
    response: Result<PhotoWorkflowState>;
  };
  /** 보류해 둔 AI 결과를 Monitor 2 에 노출한다(결제 완료). */
  [IpcChannels.PhotoRevealResult]: {
    request: void;
    response: Result<PhotoWorkflowState>;
  };
  [IpcChannels.PhotoReset]: {
    request: void;
    response: Result<PhotoWorkflowState>;
  };

  [IpcChannels.LanguageGet]: {
    request: void;
    response: Result<SupportedLanguage>;
  };
  [IpcChannels.LanguageSet]: {
    request: SupportedLanguage;
    response: Result<SupportedLanguage>;
  };
  [IpcChannels.WeatherGet]: {
    request: void;
    response: Result<WeatherSnapshot | null>;
  };

  [IpcChannels.ExchangeGet]: {
    request: void;
    response: Result<ExchangeSnapshot | null>;
  };
  [IpcChannels.SubtitlesGet]: {
    request: void;
    response: Result<VideoEntry[] | null>;
  };
  [IpcChannels.VideosList]: {
    request: void;
    response: Result<VideoFilesBySet>;
  };
  [IpcChannels.KioskSetScreen]: {
    request: { screen: string; buttonId?: number | null };
    response: Result<string>;
  };
  [IpcChannels.KioskPlayWeatherVideo]: {
    request: { key: WeatherPlayKey };
    response: Result<boolean>;
  };
  [IpcChannels.KioskSwitchLocation]: {
    request: { kioskId: KioskLocationCode };
    // Resolves only if the relaunch could not be started; on success the process
    // exits before the renderer ever sees the reply.
    response: Result<boolean>;
  };
  [IpcChannels.ShopsList]: {
    request: void;
    response: Result<Shop[]>;
  };
  [IpcChannels.ButtonsList]: {
    request: void;
    response: Result<KioskButton[]>;
  };
  [IpcChannels.BannersList]: {
    request: void;
    response: Result<KioskBanner[]>;
  };
  [IpcChannels.StatsMenuTouch]: {
    request: MenuTouchInput;
    response: Result<boolean>;
  };
  [IpcChannels.EventsGet]: {
    request: EventsQuery;
    response: Result<EventsPage>;
  };
  [IpcChannels.EventsRecommend]: {
    request: EventsRecommendQuery;
    response: Result<EventRecommendation[]>;
  };
  [IpcChannels.EventsDetailGet]: {
    request: { eventId: number };
    response: Result<EventDetail>;
  };

  [IpcChannels.UpdateGetStatus]: {
    request: void;
    response: Result<UpdateStatus>;
  };
  [IpcChannels.UpdateCheckNow]: {
    request: void;
    response: Result<UpdateStatus>;
  };
  [IpcChannels.UpdateInstallNow]: {
    request: void;
    response: Result<boolean>;
  };
}

export type InvokeChannel = keyof IpcContract;

export type RequestOf<C extends InvokeChannel> = IpcContract[C]['request'];
export type ResponseOf<C extends InvokeChannel> = IpcContract[C]['response'];

/** Payloads for one-way broadcast events (main -> renderer). */
export interface IpcEventPayloads {
  [IpcEvents.DisplayStateChanged]: DisplayState;
  [IpcEvents.SettingsChanged]: AppSettings;
  [IpcEvents.MonitorsChanged]: MonitorInfo[];
  [IpcEvents.SyncStatsChanged]: SyncQueueStats;
  [IpcEvents.ContentChanged]: CachedContent[];
  [IpcEvents.PhotoWorkflowChanged]: PhotoWorkflowState;
  [IpcEvents.LanguageChanged]: SupportedLanguage;
  [IpcEvents.WeatherChanged]: WeatherSnapshot;
  [IpcEvents.ExchangeChanged]: ExchangeSnapshot;
  [IpcEvents.KioskScreenChanged]: { screen: string; buttonId: number | null };
  [IpcEvents.KioskWeatherVideo]: WeatherPlayKey;
  [IpcEvents.ShopsChanged]: null;
  [IpcEvents.ButtonsChanged]: null;
  [IpcEvents.BannersChanged]: null;
  [IpcEvents.UpdateStatusChanged]: UpdateStatus;
}

export type EventChannel = keyof IpcEventPayloads;
export type PayloadOf<E extends EventChannel> = IpcEventPayloads[E];
