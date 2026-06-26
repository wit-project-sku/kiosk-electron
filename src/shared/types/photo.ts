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
  statusMessage: string | null;
  errorMessage: string | null;
}

export interface PhotoGenerationProgress {
  phase: 'uploading' | 'generating' | 'saving';
  message: string;
}
