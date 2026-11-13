import { app } from 'electron';
import type { BootstrapData } from '@shared/ipc/contracts';
import type { AppContainer } from './container';
import { languageStore } from './core/LanguageStore';
import { isDevMode } from './core/env';
import { getKioskLocation } from '@shared/config/kioskLocations';

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

  // The synced translations belong to ONE location's sheet, recorded in the
  // `translations_layout` marker. The sheet sync wipes them when the layout
  // changes, but only once it runs — after the window has already painted, and
  // never on the dev switcher's in-place reload — so a machine switched 오산 →
  // 화성 drew 오산's strings (#JEONG-I hashtags on 안녕 '휴') until a later
  // restart. Check the marker here too, before anything reads them: a mismatch
  // drops them, and the screens use the new location's bundled table until its
  // own sheet syncs.
  const layout = getKioskLocation(kioskConfig.kioskId).layout;
  const marker = container.cache.get('translations_layout')?.data?.['layout'];
  if (typeof marker === 'string' && marker !== layout) {
    container.translations.clearAll();
    container.cache.upsert('translations_layout', { layout }, 'sync');
  }

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
    // Read from the `.env` at launch, so a test machine can be flipped without a
    // rebuild. Rides the bootstrap payload (and the synchronously injected
    // __INITIAL_STATE__) so the switcher is present on the very first paint.
    devMode: isDevMode(),
  };
}
