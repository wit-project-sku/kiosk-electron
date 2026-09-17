/**
 * 제주 달리기's controls: a stream of hand heights in, JUMP and DUCK out.
 *
 * Pure — no React, no DOM, no clock — so every rule below can be driven by a
 * recorded or simulated trajectory and measured, which is how the numbers in it
 * were chosen. useJejuRun feeds it; nothing else needs to know it exists.
 *
 * ══ WHAT IT DOES BETTER THAN THE THRESHOLD IT REPLACES ════════════════
 * The first version was two fixed lines — 11% of the frame above where the hand
 * was during the countdown, 13% below — and it lost accuracy in five separate
 * ways, each of which has its own fix here:
 *
 *  1. DISTANCE. A fixed fraction of the frame is a large arm movement for a
 *     visitor two metres back and a small one for a child at arm's length. The
 *     lines are now measured in PALM WIDTHS of this visitor's own hand, which
 *     shrinks with distance at exactly the rate their movement does.
 *
 *  2. A BAD BASELINE. It was the median of the first twenty samples of the
 *     countdown — which is usually when the hand is still arriving. It is now
 *     the median of a ROLLING window, re-taken for as long as calibration lasts,
 *     so it is the hand's position at the END of the countdown, when it is
 *     actually still.
 *
 *  3. LATE JUMPS. A jump waited for the hand to cross the full line. A real
 *     raise is a flick, and a fast flick is unmistakable well before it
 *     finishes, so a quick enough upward movement now fires at half the
 *     distance ({@link JUMP_EARLY_LEVEL}).
 *
 *  4. FLICKER. One line for entering AND leaving a duck meant a hand resting
 *     near it toggled her up and down on noise alone. Leaving now needs the hand
 *     back well above the line ({@link DUCK_EXIT_LEVEL}) — ordinary hysteresis.
 *
 *  5. ARM SAG. An unsupported arm drifts down over half a minute, until "rest"
 *     is sitting on the duck line. While the hand is resting near its baseline
 *     the baseline now follows it, slowly ({@link DRIFT_TAU_S}).
 *
 * And one rule for a failure that was not about precision at all: a hand lost
 * while ducking holds the duck for a moment instead of pausing the game
 * ({@link LOST_DUCK_HOLD_MS}).
 *
 * ══ A FIST DUCKS; "DOWN" MEANS NOTHING ════════════════════════════════
 * For a HAND the controls are now:
 *
 *   ✋ open hand, anywhere        → run
 *   ✋⬆️ move the hand up          → jump
 *   ✊ close it into a fist        → duck, for as long as the fist is held
 *
 * Ducking used to be "lower your hand below a line", and even with every fix
 * above it was the hard half of the game. A downward line has to be judged by
 * eye, the arm is already falling under its own weight, and a deep enough drop
 * takes the hand out of the frame. A fist has none of those problems: it is a
 * SHAPE, not a distance, so there is nothing to judge — it is either closed or
 * it is not.
 *
 * Freeing "down" also makes the rest of the control forgiving. A visitor can let
 * their arm sag, rest it, or hold it wherever is comfortable; nothing happens
 * until the hand goes UP or CLOSES. The baseline now follows the hand downward
 * freely for exactly that reason (see the drift rule), so "up" is always
 * measured from wherever the hand has settled.
 *
 * The BODY fallback keeps the old downward duck — a body has no fist.
 */

export type ControlSource = 'hand' | 'body';

export interface ControlSample {
  /** Milliseconds, monotonic. The tracker's own `lastSeenAt`. */
  t: number;
  /** Controller height, 0..1 of frame height, smoothed. Down is larger. */
  y: number;
  /**
   * Palm width in frame-height units. Ignored for the body, which has no palm
   * and keeps its own fixed lines.
   */
  scale: number;
  source: ControlSource;
  /**
   * The hand's shape this frame, or null while it is in between. Drives the duck
   * for a hand; ignored for a body.
   */
  gesture: 'open' | 'fist' | null;
}

export interface ControlState {
  /** Fire one jump now. True for exactly one update per jump. */
  jump: boolean;
  /** Whether she should be ducking. */
  ducking: boolean;
  /**
   * The hand's height against its baseline in threshold units: −1 is the jump
   * line, +1 the duck line. Null before calibration or with no hand.
   */
  level: number | null;
  /** False until a baseline exists. */
  calibrated: boolean;
  /**
   * The controller is gone and nothing is standing in for it — pause the world.
   * False during the duck hold, which is the point of the duck hold.
   */
  stalled: boolean;
}

// ── Lines, in palm widths ─────────────────────────────────────────────

/**
 * How far above rest a hand must go to jump, in palm widths.
 *
 * About one and a half hands: a deliberate raise clears it easily at any
 * distance, and a hand drifting while the visitor steers or talks does not.
 */
const RISE_PALMS = 1.6;
/** How far below rest to duck. Larger, because arms sag and hands drop to rest. */
const DROP_PALMS = 1.9;

/**
 * Clamps on the lines, in frame-height units.
 *
 * The floor stops a tiny, far-away palm making the lines so close that jitter
 * alone crosses them; the ceiling stops a hand held right at the lens asking
 * for a movement taller than the frame.
 */
const RISE_MIN = 0.05;
const RISE_MAX = 0.2;
const DROP_MIN = 0.06;
const DROP_MAX = 0.22;

/** The body's lines, unchanged from when it was the only controller. */
const BODY = { rise: 0.055, drop: 0.085 } as const;

// ── Jump ──────────────────────────────────────────────────────────────

/** A fast enough raise fires once it is this far up. See header, item 3. */
const JUMP_EARLY_LEVEL = 0.5;
/** "Fast enough", in threshold units per second (upward is negative). */
const JUMP_FLICK_SPEED = 3.2;
/**
 * The hand must come back down to here before it can jump again.
 *
 * Re-arming on the hand's position rather than on a timer is what makes the
 * control predictable: one raise, one jump. Holding the hand up does not
 * machine-gun jumps every half second, and a quick second raise after a quick
 * return is never refused because a lockout has not expired.
 */
const JUMP_REARM_LEVEL = -0.35;
/** A floor between jumps, against a single raise being read twice on noise. */
const JUMP_MIN_GAP_MS = 220;

// ── Duck ──────────────────────────────────────────────────────────────

/** BODY only — a body ducks by crouching below this line. */
const DUCK_ENTER_LEVEL = 1;
/** Hysteresis — see header, item 4. */
const DUCK_EXIT_LEVEL = 0.6;

/**
 * The hand-shape vote: of the last {@link SHAPE_WINDOW} fresh frames, this many
 * must read FIST (and none OPEN) to duck, and ALL of them OPEN to stand back up.
 *
 * ══ A WINDOWED VOTE, NOT A STREAK ═════════════════════════════════════
 * The first version counted consecutive fists and let undecided frames (a hand
 * the classifier cannot call) pass without resetting the count. In simulation
 * that turned a resting open hand's rare one-frame misreads into ducks: fist,
 * undecided, undecided, fist — "two in a row" — and she dropped for no reason,
 * over half a minute of false ducking in five minutes of play.
 *
 * A vote over a short window has neither failure. Scattered misreads almost
 * never land two in three frames, and a real fist — even a sloppy one the
 * classifier only gets right most of the time — clears it in about 100ms.
 *
 * ── Why getting UP is stricter than getting DOWN ─────────────────────
 * The two errors do not cost the same. Standing up for 100ms in the middle of a
 * real duck — a sloppy fist misread as open twice — is the gull hitting her.
 * Ducking for a moment when nothing was coming costs nothing at all, because a
 * raised hand still jumps out of it (see the jump rule). So leaving a duck needs
 * the whole window to agree. In simulation that took duck flicker from 39 blips
 * to none and held ducks from 86% to 90%, for some extra harmless ducking on a
 * half-curled hand. Tighter ENTRY was tried too and was a bad trade: 3-of-4
 * dropped held ducks to 71%, 4-of-4 to 42%.
 */
const SHAPE_WINDOW = 3;
const FIST_VOTES = 2;
const OPEN_VOTES = 3;
/** How long a duck survives the hand leaving the frame. See header. */
const LOST_DUCK_HOLD_MS = 1200;
/** Moving down at least this fast when lost counts as ducking out of frame. */
const LOST_DOWN_SPEED = 2.5;

// ── Calibration and drift ─────────────────────────────────────────────

/** The rolling window the baseline is the median of. */
const CAL_WINDOW_MS = 900;
/** Fewest samples a baseline may be taken from. */
const CAL_MIN_SAMPLES = 8;
/**
 * The window must be this still — its 10th-to-90th percentile spread, in palm
 * widths — to count. A hand still settling into position is not a baseline.
 */
const CAL_MAX_SPREAD_PALMS = 0.7;
/** How slowly rest follows a sagging arm. Slow enough never to eat a gesture. */
const DRIFT_TAU_S = 2.5;
/**
 * How quickly rest follows a hand that went up and STAYED up.
 *
 * Jumps re-arm on the hand coming back down, so a visitor who raises their hand
 * and simply leaves it there could never jump again. Letting rest catch up with
 * a hand held still up high makes that position the new rest — and re-arms.
 */
const HELD_UP_TAU_S = 1.0;
/**
 * …but only once it has been held up this long. An ordinary jump holds the hand
 * up for a quarter of a second; letting rest chase THAT would leave the baseline
 * stranded above the hand when it came back down.
 */
const HELD_UP_AFTER_MS = 600;
/** Drift correction only runs while the hand is this close to rest… */
const DRIFT_MAX_LEVEL = 0.4;
/** …and moving slower than this, in threshold units per second. */
const DRIFT_MAX_SPEED = 0.9;
/** Smoothing of the speed estimate, per update. */
const SPEED_SMOOTH = 0.5;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
}

export class RunControl {
  private window: ControlSample[] = [];
  private base: number | null = null;
  private rise: number = BODY.rise;
  private drop: number = BODY.drop;
  private source: ControlSource | null = null;

  private lastT = 0;
  private lastLevel: number | null = null;
  private speed = 0;

  private armed = true;
  private lastJumpAt = -Infinity;
  private ducking = false;
  private lostAt = 0;
  private holdUntil = 0;
  /** The last few fresh frames' hand shapes, newest last. See SHAPE_WINDOW. */
  private shapes: ('open' | 'fist' | null)[] = [];
  private heldUpSince = 0;

  /** Forget everything, including the baseline. A fresh visitor or a fresh run. */
  reset(): void {
    this.window = [];
    this.base = null;
    this.source = null;
    this.lastT = 0;
    this.lastLevel = null;
    this.speed = 0;
    this.armed = true;
    this.lastJumpAt = -Infinity;
    this.ducking = false;
    this.lostAt = 0;
    this.holdUntil = 0;
    this.shapes = [];
    this.heldUpSince = 0;
  }

  /**
   * Feed one reading.
   *
   * @param sample The tracker's latest reading, or null while nothing is seen.
   * @param now Milliseconds, the same clock as `sample.t`.
   * @param playing False during the countdown: calibrate, but never act.
   */
  update(sample: ControlSample | null, now: number, playing: boolean): ControlState {
    if (!sample) return this.lost(now, playing);
    this.lostAt = 0;
    this.holdUntil = 0;

    // A change of input invalidates everything measured from the old one: a
    // baseline taken from a raised palm means nothing against a shoulder line
    // most of a frame lower down.
    if (this.source !== null && this.source !== sample.source) {
      this.window = [];
      this.base = null;
      this.lastLevel = null;
      this.ducking = false;
    }
    this.source = sample.source;

    // ── Calibration ──
    // Runs for the whole countdown, and continues into play only if the
    // countdown never produced a still enough window.
    if (!playing || this.base === null) {
      this.calibrate(sample);
      if (!playing || this.base === null) {
        return {
          jump: false,
          ducking: false,
          level: this.base === null ? null : this.levelOf(sample.y),
          calibrated: this.base !== null,
          stalled: false,
        };
      }
    }

    const level = this.levelOf(sample.y);
    const byHand = sample.source === 'hand';

    // ── Speed, in threshold units per second ──
    const dt = this.lastT > 0 ? (sample.t - this.lastT) / 1000 : 0;
    // A reading held through a dropped frame repeats its timestamp. It is not
    // a new look at the hand, so it must not advance a fist or open streak.
    const fresh = this.lastT === 0 || sample.t !== this.lastT;
    if (dt > 0 && this.lastLevel !== null) {
      const raw = (level - this.lastLevel) / dt;
      this.speed += (raw - this.speed) * SPEED_SMOOTH;
    }
    this.lastT = sample.t;
    this.lastLevel = level;

    // ── Duck ──
    if (byHand) {
      // A fist, by vote. See SHAPE_WINDOW.
      if (fresh) {
        this.shapes.push(sample.gesture);
        if (this.shapes.length > SHAPE_WINDOW) this.shapes.shift();
      }
      const fists = this.shapes.filter((g) => g === 'fist').length;
      const opens = this.shapes.filter((g) => g === 'open').length;
      if (!this.ducking && fists >= FIST_VOTES && opens === 0) this.ducking = true;
      else if (this.ducking && opens >= OPEN_VOTES) this.ducking = false;
    } else if (!this.ducking && level >= DUCK_ENTER_LEVEL) {
      this.ducking = true;
    } else if (this.ducking && level <= DUCK_EXIT_LEVEL) {
      this.ducking = false;
    }

    // ── Jump ──
    if (!this.armed && level >= JUMP_REARM_LEVEL) this.armed = true;
    let jump = false;
    const crossed = level <= -1;
    const flicked = level <= -JUMP_EARLY_LEVEL && this.speed <= -JUMP_FLICK_SPEED;
    // The EARLY flick is ignored while a fist is closing or held: closing a hand
    // shifts its knuckles, and that small fast movement must not jump her out
    // of a duck. A FULL raise always jumps, fist or not — a false duck on a
    // half-curled hand must never be what stops her clearing a rock.
    const closing = byHand && (this.ducking || this.shapes.at(-1) === 'fist');
    if (
      this.armed &&
      (crossed || (flicked && !closing)) &&
      now - this.lastJumpAt >= JUMP_MIN_GAP_MS
    ) {
      jump = true;
      this.armed = false;
      this.lastJumpAt = now;
    }

    // ── Drift ──
    // Only while the hand is still, so the baseline can never chase a gesture.
    // Applied after this reading has been judged against the old baseline.
    const still = Math.abs(this.speed) < DRIFT_MAX_SPEED;
    if (dt > 0 && still && this.base !== null && !this.ducking) {
      // For a hand, anywhere BELOW rest is rest too — down means nothing, so an
      // arm that sags or drops to the visitor's side simply moves the rest
      // point with it. For a body, only near rest, because down is its duck.
      const belowIsRest = byHand && level > 0;
      if (belowIsRest || Math.abs(level) < DRIFT_MAX_LEVEL) {
        this.base += (sample.y - this.base) * (1 - Math.exp(-dt / DRIFT_TAU_S));
      } else if (byHand && !this.armed && level < JUMP_REARM_LEVEL) {
        // Raised and left there: catch up, which re-arms. See HELD_UP_TAU_S.
        if (this.heldUpSince === 0) this.heldUpSince = now;
        if (now - this.heldUpSince >= HELD_UP_AFTER_MS) {
          this.base += (sample.y - this.base) * (1 - Math.exp(-dt / HELD_UP_TAU_S));
        }
      }
    }
    if (this.armed || level >= JUMP_REARM_LEVEL || !still) this.heldUpSince = 0;

    return { jump, ducking: this.ducking, level, calibrated: true, stalled: false };
  }

  private lost(now: number, playing: boolean): ControlState {
    if (this.lostAt === 0) {
      this.lostAt = now;
      // Gone while ducking, or gone while heading down fast: the hand has left
      // through the bottom of the frame, which is a duck, not an absence.
      // Body only: for a hand, down is not a duck, so leaving downward is not
      // one either.
      const leftDownward =
        this.source === 'body' &&
        this.lastLevel !== null &&
        this.lastLevel > 0.3 &&
        this.speed >= LOST_DOWN_SPEED;
      if (playing && (this.ducking || leftDownward)) {
        this.ducking = true;
        this.holdUntil = now + LOST_DUCK_HOLD_MS;
      }
    }
    if (this.holdUntil > 0 && now < this.holdUntil) {
      return {
        jump: false,
        ducking: true,
        level: this.lastLevel,
        calibrated: this.base !== null,
        stalled: false,
      };
    }
    this.ducking = false;
    this.holdUntil = 0;
    this.shapes = [];
    this.speed = 0;
    this.lastT = 0;
    // The hand has to be seen near rest again before a return can fire a jump.
    this.lastLevel = null;
    return {
      jump: false,
      ducking: false,
      level: null,
      calibrated: this.base !== null,
      stalled: true,
    };
  }

  private calibrate(sample: ControlSample): void {
    this.window.push(sample);
    const cutoff = sample.t - CAL_WINDOW_MS;
    while (this.window.length > 0 && this.window[0]!.t < cutoff) this.window.shift();
    if (this.window.length < CAL_MIN_SAMPLES) return;

    const scale = median(this.window.map((s) => s.scale));
    const ys = this.window.map((s) => s.y).sort((a, b) => a - b);
    const spread = quantile(ys, 0.9) - quantile(ys, 0.1);
    const palm = sample.source === 'hand' && scale > 0 ? scale : null;

    // Too much movement to trust. Keep whatever baseline was last good.
    if (palm !== null && spread > CAL_MAX_SPREAD_PALMS * palm) return;

    this.base = median(ys);
    if (palm !== null) {
      this.rise = clamp(RISE_PALMS * palm, RISE_MIN, RISE_MAX);
      this.drop = clamp(DROP_PALMS * palm, DROP_MIN, DROP_MAX);
    } else {
      this.rise = BODY.rise;
      this.drop = BODY.drop;
    }
    this.armed = true;
    this.lastLevel = null;
    this.lastT = 0;
    this.speed = 0;
  }

  private levelOf(y: number): number {
    const d = y - (this.base ?? y);
    return d < 0 ? d / this.rise : d / this.drop;
  }
}
