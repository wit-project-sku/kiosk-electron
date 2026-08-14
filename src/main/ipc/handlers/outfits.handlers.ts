import { IpcChannels } from '@shared/ipc/channels';
import type { OutfitCatalogue } from '@shared/types/outfit';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/**
 * Serves the cached AR 한복 outfit catalogue and its category tabs.
 *
 * Cache only — never awaits the network. The picker is the first thing a
 * visitor sees after tapping AR 한복체험, so a slow endpoint here would be a
 * blank screen. Refreshing is the sync job's business (launch + nightly).
 *
 * `fallback: true` tells the renderer the cache is empty and it should draw the
 * bundled PNG catalogue instead — a kiosk that has never synced still works.
 */
export function registerOutfitHandlers(container: AppContainer): void {
  handle(IpcChannels.OutfitsGet, (): OutfitCatalogue => {
    const outfits = container.outfits.list();
    return {
      outfits,
      categories: container.outfits.categories(),
      fallback: outfits.length === 0,
    };
  });
}
