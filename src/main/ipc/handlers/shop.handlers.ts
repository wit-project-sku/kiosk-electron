import { IpcChannels } from '@shared/ipc/channels';
import type { Shop } from '@shared/types/shop';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/** Serves the cached shop catalogue to the renderer (instant, offline). */
export function registerShopHandlers(container: AppContainer): void {
  handle(IpcChannels.ShopsList, (): Shop[] => container.shops.list());
}
