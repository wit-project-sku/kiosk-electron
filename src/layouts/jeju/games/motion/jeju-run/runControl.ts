/**
 * 제주 달리기's controls: a stream of hand readings in, JUMP and DUCK out.
 *
 * Pure — no React, no DOM, no clock — so every rule below can be driven by a
 * recorded or simulated trajectory and measured. useJejuRun feeds it; nothing
 * else needs to know it exists.
 *
 * ══ A HAND PLAYS WITH THREE SHAPES, AND NOTHING ELSE ══════════════════
 *
 *   ✋ open hand   → run (the ordinary state)
 *   ✌️ V-sign      → jump — once per sign (☝️ a pointing finger works too)
 *   ✊ fist        → duck, for as long as the fist is held
 *
 * Jumping used to be "move your hand UP", measured in palm widths above a
 * baseline taken during the countdown. Even with a rolling baseline, drift
 * correction, early flick detection and a re-arm line it was the part visitors
 * could not do: a movement has to be judged by eye ("up from where? how far?"),
 * and a jump would not re-arm until the hand came back down. The duck had
 * already been moved from "hand down" to a fist for the same reason, and it
 * went from the hard half of the game to the easy half.
 *
 * So jumping is a shape now too. Where the hand is — high, low, drifting,
 * sagging — means nothing at all. There is no baseline to take and nothing to
 * calibrate: the visitor can play from the first frame.
 *
 * The BODY fallback (no hand visible) keeps its height lines — a body has no
 * fingers. Everything below the hand section is that.
 */

export type ControlSource = 'hand' | 'body';

/** What the meter shows. Pointing is shown as the V it stands in for. */
export type ControlShape = 'open' | 'fist' | 'victory';

/** What the classifier reads per frame — see classifyGameHand. */
export type HandReading = ControlShape | 'point';

export interface ControlSample {
  /** Milliseconds, monotonic. The tracker's own `lastSeenAt`. */
  t: number;
  /** Controller height, 0..1 of frame height, smoothed. Down is larger. Body only. */
  y: number;
  /** Palm width in frame-height units. Unused by the controls; kept for tracing. */
  scale: number;
  source: ControlSource;
  /** The hand's shape this frame, or null while it is in between. Hand only. */
  gesture: HandReading | null;
}

export interface ControlState {
  /** Fire one jump now. True for exactly one update per jump. */
  jump: boolean;
  /** Whether she should be ducking. */
  ducking: boolean;
  /**
   * The shape the hand is steadily holding, by vote, or null while in between.
   * Drives the meter's badges. Always null for a body.
   */
  shape: ControlShape | null;
  /**
   * BODY only: height against its baseline in threshold units, −1 the jump
   * line, +1 the duck line. Null for a hand, before calibration, or with nothing
   * seen.
   */
  level: number | null;
  /** False until the controls can act. Always true for a hand. */
  calibrated: boolean;
  /**
   * The controller is gone and nothing is standing in for it — pause the world.
   * False during the duck hold, which is the point of the duck hold.
   */
  stalled: boolean;
}

// ── Hand: the shape vote ──────────────────────────────────────────────

/**
 * Every shape decision is a vote over the last {@link SHAPE_WINDOW} fresh
 * frames (20 a second, so 150ms), never a single frame.
 *
 * ══ A WINDOWED VOTE, NOT A STREAK ═════════════════════════════════════
 * Counting consecutive frames and letting undecided ones pass turned a resting
 * open hand's rare one-frame misreads into actions: fist, undecided, undecided,
 * fist — "two in a row". Scattered misreads almost never land two in three
 * frames, and a real shape — even a sloppy one the classifier only gets right
 * most of the time — clears the vote in about 100ms.
 */
const SHAPE_WINDOW = 3;
/** Frames of the window that must show a shape for it to count as held. */
const SHAPE_VOTES = 2;
/**
 * Leaving a duck through an OPEN hand needs the whole window.
 *
 * Standing up for 100ms in the middle of a real duck — a sloppy fist misread as
 * open twice — is the gull hitting her; ducking for a moment when nothing was
 * coming costs nothing. A V-sign ends the duck at the ordinary vote, because it
 * is a deliberate jump and a fist is never misread as one.
 */
const OPEN_VOTES_TO_STAND = 3;
/**
 * A floor between jumps, against one sign being read twice. Re-arming is on the
 * SHAPE (the V must be let go), so this only matters for a flickering sign.
 */
const JUMP_MIN_GAP_MS = 250;
/**
 * For this long after a fist, a jump needs a real V held for the whole window,
 * and a lone pointing finger does not count.
 *
 * Opening a fist passes through ☝️ whenever the index finger straightens first,
 * and most people's does. In simulation, a fist opened over 300ms with the index
 * leading by 200ms read as a jump almost every time without this guard.
 */
const RELEASE_GUARD_MS = 450;
/** How long a duck survives the hand leaving the frame. */
const LOST_DUCK_HOLD_MS = 1200;

// ── Body: the old height lines ────────────────────────────────────────

/** The body's lines, in frame-height units above and below its baseline. */
const BODY = { rise: 0.055, drop: 0.085 } as const;
/** Crouch below this to duck… */
const DUCK_ENTER_LEVEL = 1;
/** …and come back above this to stand. Hysteresis against flicker. */
const DUCK_EXIT_LEVEL = 0.6;
/** Must come back down to here before the body can jump again. */
const JUMP_REARM_LEVEL = -0.35;
/** Moving down at least this fast when lost counts as ducking out of frame. */
const LOST_DOWN_SPEED = 2.5;
/** The rolling window the baseline is the median of. */
const CAL_WINDOW_MS = 900;
/** Fewest samples a baseline may be taken from. */
const CAL_MIN_SAMPLES = 8;
/** How slowly rest follows a drifting body. Slow enough never to eat a gesture. */
const DRIFT_TAU_S = 2.5;
/** Drift correction only runs while the body is this close to rest… */
const DRIFT_MAX_LEVEL = 0.4;
/** …and moving slower than this, in threshold units per second. */
const DRIFT_MAX_SPEED = 0.9;
/** Smoothing of the speed estimate, per update. */
const SPEED_SMOOTH = 0.5;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export class RunControl {
  private source: ControlSource | null = null;
  private ducking = false;
  private lastJumpAt = -Infinity;
  private lostAt = 0;
  private holdUntil = 0;

  // Hand
  /** The last few fresh frames' hand shapes, newest last. See SHAPE_WINDOW. */
  private shapes: (HandReading | null)[] = [];
  /** When a fist was last read. See RELEASE_GUARD_MS. */
  private lastFistT = -Infinity;
  private lastShapeT = 0;
  /** A V-sign has to be let go before the next one jumps. */
  private victoryArmed = true;

  // Body
  private window: ControlSample[] = [];
  private base: number | null = null;
  private lastT = 0;
  private lastLevel: number | null = null;
  private speed = 0;
  private armed = true;

  /** Forget everything. A fresh visitor or a fresh run. */
  reset(): void {
    this.source = null;
    this.ducking = false;
    this.lastJumpAt = -Infinity;
    this.lostAt = 0;
    this.holdUntil = 0;
    this.shapes = [];
    this.lastShapeT = 0;
    this.lastFistT = -Infinity;
    this.victoryArmed = true;
    this.resetBody();
  }

  /**
   * Feed one reading.
   *
   * @param sample The tracker's latest reading, or null while nothing is seen.
   * @param now Milliseconds, the same clock as `sample.t`.
   * @param playing False during the countdown: watch, but never act.
   */
  update(sample: ControlSample | null, now: number, playing: boolean): ControlState {
    if (!sample) return this.lost(now, playing);
    this.lostAt = 0;
    this.holdUntil = 0;

    // A change of input invalidates everything read from the old one.
    if (this.source !== null && this.source !== sample.source) {
      this.shapes = [];
      this.lastShapeT = 0;
      this.victoryArmed = true;
      this.resetBody();
      this.ducking = false;
    }
    this.source = sample.source;

    return sample.source === 'hand'
      ? this.updateHand(sample, now, playing)
      : this.updateBody(sample, now, playing);
  }

  // ── Hand ──────────────────────────────────────────────────────────────

  private updateHand(sample: ControlSample, now: number, playing: boolean): ControlState {
    // A reading held through a dropped frame repeats its timestamp. It is not a
    // new look at the hand, so it must not cast a second vote.
    if (this.lastShapeT === 0 || sample.t !== this.lastShapeT) {
      this.shapes.push(sample.gesture);
      if (this.shapes.length > SHAPE_WINDOW) this.shapes.shift();
      this.lastShapeT = sample.t;
      if (sample.gesture === 'fist') this.lastFistT = sample.t;
    }
    const votes = (shape: HandReading): number => this.shapes.filter((g) => g === shape).length;
    const fists = votes('fist');
    const opens = votes('open');
    // Just out of a fist, only a full window of real V-signs is a jump — see
    // RELEASE_GUARD_MS. Otherwise ✌️ and ☝️ vote together.
    const guarded = sample.t - this.lastFistT < RELEASE_GUARD_MS;
    const victories = guarded
      ? votes('victory') >= SHAPE_WINDOW
        ? SHAPE_WINDOW
        : 0
      : votes('victory') + votes('point');

    const shape: ControlShape | null =
      victories >= SHAPE_VOTES
        ? 'victory'
        : fists >= SHAPE_VOTES
          ? 'fist'
          : opens >= SHAPE_VOTES
            ? 'open'
            : null;

    // Re-arm once the V has been let go completely — not a single V frame left
    // in the window. One sign, one jump; holding the sign does not repeat.
    if (victories === 0) this.victoryArmed = true;

    if (!playing) {
      // The countdown: show the shape on the meter, act on nothing. A V held
      // through "1" should not fire the instant the run starts, so it has to be
      // let go first.
      if (victories > 0) this.victoryArmed = false;
      this.ducking = false;
      return { jump: false, ducking: false, shape, level: null, calibrated: true, stalled: false };
    }

    // ── Duck ──
    if (!this.ducking && fists >= SHAPE_VOTES && opens === 0 && victories === 0) {
      this.ducking = true;
    } else if (
      this.ducking &&
      (opens >= OPEN_VOTES_TO_STAND || victories >= SHAPE_VOTES)
    ) {
      this.ducking = false;
    }

    // ── Jump ──
    let jump = false;
    if (
      victories >= SHAPE_VOTES &&
      this.victoryArmed &&
      now - this.lastJumpAt >= JUMP_MIN_GAP_MS
    ) {
      jump = true;
      this.victoryArmed = false;
      this.lastJumpAt = now;
    }

    return { jump, ducking: this.ducking, shape, level: null, calibrated: true, stalled: false };
  }

  // ── Body ──────────────────────────────────────────────────────────────

  private resetBody(): void {
    this.window = [];
    this.base = null;
    this.lastT = 0;
    this.lastLevel = null;
    this.speed = 0;
    this.armed = true;
  }

  private updateBody(sample: ControlSample, now: number, playing: boolean): ControlState {
    // Calibration runs for the whole countdown, and continues into play only if
    // the countdown never produced a baseline.
    if (!playing || this.base === null) {
      this.calibrate(sample);
      if (!playing || this.base === null) {
        return {
          jump: false,
          ducking: false,
          shape: null,
          level: this.base === null ? null : this.levelOf(sample.y),
          calibrated: this.base !== null,
          stalled: false,
        };
      }
    }

    const level = this.levelOf(sample.y);
    const dt = this.lastT > 0 ? (sample.t - this.lastT) / 1000 : 0;
    if (dt > 0 && this.lastLevel !== null) {
      const raw = (level - this.lastLevel) / dt;
      this.speed += (raw - this.speed) * SPEED_SMOOTH;
    }
    this.lastT = sample.t;
    this.lastLevel = level;

    if (!this.ducking && level >= DUCK_ENTER_LEVEL) this.ducking = true;
    else if (this.ducking && level <= DUCK_EXIT_LEVEL) this.ducking = false;

    if (!this.armed && level >= JUMP_REARM_LEVEL) this.armed = true;
    let jump = false;
    if (this.armed && level <= -1 && now - this.lastJumpAt >= JUMP_MIN_GAP_MS) {
      jump = true;
      this.armed = false;
      this.lastJumpAt = now;
    }

    // Drift: only while still and near rest, so the baseline never chases a move.
    if (
      dt > 0 &&
      this.base !== null &&
      !this.ducking &&
      Math.abs(this.speed) < DRIFT_MAX_SPEED &&
      Math.abs(level) < DRIFT_MAX_LEVEL
    ) {
      this.base += (sample.y - this.base) * (1 - Math.exp(-dt / DRIFT_TAU_S));
    }

    return { jump, ducking: this.ducking, shape: null, level, calibrated: true, stalled: false };
  }

  private calibrate(sample: ControlSample): void {
    this.window.push(sample);
    const cutoff = sample.t - CAL_WINDOW_MS;
    while (this.window.length > 0 && this.window[0]!.t < cutoff) this.window.shift();
    if (this.window.length < CAL_MIN_SAMPLES) return;
    this.base = median(this.window.map((s) => s.y));
    this.armed = true;
    this.lastLevel = null;
    this.lastT = 0;
    this.speed = 0;
  }

  private levelOf(y: number): number {
    const d = y - (this.base ?? y);
    return d < 0 ? d / BODY.rise : d / BODY.drop;
  }

  // ── Lost ──────────────────────────────────────────────────────────────

  private lost(now: number, playing: boolean): ControlState {
    if (this.lostAt === 0) {
      this.lostAt = now;
      // Gone while ducking — or, for a body, gone while heading down fast, which
      // is a crouch out of the bottom of the frame — holds the duck for a moment
      // instead of pausing the game on the very move the visitor just made.
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
        shape: null,
        level: this.lastLevel,
        calibrated: true,
        stalled: false,
      };
    }
    this.ducking = false;
    this.holdUntil = 0;
    this.shapes = [];
    this.lastShapeT = 0;
    this.speed = 0;
    this.lastT = 0;
    // A body has to be seen near rest again before a return can fire a jump.
    this.lastLevel = null;
    return {
      jump: false,
      ducking: false,
      shape: null,
      level: null,
      calibrated: this.source === 'hand' || this.base !== null,
      stalled: true,
    };
  }
}
