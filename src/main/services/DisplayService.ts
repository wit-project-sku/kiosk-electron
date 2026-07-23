import type { DisplayState } from '@shared/types/domain';
import { createLogger } from '@main/core/logger';

const log = createLogger('display-service');

type DisplayStateListener = (state: DisplayState) => void;

const INITIAL_STATE: DisplayState = {
  mode: 'attract',
  assetIds: [],
  message: null,
  cameraDeviceId: null,
  countdown: null,
  resultFileName: null,
  resultLocked: false,
};

/**
 * Single source of truth for what the customer display window is showing.
 *
 * The state lives in the main process (not in either renderer) so it survives
 * the display window being closed/reopened and can be pushed to the window the
 * moment it loads. Subscribers (the WindowManager) are notified on every change
 * and forward the new state over IPC.
 */
export class DisplayService {
  private state: DisplayState = INITIAL_STATE;
  private readonly listeners = new Set<DisplayStateListener>();

  getState(): DisplayState {
    return this.state;
  }

  setState(next: DisplayState): DisplayState {
    this.state = next;
    log.info('Display state changed', { mode: next.mode, assets: next.assetIds.length });
    this.emit();
    return this.state;
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: DisplayStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
