import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/**
 * Registers the exchange-rate read channel. The snapshot is produced and
 * refreshed by ExchangeService in the main process; the renderer only reads the
 * cached value and subscribes to `ExchangeChanged` (broadcast from WindowManager).
 */
export function registerExchangeHandlers(container: AppContainer): void {
  handle(IpcChannels.ExchangeGet, () => container.exchange.getCurrent());
}
