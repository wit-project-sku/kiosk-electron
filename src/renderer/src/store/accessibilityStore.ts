import { create } from 'zustand';

interface AccessibilityState {
  /**
   * Low-reach layout, toggled by the ♿ button on the left nav rail — for
   * wheelchair users and children who cannot reach the top of a 3840px-tall
   * portrait screen.
   */
  lowReach: boolean;
  toggleLowReach: () => void;
  setLowReach: (on: boolean) => void;
}

/**
 * Whether the kiosk is drawing its low-reach variant.
 *
 * Deliberately NOT persisted: this is a property of whoever is standing at the
 * machine right now, not of the machine, so it lives in memory only and the
 * idle attract-loop reset clears it (see useKioskController's handleIdle) —
 * otherwise the next visitor inherits the previous one's layout.
 */
export const useAccessibilityStore = create<AccessibilityState>((set) => ({
  lowReach: false,
  toggleLowReach: () => set((s) => ({ lowReach: !s.lowReach })),
  setLowReach: (on) => set({ lowReach: on }),
}));
