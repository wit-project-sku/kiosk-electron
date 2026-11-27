/**
 * 오늘의 사연 rows for the screens, from GET /api/stories?kioskId= (LotteService → lotteLive.ts):
 * approved in the admin's 사연 관리 (C-08), at most 30 from the last 7 days, the admin's order
 * first and then newest. No sample stories — they would read as real visitors' messages — so an
 * empty answer, or none yet, is the C-06 사연 없음 screen.
 */
import type { LotteStory } from '@shared/types/lotte';

export type StoryKind = 'photo' | 'video' | 'text';

export interface Story {
  id: number;
  kind: StoryKind;
  title: string;
  body: string;
  author: string;
  /** 'MM. DD' as the list prints it. */
  date: string;
  /** Photo (webp) or video (mp4). Absent → the frame's placeholder panel. */
  mediaUrl?: string;
}

export const STORY_KIND_LABEL: Record<StoryKind, string> = { photo: '사진', video: '영상', text: '글' };

const KIND: Record<LotteStory['type'], StoryKind> = { PHOTO: 'photo', VIDEO: 'video', TEXT: 'text' };

/** '2026-11-13T10:21:00' → '11. 13' */
const listDate = (iso: string): string => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}. ${m[2]}` : '';
};

export const toStory = (s: LotteStory): Story => ({
  id: s.id,
  kind: KIND[s.type],
  title: s.title,
  body: s.body ?? '',
  author: s.displayName,
  date: listDate(s.approvedAt),
  mediaUrl: s.mediaUrl ?? undefined,
});
