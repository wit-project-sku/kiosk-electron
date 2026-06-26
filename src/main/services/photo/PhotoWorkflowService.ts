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
  selectedCameraDeviceId: null,
  countdown: null,
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

  beginCountdown(): PhotoWorkflowState {
    this.state = { ...this.state, phase: 'countdown', countdown: PHOTO_COUNTDOWN_SECONDS };
    this.syncDisplay('countdown', { countdown: PHOTO_COUNTDOWN_SECONDS });
    this.emit();
    this.runCountdown();
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

  private runCountdown(): void {
    this.clearCountdown();
    let value = PHOTO_COUNTDOWN_SECONDS;

    const tick = (): void => {
      this.state = { ...this.state, countdown: value };
      this.syncDisplay('countdown', { countdown: value });
      this.emit();

      if (value <= 0) {
        this.clearCountdown();
        return;
      }

      value -= 1;
      this.countdownTimer = setTimeout(tick, 1000);
    };

    this.countdownTimer = setTimeout(tick, 1000);
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
