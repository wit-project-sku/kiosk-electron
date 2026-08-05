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

/**
 * How far the capture camera is physically rotated on its mount, in degrees
 * clockwise. UVC cameras never report this — a vertically mounted camera still
 * streams 1920×1080 with the scene lying on its side — so the app has to undo
 * it. 90/270 mean the camera hangs vertically and both the preview and the
 * saved capture become portrait 1080×1920 (9:16).
 */
export type CameraRotation = 0 | 90 | 180 | 270;

export const CAMERA_ROTATIONS: readonly CameraRotation[] = [0, 90, 180, 270];

/**
 * Fleet default. 270 = camera mounted vertically with its left edge up, which
 * is how the kiosks are built — verified on site. A machine whose camera is
 * still horizontal must override it with VITE_CAMERA_ROTATION=0.
 */
export const DEFAULT_CAMERA_ROTATION: CameraRotation = 270;

export function isCameraRotation(value: unknown): value is CameraRotation {
  return CAMERA_ROTATIONS.includes(value as CameraRotation);
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
  selectedCameraDeviceId: string | null;
  countdown: number | null;
  /**
   * Bumped by requestCapture() — the display window takes a shot whenever this
   * increases. A counter rather than a boolean so two shots in a row are two
   * distinct events (manual capture mode; see PHOTO_MANUAL_CAPTURE).
   */
  captureToken: number;
  statusMessage: string | null;
  errorMessage: string | null;
}

export interface PhotoGenerationProgress {
  phase: 'uploading' | 'generating' | 'saving';
  message: string;
}
