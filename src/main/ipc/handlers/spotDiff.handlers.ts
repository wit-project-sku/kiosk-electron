import { IpcChannels } from '@shared/ipc/channels';
import type { SpotDiffRound } from '@shared/types/spotDiff';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/**
 * Serves one 틀린그림찾기 round to the touch screen (제주 AR 한복 waiting game).
 *
 * Reads from cache only — never awaits the network. The renderer asks for this
 * the instant the AI generation starts, so a slow endpoint here would leave the
 * player staring at an empty screen during the exact wait the game exists to
 * cover. Refreshing is the sync job's business, not this handler's.
 */
export function registerSpotDiffHandlers(container: AppContainer): void {
  handle(IpcChannels.SpotDiffGetRound, (): SpotDiffRound => container.spotDiff.pickRound());
}
