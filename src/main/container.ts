/**
 * Composition root — extended with AI photo pipeline services.
 */

import { database, type Database } from './database/Database';
import { ImageRepository } from './database/repositories/ImageRepository';
import { AnalyticsRepository } from './database/repositories/AnalyticsRepository';
import { SessionRepository } from './database/repositories/SessionRepository';
import { TemplateRepository } from './database/repositories/TemplateRepository';
import { SyncQueueRepository } from './database/repositories/SyncQueueRepository';
import { LocalCacheRepository } from './database/repositories/LocalCacheRepository';
import { FailedRequestRepository } from './database/repositories/FailedRequestRepository';
import { PhotoSessionRepository } from './database/repositories/PhotoSessionRepository';
import { TranslationRepository } from './database/repositories/TranslationRepository';
import { ImageService } from './services/ImageService';
import { SettingsService } from './services/SettingsService';
import { DisplayService } from './services/DisplayService';
import { AnalyticsService } from './services/AnalyticsService';
import { SessionService } from './services/SessionService';
import { TemplateService } from './services/TemplateService';
import { KioskService } from './services/KioskService';
import { LocalCacheService } from './services/LocalCacheService';
import { ShopService } from './services/ShopService';
import { ButtonLayoutService } from './services/ButtonLayoutService';
import { StatsService } from './services/StatsService';
import { FailedRequestService } from './services/FailedRequestService';
import { TranslationService } from './services/TranslationService';
import { WeatherService } from './services/WeatherService';
import { ExchangeService } from './services/ExchangeService';
import { SubtitleService } from './services/SubtitleService';
import { EventsService } from './services/EventsService';
import { SyncService } from './services/sync/SyncService';
import { CameraService } from './services/camera/CameraService';
import { CaptureService } from './services/camera/CaptureService';
import { AIService } from './services/ai/AIService';
import { GoogleDriveService } from './services/drive/GoogleDriveService';
import { PhotoGenerationService } from './services/photo/PhotoGenerationService';
import { ImageHostService } from './services/photo/ImageHostService';
import { PhotoWorkflowService } from './services/photo/PhotoWorkflowService';

export interface AppContainer {
  database: Database;
  images: ImageService;
  settings: SettingsService;
  display: DisplayService;
  analytics: AnalyticsService;
  sessions: SessionService;
  templates: TemplateService;
  sync: SyncService;
  kiosk: KioskService;
  cache: LocalCacheService;
  failedRequests: FailedRequestService;
  camera: CameraService;
  capture: CaptureService;
  ai: AIService;
  drive: GoogleDriveService;
  photoGeneration: PhotoGenerationService;
  photoWorkflow: PhotoWorkflowService;
  translations: TranslationService;
  weather: WeatherService;
  exchange: ExchangeService;
  subtitles: SubtitleService;
  shops: ShopService;
  buttons: ButtonLayoutService;
  stats: StatsService;
  events: EventsService;
}

let container: AppContainer | null = null;

export function createContainer(): AppContainer {
  if (container) return container;

  const imageRepo = new ImageRepository(database);
  const analyticsRepo = new AnalyticsRepository(database);
  const sessionRepo = new SessionRepository(database);
  const templateRepo = new TemplateRepository(database);
  const syncRepo = new SyncQueueRepository(database);
  const cacheRepo = new LocalCacheRepository(database);
  const failedRepo = new FailedRequestRepository(database);
  const photoSessionRepo = new PhotoSessionRepository(database);
  const translationRepo = new TranslationRepository(database);

  const kiosk = new KioskService();
  const analytics = new AnalyticsService(analyticsRepo, kiosk);
  const cache = new LocalCacheService(cacheRepo);
  const failedRequests = new FailedRequestService(failedRepo);
  const translations = new TranslationService(translationRepo);
  const shops = new ShopService(cache, kiosk);
  const buttons = new ButtonLayoutService(cache, kiosk);
  const stats = new StatsService(kiosk, failedRequests);
  const weather = new WeatherService(cache, kiosk);
  const exchange = new ExchangeService(cache);
  const subtitles = new SubtitleService(cache, kiosk);
  const events = new EventsService();

  const display = new DisplayService();
  const camera = new CameraService();
  const capture = new CaptureService();
  // AIService defaults to the Digicon AR transport (process_image / process_and_combine).
  const ai = new AIService(failedRequests);
  const drive = new GoogleDriveService(failedRequests);
  const imageHost = new ImageHostService();
  const photoGeneration = new PhotoGenerationService(
    capture,
    ai,
    drive,
    photoSessionRepo,
    analytics,
    imageHost,
    stats,
  );
  const photoWorkflow = new PhotoWorkflowService(display, camera);

  const sync = new SyncService(syncRepo, analyticsRepo, failedRequests, cache, photoGeneration);
  sync.setTransport(SyncService.createTransport(cache, failedRequests, kiosk, translations));
  // Let night sync retry any menu-touch POSTs that failed while offline.
  sync.setStatsService(stats);

  container = {
    database,
    sync,
    analytics,
    images: new ImageService(imageRepo, sync, analytics),
    settings: new SettingsService(),
    display,
    sessions: new SessionService(sessionRepo, analytics),
    templates: new TemplateService(templateRepo),
    kiosk,
    cache,
    failedRequests,
    camera,
    capture,
    ai,
    drive,
    photoGeneration,
    photoWorkflow,
    translations,
    weather,
    exchange,
    subtitles,
    shops,
    buttons,
    stats,
    events,
  };

  return container;
}

export function getContainer(): AppContainer {
  if (!container) throw new Error('Container accessed before initialization.');
  return container;
}
