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
  gestureGate: 'off',
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
  /**
   * 제주 틀린그림찾기 전용 — 생성 대기 중 터치 화면에서 게임을 하는 동안에는
   * AI 결과가 나와도 Monitor 2 를 대기 화면에 붙잡아 둔다(사진을 미리 보여
   * 주면 게임을 끝까지 할 이유가 없다). `holdResultDisplay` 는 결과를 블러로
   * 띄우지만, 이쪽은 아예 띄우지 않는다는 점이 다르다.
   * 게임 종료 시 releaseResultDisplay() 가 푼다.
   */
  private deferResultDisplay = false;

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
      // Every location arms the gate immediately after this call
      // (2026-08-24 — the 손동작 게이트 went fleet-wide). Clearing it here means
      // a second run through the flow can never inherit the previous one's gate.
      gestureGate: 'off',
      errorMessage: null,
    };
    this.syncDisplay('camera', { cameraDeviceId });
    this.emit();
    return this.state;
  }

  /**
   * Arm the 손동작 게이트 instead of counting straight away — every location
   * since 2026-08-24 (it began as 제주-only).
   *
   * The camera is already live (selectStyle put Monitor 2 in 'camera' mode);
   * this just says "we are waiting for a hand, not for the clock". The count is
   * started by beginCountdown() when the camera screen sees an open palm — or by
   * its own fallback timer if it never does, so a dead camera or an unloadable
   * model can't leave a visitor standing in front of a kiosk that never shoots.
   */
  armGestureGate(): PhotoWorkflowState {
    this.clearCountdown();
    this.state = { ...this.state, phase: 'preview', countdown: null, gestureGate: 'waiting' };
    this.syncDisplay('camera');
    this.emit();
    return this.state;
  }

  beginCountdown(): PhotoWorkflowState {
    // A gated countdown has TWO things that can start it — the visitor's open
    // palm and the camera screen's fallback timer — and they can both land
    // inside one IPC round-trip: the timer is cancelled by the state change
    // this call causes, so for a few milliseconds it is still armed. Without
    // this guard that overlap restarts the count at 10 in front of someone who
    // is already posing. Ungated callers are untouched (their gate is 'off').
    if (this.state.gestureGate === 'running' && this.state.phase === 'countdown') {
      return this.state;
    }
    this.state = {
      ...this.state,
      phase: 'countdown',
      countdown: PHOTO_COUNTDOWN_SECONDS,
      // Only a gate that was armed starts running. Since every location arms
      // the gate now, 'off' survives only for a count started outside the
      // normal flow (nothing armed it) — and must stay 'off' so the camera
      // screen does not narrate gestures nobody is watching for.
      gestureGate: this.state.gestureGate === 'off' ? 'off' : 'running',
    };
    this.syncDisplay('countdown', { countdown: PHOTO_COUNTDOWN_SECONDS });
    this.emit();
    this.runCountdown();
    return this.state;
  }

  /**
   * 주먹 — freeze the count where it is. The visitor is not ready (adjusting a
   * 한복, waiting for someone to join the frame), and restarting from 10 would
   * punish them for saying so.
   *
   * Deliberately a no-op unless a gated countdown is actually running: a stray
   * fist during 'generating' must not resurrect the timer.
   */
  holdCountdown(): PhotoWorkflowState {
    if (this.state.gestureGate !== 'running' || this.state.phase !== 'countdown') {
      return this.state;
    }
    this.clearCountdown();
    this.state = { ...this.state, gestureGate: 'held' };
    this.syncDisplay('countdown', { countdown: this.state.countdown });
    this.emit();
    return this.state;
  }

  /** 손바닥 — pick the count back up from the second it stopped at. */
  resumeCountdown(): PhotoWorkflowState {
    if (this.state.gestureGate !== 'held') return this.state;
    this.state = { ...this.state, phase: 'countdown', gestureGate: 'running' };
    this.syncDisplay('countdown', { countdown: this.state.countdown });
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
      // The shutter has already fired — close the gate so a hand still waving
      // at the camera can't call hold/resume against a finished countdown.
      gestureGate: 'off',
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
    if (this.deferResultDisplay) {
      // 틀린그림찾기 진행 중 — phase 는 'result' 로 올려 터치 화면이 "AI 준비됨"
      // 을 알 수 있게 하되, Monitor 2 는 생성 대기 화면 그대로 둔다.
      this.syncDisplay('generating');
    } else if (this.holdResultDisplay) {
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

  /**
   * 틀린그림찾기 시작/종료 시 Monitor 2 결과 노출을 미룰지 정한다.
   * 게임이 시작될 때 true, 끝날 때 releaseResultDisplay() 로 푼다.
   */
  setDeferResultDisplay(defer: boolean): PhotoWorkflowState {
    this.deferResultDisplay = defer;
    return this.state;
  }

  /**
   * 게임이 끝났다 — 미뤄 둔 결과를 Monitor 2 에 띄운다.
   * 아직 생성 중이면 플래그만 풀고, 이후 setResult 가 바로 띄운다.
   * `holdResultDisplay`(기부 결제 대기)가 걸려 있으면 그쪽 규칙이 이긴다 —
   * 게임이 끝났다는 것이 결제를 대신하지는 않기 때문이다.
   */
  releaseResultDisplay(): PhotoWorkflowState {
    this.deferResultDisplay = false;
    if (this.state.phase === 'result' && this.state.resultFileName) {
      this.syncDisplay('result', {
        resultFileName: this.state.resultFileName,
        resultLocked: this.holdResultDisplay,
      });
    }
    return this.state;
  }

  setError(message: string): PhotoWorkflowState {
    this.clearCountdown();
    this.state = {
      ...this.state,
      gestureGate: 'off',
      errorMessage: message,
      statusMessage: null,
    };
    this.syncDisplay('attract');
    this.emit();
    return this.state;
  }

  reset(): PhotoWorkflowState {
    this.clearCountdown();
    // hold 는 세션 한정 — 초기화 시 반드시 풀어야 다음 키오스크 자체 촬영이
    // 결과를 못 띄우는 일이 없다.
    this.holdResultDisplay = false;
    // 게임 도중 홈으로 나가는 경우도 여기로 온다 — 안 풀면 다음 세션의 결과가
    // Monitor 2 에 영영 뜨지 않는다.
    this.deferResultDisplay = false;
    this.state = { ...INITIAL };
    this.syncDisplay('attract');
    this.emit();
    return this.state;
  }

  resolveCameraDevice(): string | null {
    return this.state.selectedCameraDeviceId ?? this.camera.resolveDeviceId();
  }

  /**
   * Ticks `state.countdown` down to 0, one second at a time.
   *
   * Starts from whatever is ALREADY in state rather than from
   * PHOTO_COUNTDOWN_SECONDS, which is what lets resumeCountdown() pick a held
   * count back up at 7 instead of restarting it at 10.
   *
   * The decrement moved to the TOP of `tick` for the same reason. It used to
   * emit the starting value again on the first tick — harmless-looking, but it
   * made every capture take 11 seconds instead of the 10 the screen promises,
   * and on a resume it would have re-shown the held second before moving.
   */
  private runCountdown(): void {
    this.clearCountdown();
    let value = this.state.countdown ?? PHOTO_COUNTDOWN_SECONDS;

    const tick = (): void => {
      value -= 1;
      this.state = { ...this.state, countdown: value };
      this.syncDisplay('countdown', { countdown: value });
      this.emit();

      if (value <= 0) {
        this.clearCountdown();
        return;
      }

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
