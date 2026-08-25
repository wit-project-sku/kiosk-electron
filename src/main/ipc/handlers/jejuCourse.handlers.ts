import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/**
 * 제주 AI 코스 추천 — a live POST per submission, never cached.
 *
 * Unlike the outfit/banner handlers there is nothing to serve from SQLite: the
 * answer depends on the questionnaire, on today's date and on what the visitor
 * has already been shown. A failure (offline, or the API refusing a non-제주
 * kiosk) comes back as a failed Result and the screen falls back to the
 * client-side itinerary it drew before this endpoint existed.
 */
export function registerJejuCourseHandlers(container: AppContainer): void {
  handle(IpcChannels.JejuCourseRecommend, (query) => container.jejuCourse.recommend(query));
}
