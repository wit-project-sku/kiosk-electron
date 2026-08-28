import { create } from 'zustand';
import type { KioskScreenId } from '@shared/types/kiosk';

/**
 * The stop AFTER the one being shown, when the detail was opened from an AI
 * course — Figma 6289:58438 draws it as a card under the 상세 plate so a visitor
 * can walk the itinerary without going back to the list (6516:72906).
 *
 * `item` carries its own `courseNext`, so the chain runs to the end of the day;
 * JejuAiDetail builds it, JejuDetail draws one link of it at a time.
 */
export interface CourseNextSpot {
  /** 소요시간 at that stop, e.g. "2-3시간". */
  dwell: string;
  /** "난이도 쉬움", or '' when nothing graded it. */
  difficulty: string;
  /** The detail the card opens. */
  item: DetailItem;
}

/** A single list item expanded for the 상세 (detail) screen. */
export interface DetailItem {
  /** Source screen to return to + header label (e.g. '숙박안내'). */
  from: KioskScreenId;
  title: string;
  name: string;
  category: string;
  /** Up to 4 photos. */
  photos: string[];
  address: string;
  hours: string;
  breaktime?: string;
  phone: string;
  description: string;
  tags: string;
  rating: string;
  instagram: string;
  blogReviews: string;
  /** When set, the palace detail re-reads PALACES[palaceIndex] for live language switching. */
  palaceIndex?: number;
  /** AI course only — the next stop of the same day. See CourseNextSpot. */
  courseNext?: CourseNextSpot;
}

interface DetailState {
  item: DetailItem | null;
  setItem: (item: DetailItem | null) => void;
}

/** Holds the item currently shown on the shared 상세 detail screen. */
export const useDetailStore = create<DetailState>((set) => ({
  item: null,
  setItem: (item) => set({ item }),
}));
