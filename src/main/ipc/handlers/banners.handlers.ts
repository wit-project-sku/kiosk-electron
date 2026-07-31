import { IpcChannels } from '@shared/ipc/channels';
import type { KioskBanner } from '@shared/types/banner';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/** Serves the cached bottom promo banners to the renderer (instant, offline). */
export function registerBannerHandlers(container: AppContainer): void {
  handle(IpcChannels.BannersList, (): KioskBanner[] => container.banners.list());
}
