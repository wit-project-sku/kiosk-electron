/**
 * 제주 모션 게임 — the referee between the two windows.
 *
 * Owns which camera game is running and how it is going. Monitor 1 starts and
 * stops; Monitor 2 plays and reports; both read the state back off one
 * broadcast. Deliberately the same shape as PhotoWorkflowService — a small
 * mutable state, a subscriber set, and WindowManager forwarding every change to
 * every window.
 *
 * ── It holds nothing about a person ───────────────────────────────────
 * A game id, a run counter, a phase, a score, and one word for how the tracking
 * is doing. No frames, no landmarks, no identity — those never leave the
 * renderer that produced them, and nothing here is persisted or uploaded.
 *
 * ── Why the camera blocker is raised here ─────────────────────────────
 * A running motion game means the customer display has the camera open. Footfall
 * counting must yield, exactly as it does for a photo session — see the note on
 * `active` in FootfallService for why the second opener of a device is the
 * problem. Today the games only run during the photo wait, where footfall is
 * ALREADY blocked by 'photo-session', so this is belt and braces; it becomes
 * load-bearing the day anything runs a motion game outside that window.
 */
import log from 'electron-log';
import {
  initialMotionGameState,
  type MotionGameId,
  type MotionGameReport,
  type MotionGameState,
} from '@shared/types/motionGame';

type Listener = (state: MotionGameState) => void;

export class MotionGameService {
  private state: MotionGameState = initialMotionGameState();
  private readonly listeners = new Set<Listener>();

  getState(): MotionGameState {
    return { ...this.state };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Monitor 1 picked a game. A repeat of the same id is a NEW run — see runId. */
  start(game: MotionGameId): MotionGameState {
    this.state = {
      ...initialMotionGameState(),
      game,
      runId: this.state.runId + 1,
    };
    log.info('Motion game started', { game, runId: this.state.runId });
    this.emit();
    return this.getState();
  }

  /**
   * Monitor 2's progress report.
   *
   * Ignored when nothing is running: a report can arrive a beat after a stop
   * (the game component's last effect flush), and letting it through would
   * resurrect a game the visitor has already left.
   */
  report(report: MotionGameReport): MotionGameState {
    if (!this.state.game) return this.getState();
    this.state = {
      ...this.state,
      phase: report.phase,
      score: report.score,
      tracking: report.tracking,
      // Sticky: once a run has produced a final score, later reports must not
      // clear it — the remote keeps showing the total after the game is over.
      finalScore: report.finalScore ?? this.state.finalScore,
    };
    this.emit();
    return this.getState();
  }

  /** Monitor 1 pressed 그만하기, or the workflow moved on. */
  stop(): MotionGameState {
    if (!this.state.game) return this.getState();
    log.info('Motion game stopped', { game: this.state.game });
    // runId is deliberately carried, not reset: it only ever has to be unique
    // within a session, and resetting it would let the next run collide with a
    // stale broadcast still in flight.
    this.state = { ...initialMotionGameState(), runId: this.state.runId };
    this.emit();
    return this.getState();
  }

  private emit(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) listener(snapshot);
  }
}
