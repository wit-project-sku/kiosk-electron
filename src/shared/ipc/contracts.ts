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
import type { ExchangeSnapshot } from '../types/exchange';
import type { Shop } from '../types/shop';

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
  [IpcChannels.PhotoPauseCountdown]: {
    request: void;
    response: Result<PhotoWorkflowState>;
  };
  [IpcChannels.PhotoResumeCountdown]: {
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
  [IpcChannels.PhotoStartEffects]: {
    request: void;
    response: Result<PhotoWorkflowState>;
  };
  [IpcChannels.PhotoCaptureEffects]: {
    request: {
      dataUrl: string;
      filterId: string;
    };
    response: Result<{
      resultFileName: string;
      resultImagePath: string;
    }>;
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
  [IpcChannels.LanguageGetAvailable]: {
    request: void;
    response: Result<SupportedLanguage[]>;
  };

  [IpcChannels.WeatherGet]: {
    request: void;
    response: Result<WeatherSnapshot | null>;
  };

  [IpcChannels.ExchangeGet]: {
    request: void;
    response: Result<ExchangeSnapshot | null>;
  };
  [IpcChannels.KioskSetScreen]: {
    request: { screen: string };
    response: Result<string>;
  };
  [IpcChannels.KioskAdvanceVideo]: {
    request: void;
    response: Result<boolean>;
  };
  [IpcChannels.KioskSetEffectsWearable]: {
    request: { wearableId: string };
    response: Result<string>;
  };
  [IpcChannels.ShopsList]: {
    request: void;
    response: Result<Shop[]>;
  };
  [IpcChannels.StatsMenuTouch]: {
    request: MenuTouchInput;
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
  [IpcEvents.KioskScreenChanged]: string;
  [IpcEvents.KioskVideoAdvanced]: null;
  [IpcEvents.EffectsWearableChanged]: string;
  [IpcEvents.ShopsChanged]: null;
}

export type EventChannel = keyof IpcEventPayloads;
export type PayloadOf<E extends EventChannel> = IpcEventPayloads[E];
