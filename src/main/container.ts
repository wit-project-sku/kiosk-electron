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
import { BannerService } from './services/BannerService';
import { BackgroundService } from './services/BackgroundService';
import { AttractionService } from './services/AttractionService';
import { SpotDiffService } from './services/SpotDiffService';
import { OutfitService } from './services/OutfitService';
import { StatsService } from './services/StatsService';
import { FailedRequestService } from './services/FailedRequestService';
import { TranslationService } from './services/TranslationService';
import { WeatherService } from './services/WeatherService';
import { FlightService } from './services/FlightService';
import { SailingService } from './services/SailingService';
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
import { UpdateService } from './updater/UpdateService';
import { UpdateCommandService } from './updater/UpdateCommandService';

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
  flights: FlightService;
  sailings: SailingService;
  exchange: ExchangeService;
  subtitles: SubtitleService;
  shops: ShopService;
  buttons: ButtonLayoutService;
  banners: BannerService;
  backgrounds: BackgroundService;
  /** 제주 관광명소 catalogue (여기는 제주도 > 관광명소). */
  attractions: AttractionService;
  spotDiff: SpotDiffService;
  outfits: OutfitService;
  stats: StatsService;
  events: EventsService;
  updater: UpdateService;
  updateCommands: UpdateCommandService;
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
  const banners = new BannerService(cache, kiosk);
  const backgrounds = new BackgroundService(cache, kiosk);
  const attractions = new AttractionService(cache, kiosk);
  const spotDiff = new SpotDiffService(cache);
  const outfits = new OutfitService(cache, kiosk);
  const stats = new StatsService(kiosk, failedRequests);
  const weather = new WeatherService(cache, kiosk);
  const flights = new FlightService(cache, kiosk);
  const sailings = new SailingService(cache, kiosk);
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

  // The remote "update now" trigger drives the SAME updater instance as the
  // weekly scheduler, so both paths share one state machine (no double download,
  // no competing installs). Hence the updater is built here rather than inline
  // in the container literal below.
  const updater = new UpdateService();
  const updateCommands = new UpdateCommandService(updater, kiosk);

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
    flights,
    sailings,
    exchange,
    subtitles,
    shops,
    buttons,
    banners,
    backgrounds,
    attractions,
    spotDiff,
    outfits,
    stats,
    events,
    updater,
    updateCommands,
  };

  return container;
}

export function getContainer(): AppContainer {
  if (!container) throw new Error('Container accessed before initialization.');
  return container;
}
