import type { AppContainer } from '@main/container';
import type { WindowManager } from '@main/windows/WindowManager';
import { createLogger } from '@main/core/logger';
import { registerImageHandlers } from './handlers/image.handlers';
import { registerSettingsHandlers } from './handlers/settings.handlers';
import { registerDisplayHandlers } from './handlers/display.handlers';
import { registerSystemHandlers } from './handlers/system.handlers';
import { registerAppHandlers } from './handlers/app.handlers';
import { registerAnalyticsHandlers } from './handlers/analytics.handlers';
import { registerSessionHandlers } from './handlers/session.handlers';
import { registerTemplateHandlers } from './handlers/template.handlers';
import { registerSyncHandlers } from './handlers/sync.handlers';
import { registerCameraHandlers } from './handlers/camera.handlers';
import { registerPhotoHandlers } from './handlers/photo.handlers';
import { registerLanguageHandlers } from './handlers/language.handlers';
import { registerWeatherHandlers } from './handlers/weather.handlers';
import { registerExchangeHandlers } from './handlers/exchange.handlers';
import { registerKioskHandlers } from './handlers/kiosk.handlers';
import { registerShopHandlers } from './handlers/shop.handlers';
import { registerButtonHandlers } from './handlers/buttons.handlers';
import { registerBannerHandlers } from './handlers/banners.handlers';
import { registerStatsHandlers } from './handlers/stats.handlers';
import { registerSubtitleHandlers } from './handlers/subtitle.handlers';
import { registerVideoHandlers } from './handlers/video.handlers';
import { registerEventsHandlers } from './handlers/events.handlers';
import { registerUpdateHandlers } from './handlers/update.handlers';

const log = createLogger('ipc');

/**
 * Single entry point for wiring the entire IPC surface. Called once after the
 * container and window manager are ready.
 */
export function registerIpcHandlers(container: AppContainer, windows: WindowManager): void {
  registerImageHandlers(container);
  registerSettingsHandlers(container, windows);
  registerDisplayHandlers(container, windows);
  registerSystemHandlers(windows);
  registerAppHandlers(container);
  registerAnalyticsHandlers(container);
  registerSessionHandlers(container);
  registerTemplateHandlers(container);
  registerSyncHandlers(container);
  registerCameraHandlers(container, windows);
  registerPhotoHandlers(container);
  registerLanguageHandlers(container, windows);
  registerWeatherHandlers(container);
  registerExchangeHandlers(container);
  registerKioskHandlers(windows, container);
  registerShopHandlers(container);
  registerButtonHandlers(container);
  registerBannerHandlers(container);
  registerStatsHandlers(container);
  registerSubtitleHandlers(container);
  registerVideoHandlers(container);
  registerEventsHandlers(container);
  registerUpdateHandlers(container);
  log.info('IPC handlers registered');
}
