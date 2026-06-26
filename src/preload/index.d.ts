import type { KioskBridge } from '@shared/ipc/bridge';
import type { BootstrapData } from '@shared/ipc/contracts';

/** Augment the renderer's global scope with the typed bridge. */
declare global {
  interface Window {
    api: KioskBridge;
    /** Synchronously injected at window creation — enables instant first paint. */
    __INITIAL_STATE__?: BootstrapData;
  }
}

export {};
