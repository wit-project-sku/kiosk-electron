import { create } from 'zustand';

/** Fired on `window` by the rail's button; useJejuVoice owns what turning on and off says. */
export const VOICE_TOGGLE_EVENT = 'jeju-voice-toggle';

/** Utterance volume for each step of the 7 / 8 keys. Low by default: a public hall. */
export const VOLUME_STEPS = [0.2, 0.4, 0.6, 0.8, 1] as const;
export const DEFAULT_VOLUME_STEP = 1;

interface VoiceState {
  /** Voice guidance is speaking at all. Off by default; see useJejuVoice. */
  on: boolean;
  /**
   * The visitor turned it off with key 3. Until the idle reset, only key 3
   * brings it back — any other key just does its job.
   */
  dismissed: boolean;
  /** Index into VOLUME_STEPS. */
  volumeStep: number;
  turnOn: () => void;
  /** Key 3: off, and it stays off for this visitor. */
  dismiss: () => void;
  /** Move the volume by one step. False when already at that end. */
  stepVolume: (delta: 1 | -1) => boolean;
  /** Back to the defaults — the 3-minute idle reset. */
  reset: () => void;
}

/**
 * 제주 voice guidance state.
 *
 * Not persisted, for the same reason as accessibilityStore's low-reach flag:
 * it belongs to whoever is at the machine now, and the idle reset clears it so
 * the next visitor does not walk up to a kiosk that is already talking.
 */
export const useVoiceStore = create<VoiceState>((set, get) => ({
  on: false,
  dismissed: false,
  volumeStep: DEFAULT_VOLUME_STEP,
  turnOn: () => set({ on: true, dismissed: false }),
  dismiss: () => set({ on: false, dismissed: true }),
  stepVolume: (delta) => {
    const next = get().volumeStep + delta;
    if (next < 0 || next >= VOLUME_STEPS.length) return false;
    set({ volumeStep: next });
    return true;
  },
  reset: () => set({ on: false, dismissed: false, volumeStep: DEFAULT_VOLUME_STEP }),
}));
