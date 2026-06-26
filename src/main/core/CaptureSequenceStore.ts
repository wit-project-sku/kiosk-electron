import Store from 'electron-store';

interface CaptureSequenceConfig {
  /** Monotonic count of token captures taken since the very first launch. */
  count: number;
}

const DEFAULTS: CaptureSequenceConfig = {
  count: 0,
};

let store: Store<CaptureSequenceConfig> | null = null;

function getStore(): Store<CaptureSequenceConfig> {
  if (!store) {
    store = new Store<CaptureSequenceConfig>({
      name: 'capture-sequence',
      defaults: DEFAULTS,
      clearInvalidConfig: true,
    });
  }
  return store;
}

/**
 * Persistent, ever-increasing sequence number for saved token captures.
 *
 * Starts at 1 on the first launch and keeps incrementing across the kiosk's
 * lifetime (never resets per day), so every `Captured_<date>_<n>` file gets a
 * unique, ordered number. Backed by electron-store so it survives restarts.
 */
export const captureSequence = {
  /** Reserve and return the next sequence number (1, 2, 3, …). */
  next(): number {
    const s = getStore();
    const value = s.get('count', DEFAULTS.count) + 1;
    s.set('count', value);
    return value;
  },
};
