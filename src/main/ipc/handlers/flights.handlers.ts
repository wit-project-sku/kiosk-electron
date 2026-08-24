import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/**
 * Registers the 제주 운항 보드 read channel. The snapshot is produced and
 * refreshed by FlightService in the main process; the renderer only reads the
 * cached value and subscribes to `FlightsChanged`.
 */
export function registerFlightHandlers(container: AppContainer): void {
  handle(IpcChannels.FlightsGet, () => container.flights.getCurrent());
}
