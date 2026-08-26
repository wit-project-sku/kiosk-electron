import { create } from 'zustand';
import type { JejuSailingSnapshot } from '@shared/types/jejuSailing';

interface SailingState {
  snapshot: JejuSailingSnapshot | null;
  setSnapshot: (snapshot: JejuSailingSnapshot | null) => void;
}

/**
 * Latest 제주 선박 운항 snapshot mirrored from the main process. Populated by
 * {@link useSailingSync}. SQLite/main remain the source of truth.
 */
export const useSailingStore = create<SailingState>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
}));
