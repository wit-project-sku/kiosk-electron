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
  | 'result';

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
  | 'slideshow';

/**
 * 제주 (W006) 손동작 게이트 — who is driving the capture countdown.
 *
 * Every other location starts counting the instant the visitor presses the
 * capture button, which is the wrong moment: they still have to walk back far
 * enough to fit in frame, and the count is already running while they do it.
 * 제주 hands the trigger to the visitor instead — the camera screen watches for
 * an open palm to start and a closed fist to hold — so the 10 seconds are 10
 * seconds of posing rather than 10 seconds of walking.
 *
 *  'off'     — no gate; the countdown was started directly (all non-제주 flows).
 *  'waiting' — armed, camera live, nothing counting yet. Show the gesture guide.
 *  'running' — counting down.
 *  'held'    — a fist paused it; `countdown` keeps the value it stopped at.
 *
 * The gate lives in main (next to the countdown timer it controls) rather than
 * on Monitor 2, because both screens have to agree on it: Monitor 2 reads it to
 * decide what to draw, and the touch screen's own capture popup follows the same
 * workflow state.
 */
export type PhotoGestureGate = 'off' | 'waiting' | 'running' | 'held';

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
  /**
   * 'depth' is a DEPTH SENSOR, not a photo camera — today the 제주 kiosks' ZED
   * 2i, which measures visitor height headlessly and must never be opened by
   * `getUserMedia`. It is enumerated (an operator listing the kiosk's cameras
   * should see it) but excluded from selection. See CameraService.
   */
  vendor: 'elgato' | 'usb' | 'depth' | 'unknown';
}

/** Runtime workflow state — lives in main process, synced via IPC. */
export interface PhotoWorkflowState {
  phase: PhotoWorkflowPhase;
  sessionId: string | null;
  clothingKey: string | null;
  styleKey: string | null;
  /**
   * 배경 테마 chosen in step ② of the 제주 outfit screen, or null when the visitor
   * picked none (the 제주 default — nothing is pre-selected) or the kiosk has no
   * background set assigned at all (every other location today). Lives here
   * beside clothingKey/styleKey because Monitor 2 fires the capture and reads
   * all three off the same workflow broadcast. Sent onward as the AR
   * `background_to_use`; null means "skip the CB template set".
   */
  backgroundId: number | null;
  resultImagePath: string | null;
  resultFileName: string | null;
  /** Public phone-openable URL of the result, when the AI returns one. */
  resultUrl: string | null;
  selectedCameraDeviceId: string | null;
  countdown: number | null;
  /** 제주 손동작 게이트. 'off' everywhere else — see PhotoGestureGate. */
  gestureGate: PhotoGestureGate;
  statusMessage: string | null;
  errorMessage: string | null;
}

export interface PhotoGenerationProgress {
  phase: 'uploading' | 'generating' | 'saving';
  message: string;
}
