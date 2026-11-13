import { create } from 'zustand';
import type { ExpresswayTrafficSnapshot } from '@shared/types/traffic';

interface TrafficState {
  /** null until the server has answered with a value once. */
  expressway: ExpresswayTrafficSnapshot | null;
  setExpressway: (expressway: ExpresswayTrafficSnapshot) => void;
}

/**
 * Latest 화성휴게소 expressway traffic, mirrored from main by
 * {@link useExpresswayTraffic}. Kept in a store so leaving and re-entering the
 * home doesn't blank the board while the next poll is in flight.
 */
export const useTrafficStore = create<TrafficState>((set) => ({
  expressway: null,
  setExpressway: (expressway) => set({ expressway }),
}));
