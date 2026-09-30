import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/**
 * 인사동 AI 코스 추천 — a live POST per request, never cached (the answer
 * depends on the clock and the interests). A failure comes back as a failed
 * Result and the screen shows its empty state.
 */
export function registerInsaCourseHandlers(container: AppContainer): void {
  handle(IpcChannels.InsaCourseRecommend, (query) => container.insaCourse.recommend(query));
}
