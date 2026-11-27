import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/** 롯데 (W012~W014) 상영 시간표 · 오늘의 사연 · 영화 나눔 — polled by the renderer, see LotteService. */
export function registerLotteHandlers(container: AppContainer): void {
  handle(IpcChannels.LotteShowtimesGet, () => container.lotte.getShowtimes());
  handle(IpcChannels.LotteStoriesGet, () => container.lotte.getStories());
  handle(IpcChannels.LotteMovieShareSummaryGet, () => container.lotte.getMovieShareSummary());
}
