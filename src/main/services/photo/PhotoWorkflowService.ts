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
  /**
   * 기부(학교) 흐름 전용 — 촬영은 결제 전에 끝나므로, 결제 완료 전에 AI 결과를
   * 선명하게 보여 주면 안 된다(사진만 받고 이탈). true 면 setResult 가 결과를
   * 블러 잠금(resultLocked) 상태로 띄우고, revealResult() 시(결제 완료) 풀린다.
   */
  private holdResultDisplay = false;

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
    if (this.holdResultDisplay) {
      // 기부(학교) 흐름 — 결제 완료 전이다. 결과를 선명하게 띄우면 안 되지만,
      // 완전히 숨기면(어트랙트 영상) 결과가 나왔다는 사실조차 알 수 없다.
      // 블러 + 안내 문구로 "결과는 준비됐다"만 보여주고 내용은 가린다 → 결제 유도.
      // 결제 완료(revealResult) 시 블러가 풀린다. 결제 없이 이탈하면 reset() 이
      // 어트랙트 영상으로 되돌린다.
      this.syncDisplay('result', { resultFileName, resultLocked: true });
    } else {
      // 키오스크 자체 촬영: 결과를 Monitor 2 에 바로 크게 띄운다.
      this.syncDisplay('result', { resultFileName });
    }
    this.emit();
    return this.state;
  }

  /**
   * 결과를 Monitor 2 에 바로 띄울지 보류할지 정한다.
   * 기부 웹뷰가 촬영을 시작할 때 학교 흐름이면 true 로 건다.
   */
  setHoldResultDisplay(hold: boolean): PhotoWorkflowState {
    this.holdResultDisplay = hold;
    return this.state;
  }

  /**
   * 보류해 둔 결과를 Monitor 2 에 노출한다(기부 결제 완료 시점).
   * 아직 생성 중이면 hold 만 풀고, 이후 setResult 가 바로 띄운다.
   */
  revealResult(): PhotoWorkflowState {
    this.holdResultDisplay = false;
    if (this.state.phase === 'result' && this.state.resultFileName) {
      this.syncDisplay('result', { resultFileName: this.state.resultFileName });
    }
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
    // hold 는 세션 한정 — 초기화 시 반드시 풀어야 다음 키오스크 자체 촬영이
    // 결과를 못 띄우는 일이 없다.
    this.holdResultDisplay = false;
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
    extras?: Partial<
      Pick<DisplayState, 'cameraDeviceId' | 'countdown' | 'resultFileName' | 'resultLocked'>
    >,
  ): void {
    const current = this.display.getState();
    this.display.setState({
      mode,
      assetIds: current.assetIds,
      message: current.message,
      cameraDeviceId: extras?.cameraDeviceId ?? this.state.selectedCameraDeviceId,
      countdown: extras?.countdown ?? null,
      resultFileName: extras?.resultFileName ?? null,
      // 명시하지 않으면 항상 해제 — 잠금은 setResult(hold) 한 곳에서만 건다.
      resultLocked: extras?.resultLocked ?? false,
    });
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }
}
