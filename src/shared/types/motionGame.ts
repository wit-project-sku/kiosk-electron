/**
 * 제주 모션 게임 — the contract between the two windows.
 *
 * ══ WHY THIS CROSSES PROCESSES AT ALL ═════════════════════════════════
 * The motion games are played on MONITOR 2 and driven from MONITOR 1, and those
 * are two separate renderer windows that share no memory. The split is physical,
 * not architectural:
 *
 *   · The camera is mounted at the customer display. A visitor playing with
 *     their body has to be standing back from the kiosk, looking at the big
 *     screen — which is the screen the camera is aimed at.
 *   · A body-controlled game has no use for a touchscreen the player is now two
 *     metres away from. Monitor 1 stops being a play surface and becomes the
 *     remote: pick a game, watch the score, stop.
 *
 * So main owns this state, exactly as it owns the photo workflow: Monitor 1
 * writes to it (start/stop), Monitor 2 writes to it (progress reports), and
 * both read it back off the same broadcast. Neither window ever talks to the
 * other directly, and neither is the source of truth.
 */

/** The camera games. Mirrors the renderer's JejuGameId motion members. */
export type MotionGameId = 'body-catch' | 'jeju-run';

/**
 * How the tracker is doing, as Monitor 2 reports it.
 *
 * Duplicated into `shared` rather than imported from the renderer's poseTypes
 * because it crosses a process boundary — the renderer re-exports THIS as its
 * own TrackingStatus so the two can never drift.
 */
export type MotionTrackingStatus =
  | 'starting'
  | 'no-player'
  | 'tracking'
  /** Seen, but standing so close the camera has cropped their shoulders off. */
  | 'too-close'
  /** Seen, but far enough away that the pose is too small to track reliably. */
  | 'too-far'
  | 'out-of-area'
  | 'crowded'
  | 'unavailable';

/** The shared lifecycle, identical on both screens. */
export type MotionGamePhase = 'calibrating' | 'countdown' | 'playing' | 'result';

export interface MotionGameState {
  /** The game running on Monitor 2, or null when nothing is. */
  game: MotionGameId | null;
  /**
   * Bumped on every start.
   *
   * This is what lets a visitor press 다시 하기 for the SAME game: without it,
   * `game` would not change between runs and Monitor 2 would have no way to
   * tell "play this again" from a duplicate broadcast. Monitor 2 keys the game
   * component on it, so a new run is a fresh mount with fresh state.
   */
  runId: number;
  phase: MotionGamePhase;
  /** Live score, as Monitor 2 reports it. Shown on the remote. */
  score: number;
  /** Live tracking status, so the remote can coach a visitor who is off-camera. */
  tracking: MotionTrackingStatus;
  /**
   * The finished run's score, set once and only in `result`.
   *
   * Separate from `score` because the remote has to keep showing the total after
   * the game component has been torn down — and because it is the value the
   * touch screen banks into JEJU POINTS, which must happen exactly once.
   */
  finalScore: number | null;
}

export function initialMotionGameState(): MotionGameState {
  return {
    game: null,
    runId: 0,
    phase: 'calibrating',
    score: 0,
    tracking: 'starting',
    finalScore: null,
  };
}

/** What Monitor 2 sends up as a run progresses. All fields optional but `phase`. */
export interface MotionGameReport {
  phase: MotionGamePhase;
  score: number;
  tracking: MotionTrackingStatus;
  /** Set only on the transition into `result`. */
  finalScore?: number | null;
}
