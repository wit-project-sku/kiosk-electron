import type { MotionGameId } from '@shared/types/motionGame';

/**
 * Shared vocabulary for the 제주 waiting games.
 *
 * Every game in `games/` is hosted by {@link JejuWaitingGames}, which owns the
 * things that must be true for ALL of them (the photo hand-over, the nav lock,
 * the idle rescue) and hands each game the small contract below. A game is
 * therefore a leaf: it plays, it awards points, and it asks to leave. It never
 * touches the photo workflow itself — see the header of JejuWaitingGames for
 * why that separation is not optional here.
 */

/** Which screen the hub is showing. `'hub'` is the card menu. */
/** The games played with a finger, on the touch screen. */
export type TouchGameId = 'catch' | 'cup' | 'spotdiff';

/**
 * Every game on the 제주 게임 hub.
 *
 * The motion half is imported from `shared` rather than repeated, because those
 * three ids cross a process boundary — the touch screen names one and the
 * customer display has to run it. See shared/types/motionGame.ts.
 */
export type JejuGameId = TouchGameId | MotionGameId;

/**
 * True for the games played in front of the camera rather than on the glass.
 *
 * A type predicate, not a boolean: callers branch on this to decide whether to
 * open a screen locally or ask main to put one on the other monitor, and the
 * narrowing is what stops a motion id being passed to a touch-only view.
 */
export function isMotionGame(id: JejuGameId): id is MotionGameId {
  return id === 'body-catch' || id === 'pose' || id === 'dodge';
}

/**
 * What the TOUCH screen is showing.
 *
 * Note this is not simply `'hub' | JejuGameId`: the three motion games never
 * render on this screen at all. Choosing one puts it on the customer display
 * and switches this window to `'motion'` — the remote. See MotionRemote.
 */
export type JejuGameView = 'hub' | TouchGameId | 'motion';

/**
 * The universal lifecycle every game moves through, in this order.
 *
 * `countdown` is the 3·2·1 that gives a visitor time to get their hand to the
 * screen; `result` is the score card. Games with richer inner states (the cup
 * game's show → shuffle → choose → reveal) model those SEPARATELY and stay in
 * `playing` for the whole run — mixing the two levels is what makes these
 * machines unreadable.
 */
export type GamePhase = 'idle' | 'countdown' | 'playing' | 'result';

/**
 * What a hosted game is given.
 *
 * Deliberately tiny. Anything a game needs beyond this belongs to the host, and
 * a game reaching past this contract (to the photo store, say) is a bug — see
 * the "nothing here may throw the photo away" rule in JejuSpotDiffGame.
 */
export interface HostedGameProps {
  /**
   * Leave this game and go back to the card menu. Always safe: unlike the
   * kiosk's 홈, it abandons nothing the visitor has paid for.
   */
  onExit: () => void;
  /**
   * Bank points into the session total. Called ONCE per completed run, with the
   * run's final score — not per catch, which would make the hub's counter
   * flicker through every intermediate value.
   */
  onAward: (points: number) => void;
  /** True once the AI photo has landed and the result may be shown. */
  aiReady: boolean;
  /**
   * Hand the screen to the photo result. Only offered by a game's result card,
   * and only while {@link aiReady} — before that there is nothing to show.
   */
  onSeePhoto: () => void;
}

/** One falling object in 감귤 받기. Lives in a ref, never in React state. */
export interface FallingItem {
  id: number;
  kind: 'normal' | 'golden' | 'rock';
  /** Centre, in play-field px. */
  x: number;
  y: number;
  /** px per second. */
  vy: number;
  /** Radius in play-field px — also the hit radius against the basket mouth. */
  r: number;
  /** Radians; objects tumble as they fall. */
  spin: number;
  spinRate: number;
}

/** A short-lived catch spark. Capped by MAX_PARTICLES — see the loop. */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds remaining; the particle is dropped at <= 0. */
  life: number;
  maxLife: number;
  hue: 'orange' | 'gold' | 'grey';
  size: number;
}

/** A floating "+10" over the basket. Same pool discipline as Particle. */
export interface ScorePop {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  text: string;
  golden: boolean;
}

/**
 * What a motion game is given.
 *
 * Far smaller than the touch games' HostedGameProps, and deliberately so: these
 * render on the customer display, which has no touchscreen and therefore no
 * buttons, no exit and no "see my photo". Everything a visitor can DO lives on
 * Monitor 1's remote, and the game's only outward channel is the progress
 * MotionStage reports for it.
 */
export interface MotionGameProps {
  /**
   * Bumped by main on every start. The display keys the game component on it,
   * so 다시 하기 for the SAME game is a fresh mount — see MotionGameState.runId.
   */
  runId: number;
}
