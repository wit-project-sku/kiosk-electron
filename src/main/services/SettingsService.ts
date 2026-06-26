import type { AppSettings } from '@shared/types/domain';
import { settingsUpdateSchema } from '@shared/validation/settings.schema';
import { createLogger } from '@main/core/logger';
import { appConfig } from '@main/core/AppConfigStore';
import { parseOrThrow } from './validation';

const log = createLogger('settings-service');

/**
 * Reads and writes application settings via electron-store. Emits no events
 * itself; the IPC layer broadcasts `SettingsChanged` after a successful update
 * so every window stays in sync (e.g. theme changes apply to both windows).
 */
export class SettingsService {
  get(): AppSettings {
    return appConfig.getAll();
  }

  update(changes: Partial<AppSettings>): AppSettings {
    const validated = parseOrThrow(settingsUpdateSchema, changes);
    const next = appConfig.update(validated);
    log.info('Settings updated', { keys: Object.keys(validated) });
    return next;
  }
}
