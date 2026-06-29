import { create } from 'zustand';
import type { PhotoWorkflowPhase } from '@shared/types/photo';

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
  /** True for the gesture-driven 인스타 효과 path (no outfit / no AI). */
  effectsMode: boolean;
  countdown: number | null;
  /** True while the countdown is held because no one is in front of the camera. */
  countdownPaused: boolean;
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
    effectsMode: boolean;
    countdown: number | null;
    countdownPaused: boolean;
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
  effectsMode: false,
  countdown: null,
  countdownPaused: false,
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
      effectsMode: wf.effectsMode,
      countdown: wf.countdown,
      countdownPaused: wf.countdownPaused,
      statusMessage: wf.statusMessage,
      errorMessage: wf.errorMessage,
    }),
}));
