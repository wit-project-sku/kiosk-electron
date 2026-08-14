import { IpcChannels } from '@shared/ipc/channels';
import type { Shop } from '@shared/types/shop';
import type { Attraction } from '@shared/types/attraction';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/** Serves the cached shop catalogue to the renderer (instant, offline). */
export function registerShopHandlers(container: AppContainer): void {
  handle(IpcChannels.ShopsList, (): Shop[] => container.shops.list());

  // 제주 관광명소. A separate catalogue rather than a filter over the one above —
  // see @shared/types/attraction for the rows the two differ by.
  handle(IpcChannels.AttractionsList, (): Attraction[] => container.attractions.list());

  handle(
    IpcChannels.AttractionsListByInitial,
    (req: { initial: string }): Promise<Attraction[] | null> =>
      container.attractions.listByInitial(String(req?.initial ?? '')),
  );
}
