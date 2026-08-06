import { randomUUID } from 'node:crypto';
import type { GameState, PhotoWorkflowState } from '@shared/types/photo';
import type { DisplayState } from '@shared/types/domain';
import { PHOTO_COUNTDOWN_SECONDS } from '@shared/constants/photoOptions';
import type { DisplayService } from '@main/services/DisplayService';
import type { CameraService } from '@main/services/camera/CameraService';

type WorkflowListener = (state: PhotoWorkflowState) => void;

/**
 * Minimum time on the generating screen when the visitor never plays — the
 * advertised "60 seconds" the customer display counts down.
 */
const GENERATING_MIN_MS = 60_000;
/**
 * Once the run ends with the photo already in hand, show it by itself if the
 * visitor walks off without choosing. A kiosk must never wait forever.
 */
const RESULT_AUTO_SHOW_MS = 30_000;
/**
 * Absolute ceiling on holding a finished photo back, whatever the game says.
 * Backstop against a wedged renderer that never reports its game over.
 */
const RESULT_HOLD_CAP_MS = 5 * 60_000;

const IDLE_GAME: GameState = {
  phase: 'idle',
  lastScore: 0,
  bestScore: 0,
  resultReady: false,
  resultPreviewFileName: null,
  poseReady: false,
  bodyTracked: false,
};

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
  game: IDLE_GAME,
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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

  /** When the generating phase started — anchors the 60s no-game minimum. */
  private generatingStartedAt = 0;
  /** Resolvers waiting to be allowed to publish a finished photo. */
  private releaseResolvers: Array<() => void> = [];
  private autoShowTimer: NodeJS.Timeout | null = null;
  private holdCapTimer: NodeJS.Timeout | null = null;

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
    // Called repeatedly as generation progress arrives — only the FIRST call
    // opens the wait window and offers the game, or every progress tick would
    // reset a run in progress.
    const first = this.state.phase !== 'generating';
    if (first) this.generatingStartedAt = Date.now();
    this.state = {
      ...this.state,
      phase: 'generating',
      countdown: null,
      statusMessage: message,
      errorMessage: null,
      // 인스타 효과 never reaches here, but be explicit: only the AI path plays.
      game: first ? { ...IDLE_GAME, phase: 'ready', bestScore: this.state.game.bestScore } : this.state.game,
    };
    this.syncDisplay('generating');
    this.emit();
    return this.state;
  }

  // ── Wait-time mini game ────────────────────────────────────────────────────
  // Monitor 2 runs the game; Monitor 1 is the control panel. Everything lives
  // here so both windows read the same state off one broadcast.

  private setGame(patch: Partial<GameState>): PhotoWorkflowState {
    this.state = { ...this.state, game: { ...this.state.game, ...patch } };
    this.emit();
    return this.state;
  }

  /** Touch screen: PLAY. Monitor 2 then runs its get-into-position countdown. */
  startGame(): PhotoWorkflowState {
    if (this.state.phase !== 'generating') return this.state;
    if (this.state.game.phase !== 'ready' && this.state.game.phase !== 'over') return this.state;
    this.clearAutoShow();
    return this.setGame({ phase: 'starting', lastScore: 0 });
  }

  /** Monitor 2: countdown finished, the run is live. */
  beginGame(): PhotoWorkflowState {
    if (this.state.game.phase !== 'starting') return this.state;
    return this.setGame({ phase: 'playing' });
  }

  /** Monitor 2: the player crashed. */
  endGame(score: number): PhotoWorkflowState {
    if (this.state.game.phase !== 'playing' && this.state.game.phase !== 'starting') {
      return this.state;
    }
    const best = Math.max(this.state.game.bestScore, score);
    const next = this.setGame({ phase: 'over', lastScore: score, bestScore: best });
    // If the photo is already waiting, start the walk-away timer now.
    if (next.game.resultReady) this.armAutoShow();
    return next;
  }

  /** Touch screen: another round (the photo keeps waiting). */
  replayGame(): PhotoWorkflowState {
    if (this.state.game.phase !== 'over') return this.state;
    this.clearAutoShow();
    return this.setGame({ phase: 'starting', lastScore: 0 });
  }

  /** Monitor 2: is body control actually usable right now? */
  reportPose(poseReady: boolean, bodyTracked: boolean): PhotoWorkflowState {
    if (this.state.game.poseReady === poseReady && this.state.game.bodyTracked === bodyTracked) {
      return this.state;
    }
    return this.setGame({ poseReady, bodyTracked });
  }

  /** The AI returned — park the photo until the player is done with it. */
  markResultReady(resultFileName: string): PhotoWorkflowState {
    const next = this.setGame({ resultReady: true, resultPreviewFileName: resultFileName });
    if (next.game.phase === 'over') this.armAutoShow();
    return next;
  }

  /**
   * Block until it is the visitor's moment to see the photo.
   *
   * Never played  → the advertised 60s on the generating screen, as before.
   * Mid-run       → until they crash AND choose to see it (or walk away).
   * Always        → capped, so a wedged renderer can't swallow someone's photo.
   */
  async waitForResultRelease(): Promise<void> {
    const idleBefore = this.state.game.phase === 'idle' || this.state.game.phase === 'ready';
    if (idleBefore) {
      const remaining = GENERATING_MIN_MS - (Date.now() - this.generatingStartedAt);
      if (remaining > 0) await delay(remaining);
      // They may have hit PLAY during that wait — never yank a live run away.
      const phase = this.state.game.phase;
      if (phase === 'idle' || phase === 'ready') return;
    }

    if (this.state.game.phase === 'over') this.armAutoShow();

    return new Promise<void>((resolve) => {
      this.releaseResolvers.push(resolve);
      if (!this.holdCapTimer) {
        this.holdCapTimer = setTimeout(() => this.releaseResult(), RESULT_HOLD_CAP_MS);
      }
    });
  }

  /** Touch screen: show me the photo. Also the escape hatch for reset/error. */
  releaseResult(): PhotoWorkflowState {
    this.clearAutoShow();
    if (this.holdCapTimer) {
      clearTimeout(this.holdCapTimer);
      this.holdCapTimer = null;
    }
    const resolvers = this.releaseResolvers;
    this.releaseResolvers = [];
    for (const resolve of resolvers) resolve();
    return this.state;
  }

  private armAutoShow(): void {
    this.clearAutoShow();
    this.autoShowTimer = setTimeout(() => this.releaseResult(), RESULT_AUTO_SHOW_MS);
  }

  private clearAutoShow(): void {
    if (this.autoShowTimer) clearTimeout(this.autoShowTimer);
    this.autoShowTimer = null;
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
      // The game is over as a screen — keep the best score for the session so a
      // replay from the result screen still has something to beat.
      game: { ...IDLE_GAME, bestScore: this.state.game.bestScore },
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
    // Tear the game down: there is no photo coming, so playing on would be a lie.
    this.releaseResult();
    this.state = {
      ...this.state,
      errorMessage: message,
      statusMessage: null,
      game: { ...IDLE_GAME, bestScore: this.state.game.bestScore },
    };
    this.syncDisplay('attract');
    this.emit();
    return this.state;
  }

  reset(): PhotoWorkflowState {
    this.clearCountdown();
    // Someone pressed home mid-game — never leave a held photo (or its waiter)
    // dangling behind the next visitor's session.
    this.releaseResult();
    this.generatingStartedAt = 0;
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
