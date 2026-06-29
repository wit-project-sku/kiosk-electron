import { randomUUID } from 'node:crypto';
import type { PhotoWorkflowState } from '@shared/types/photo';
import type { DisplayState } from '@shared/types/domain';
import { PHOTO_COUNTDOWN_SECONDS } from '@shared/constants/photoOptions';
import type { DisplayService } from '@main/services/DisplayService';
import type { CameraService } from '@main/services/camera/CameraService';

type WorkflowListener = (state: PhotoWorkflowState) => void;

const INITIAL: PhotoWorkflowState = {
  phase: 'idle',
  sessionId: null,
  clothingKey: null,
  styleKey: null,
  resultImagePath: null,
  resultFileName: null,
  resultUrl: null,
  effectsMode: false,
  selectedCameraDeviceId: null,
  countdown: null,
  countdownPaused: false,
  statusMessage: null,
  errorMessage: null,
};

/**
 * Single source of truth for the AI photo workflow.
 * Drives Monitor 2 display state automatically on every transition.
 */
export class PhotoWorkflowService {
  private state: PhotoWorkflowState = { ...INITIAL };
  private readonly listeners = new Set<WorkflowListener>();
  private countdownTimer: NodeJS.Timeout | null = null;
  /** Remaining seconds; survives pause/resume so the count doesn't restart. */
  private countdownValue = 0;
  /** True while the count is held because no one is in front of the camera. */
  private countdownPaused = false;

  constructor(
    private readonly display: DisplayService,
    private readonly camera: CameraService,
  ) {}

  getState(): PhotoWorkflowState {
    return this.state;
  }

  subscribe(listener: WorkflowListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  startWorkflow(): PhotoWorkflowState {
    this.clearCountdown();
    this.state = {
      ...INITIAL,
      phase: 'clothing',
      sessionId: randomUUID(),
    };
    this.syncDisplay('attract');
    this.emit();
    return this.state;
  }

  selectClothing(clothingKey: string): PhotoWorkflowState {
    this.state = { ...this.state, clothingKey, phase: 'style', errorMessage: null };
    this.syncDisplay('attract');
    this.emit();
    return this.state;
  }

  selectStyle(styleKey: string, cameraDeviceId: string | null): PhotoWorkflowState {
    this.state = {
      ...this.state,
      styleKey,
      phase: 'preview',
      selectedCameraDeviceId: cameraDeviceId,
      errorMessage: null,
    };
    this.syncDisplay('camera', { cameraDeviceId });
    this.emit();
    return this.state;
  }

  /**
   * Enter the gesture-driven Instagram-effects path. No outfit, no AI: Monitor 2
   * shows the live camera + filter carousel and the user changes effects / shoots
   * entirely by hand gesture. A sessionId is (re)used so the capture can be saved.
   */
  startEffects(): PhotoWorkflowState {
    this.clearCountdown();
    const cameraDeviceId = this.resolveCameraDevice();
    this.state = {
      ...this.state,
      phase: 'effects',
      effectsMode: true,
      sessionId: this.state.sessionId ?? randomUUID(),
      clothingKey: null,
      styleKey: 'effects',
      selectedCameraDeviceId: cameraDeviceId,
      resultFileName: null,
      resultImagePath: null,
      resultUrl: null,
      countdown: null,
      statusMessage: null,
      errorMessage: null,
    };
    this.syncDisplay('effects', { cameraDeviceId });
    this.emit();
    return this.state;
  }

  beginCountdown(): PhotoWorkflowState {
    this.countdownValue = PHOTO_COUNTDOWN_SECONDS;
    this.countdownPaused = false;
    this.state = {
      ...this.state,
      phase: 'countdown',
      countdown: PHOTO_COUNTDOWN_SECONDS,
      countdownPaused: false,
    };
    this.syncDisplay('countdown', { countdown: PHOTO_COUNTDOWN_SECONDS });
    this.emit();
    this.scheduleTick();
    return this.state;
  }

  /**
   * Hold the capture countdown — used by the customer display when the person
   * steps out of the camera frame, so we never auto-capture an empty shot and
   * feed it to the AI. The displayed number freezes at its current value.
   *
   * Emits `countdownPaused: true` so Monitor 1 can arm an absence timeout and
   * return to home if no one comes back.
   */
  pauseCountdown(): PhotoWorkflowState {
    if (this.state.phase !== 'countdown' || this.countdownPaused) return this.state;
    this.countdownPaused = true;
    this.clearCountdown();
    this.state = { ...this.state, countdownPaused: true };
    this.emit();
    return this.state;
  }

  /** Resume a held countdown once the person is back in frame. */
  resumeCountdown(): PhotoWorkflowState {
    if (this.state.phase !== 'countdown' || !this.countdownPaused) return this.state;
    this.countdownPaused = false;
    this.state = { ...this.state, countdownPaused: false };
    this.emit();
    this.scheduleTick();
    return this.state;
  }

  setGenerating(message: string): PhotoWorkflowState {
    this.clearCountdown();
    this.state = {
      ...this.state,
      phase: 'generating',
      countdown: null,
      statusMessage: message,
      errorMessage: null,
    };
    this.syncDisplay('generating');
    this.emit();
    return this.state;
  }

  setResult(resultImagePath: string, resultFileName: string, resultUrl: string | null = null): PhotoWorkflowState {
    this.state = {
      ...this.state,
      phase: 'result',
      resultImagePath,
      resultFileName,
      resultUrl,
      countdown: null,
      statusMessage: null,
      errorMessage: null,
    };
    // Always show the result image big on Monitor 2 — every kiosk, payment or
    // not. The main touch screen shows it too; Monitor 2 falls back to the
    // attract video on reset.
    this.syncDisplay('result', { resultFileName });
    this.emit();
    return this.state;
  }

  setError(message: string): PhotoWorkflowState {
    this.clearCountdown();
    this.state = { ...this.state, errorMessage: message, statusMessage: null };
    this.syncDisplay('attract');
    this.emit();
    return this.state;
  }

  reset(): PhotoWorkflowState {
    this.clearCountdown();
    this.state = { ...INITIAL };
    this.syncDisplay('attract');
    this.emit();
    return this.state;
  }

  resolveCameraDevice(): string | null {
    return this.state.selectedCameraDeviceId ?? this.camera.resolveDeviceId();
  }

  private scheduleTick(): void {
    this.clearCountdown();
    this.countdownTimer = setTimeout(() => this.tick(), 1000);
  }

  private tick(): void {
    // Guard against a stray timer firing after a pause/phase change.
    if (this.countdownPaused || this.state.phase !== 'countdown') return;

    this.countdownValue -= 1;
    const value = this.countdownValue;
    this.state = { ...this.state, countdown: value };
    this.syncDisplay('countdown', { countdown: value });
    this.emit();

    if (value <= 0) {
      this.clearCountdown();
      return;
    }

    this.scheduleTick();
  }

  private clearCountdown(): void {
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.countdownTimer = null;
  }

  private syncDisplay(
    mode: DisplayState['mode'],
    extras?: Partial<Pick<DisplayState, 'cameraDeviceId' | 'countdown' | 'resultFileName'>>,
  ): void {
    const current = this.display.getState();
    this.display.setState({
      mode,
      assetIds: current.assetIds,
      message: current.message,
      cameraDeviceId: extras?.cameraDeviceId ?? this.state.selectedCameraDeviceId,
      countdown: extras?.countdown ?? null,
      resultFileName: extras?.resultFileName ?? null,
    });
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }
}
