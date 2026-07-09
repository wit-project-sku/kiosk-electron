import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

export function registerSubtitleHandlers(container: AppContainer): void {
  handle(IpcChannels.SubtitlesGet, () => container.subtitles.getEntries());
}
