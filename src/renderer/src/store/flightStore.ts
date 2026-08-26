import { create } from 'zustand';
import type { JejuFlightSnapshot } from '@shared/types/jejuFlight';

interface FlightState {
  snapshot: JejuFlightSnapshot | null;
  setSnapshot: (snapshot: JejuFlightSnapshot | null) => void;
}

/**
 * Latest 제주 운항 snapshot mirrored from the main process. Populated by
 * {@link useFlightSync}. SQLite/main remain the source of truth.
 */
export const useFlightStore = create<FlightState>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
}));
