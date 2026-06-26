import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/** Receives usage stats from the renderer and forwards them to the witteria API. */
export function registerStatsHandlers(container: AppContainer): void {
  handle(IpcChannels.StatsMenuTouch, (input) => container.stats.recordMenuTouch(input));
}
