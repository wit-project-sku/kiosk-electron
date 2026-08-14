import { create } from 'zustand';
import type { PhotoGestureGate, PhotoWorkflowPhase } from '@shared/types/photo';

/**
 * Photo workflow UI state — paths and status only, never image bytes.
 */
interface PhotoUIState {
  active: boolean;
  phase: PhotoWorkflowPhase;
  sessionId: string | null;
  clothingKey: string | null;
  styleKey: string | null;
  cameraDeviceId: string | null;
  resultFileName: string | null;
  resultUrl: string | null;
  countdown: number | null;
  /**
   * 제주 손동작 게이트. Read by the customer display to decide whether to draw
   * the gesture guide, the live count, or the "paused" badge — it arrives here
   * on the same workflow broadcast the touch screen gets, so both monitors
   * always agree on which of the three they are in.
   */
  gestureGate: PhotoGestureGate;
  statusMessage: string | null;
  errorMessage: string | null;
  /** Pre-selected 한복/의상 category for the next photo session (e.g. 프로모션
   *  when entering from the K-DRAMA 이벤트 참여 button). null = default tab. */
  initialCategory: string | null;
  start: () => void;
  reset: () => void;
  setInitialCategory: (category: string | null) => void;
  applyWorkflow: (state: {
    phase: PhotoWorkflowPhase;
    sessionId: string | null;
    clothingKey: string | null;
    styleKey: string | null;
    selectedCameraDeviceId: string | null;
    resultFileName: string | null;
    resultUrl: string | null;
    countdown: number | null;
    gestureGate: PhotoGestureGate;
    statusMessage: string | null;
    errorMessage: string | null;
  }) => void;
}

const IDLE = {
  active: false,
  phase: 'idle' as PhotoWorkflowPhase,
  sessionId: null,
  clothingKey: null,
  styleKey: null,
  cameraDeviceId: null,
  resultFileName: null,
  resultUrl: null,
  countdown: null,
  gestureGate: 'off' as PhotoGestureGate,
  statusMessage: null,
  errorMessage: null,
  initialCategory: null,
};

export const usePhotoStore = create<PhotoUIState>((set) => ({
  ...IDLE,
  start: () => set({ active: true }),
  reset: () => set({ ...IDLE }),
  setInitialCategory: (category) => set({ initialCategory: category }),
  applyWorkflow: (wf) =>
    set({
      active: wf.phase !== 'idle',
      phase: wf.phase,
      sessionId: wf.sessionId,
      clothingKey: wf.clothingKey,
      styleKey: wf.styleKey,
      cameraDeviceId: wf.selectedCameraDeviceId,
      resultFileName: wf.resultFileName,
      resultUrl: wf.resultUrl,
      countdown: wf.countdown,
      gestureGate: wf.gestureGate,
      statusMessage: wf.statusMessage,
      errorMessage: wf.errorMessage,
    }),
}));
