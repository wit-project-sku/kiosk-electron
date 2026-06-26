import { app } from 'electron';
import type { BootstrapData } from '@shared/ipc/contracts';
import type { AppContainer } from './container';
import { languageStore } from './core/LanguageStore';

function versionInfo(): BootstrapData['version'] {
  return {
    app: app.getVersion(),
    electron: process.versions.electron ?? 'unknown',
    chrome: process.versions.chrome ?? 'unknown',
    node: process.versions.node ?? 'unknown',
  };
}

/**
 * Builds the aggregate startup payload from local sources only.
 * Called before the renderer loads so data can be injected synchronously.
 */
export function buildBootstrapData(container: AppContainer): BootstrapData {
  const kioskConfig = container.kiosk.getConfig();
  const currentLanguage = languageStore.get();

  // Load all translations into memory
  container.translations.loadAll();

  return {
    settings: container.settings.get(),
    templates: container.templates.list(),
    syncStats: container.sync.getStats(),
    version: versionInfo(),
    kioskConfig,
    theme: container.kiosk.getTheme(),
    content: container.cache.listAll(),
    currentLanguage,
    translations: container.translations.getInMemoryMap(),
  };
}
