import { create } from 'zustand';
import type { KioskScreenId } from '@shared/types/kiosk';

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
