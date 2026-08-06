/**
 * AI photo kiosk domain types — shared across main and renderer.
 */

import type { EntityId, IsoDateTime } from './domain';

/** Workflow phases on Monitor 1 (touch kiosk). */
export type PhotoWorkflowPhase =
  | 'idle'
  | 'clothing'
  | 'style'
  | 'preview'
  | 'countdown'
  | 'generating'
  | 'result'
  /** Gesture-driven Instagram-effects capture (no outfit, no AI). */
  | 'effects';

/** Customer display modes on Monitor 2. */
export type CustomerDisplayMode =
  | 'attract'
  | 'camera'
  | 'countdown'
  | 'generating'
  | 'result'
  | 'idle'
  | 'image'
  | 'video'
  | 'slideshow'
  | 'effects';

/**
 * Wait-time mini game — a T-Rex runner played with the BODY on Monitor 2 while
 * the AI renders the hanbok photo (~60s+). Monitor 1 (touch) is the control
 * panel: it starts the run, and once the player crashes it offers the finished
 * photo or another round. The player never touches the game itself — jumping and
 * crouching in front of the camera are the only inputs.
 */
export type GamePhase =
  /** Not offered (no camera / body control unavailable / outside generating). */
  | 'idle'
  /** Offered — waiting for PLAY on the touch screen. */
  | 'ready'
  /** PLAY pressed; Monitor 2 is running its get-into-position countdown. */
  | 'starting'
  /** Run is live. */
  | 'playing'
  /** Crashed — the touch screen offers the photo or another round. */
  | 'over';

export interface GameState {
  phase: GamePhase;
  /** Score of the run that just ended. */
  lastScore: number;
  /** Best score across this visitor's session. */
  bestScore: number;
  /**
   * True once the AI has returned and the finished photo is being HELD back so
   * the player can finish their run. The touch screen turns this into the
   * "see your photo" button.
   */
  resultReady: boolean;
  /** Held result's file name, so the touch screen can preview it before commit. */
  resultPreviewFileName: string | null;
  /** Monitor 2 reports whether the pose model actually loaded. */
  poseReady: boolean;
  /** True while a body is visible in front of the camera. */
  bodyTracked: boolean;
}

export type DriveSyncState = 'pending' | 'synced' | 'failed';

export interface PhotoSession {
  readonly id: EntityId;
  sessionId: string;
  clothingKey: string | null;
  styleKey: string | null;
  resultImagePath: string;
  driveSyncState: DriveSyncState;
  driveFileId: string | null;
  readonly createdAt: IsoDateTime;
}

export interface PhotoOption {
  key: string;
  label: string;
  imageKey?: string;
}

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  vendor: 'elgato' | 'usb' | 'unknown';
}

/** Runtime workflow state — lives in main process, synced via IPC. */
export interface PhotoWorkflowState {
  phase: PhotoWorkflowPhase;
  sessionId: string | null;
  clothingKey: string | null;
  styleKey: string | null;
  resultImagePath: string | null;
  resultFileName: string | null;
  /** Public phone-openable URL of the result, when the AI returns one. */
  resultUrl: string | null;
  /** True for the gesture-driven Instagram-effects path (no outfit / no AI) —
   *  lets the result screen show the photo + save QR instead of the store. */
  effectsMode: boolean;
  selectedCameraDeviceId: string | null;
  countdown: number | null;
  /** True while the countdown is held because no one is in front of the camera. */
  countdownPaused: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
  /** Wait-time mini game shown during `generating`. */
  game: GameState;
}

export interface PhotoGenerationProgress {
  phase: 'uploading' | 'generating' | 'saving';
  message: string;
}
