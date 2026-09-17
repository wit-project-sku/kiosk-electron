/**
 * The One Euro filter (Casiez, Roussel & Vogel, CHI 2012) — adaptive smoothing
 * for a hand-held pointer.
 *
 * ══ WHY NOT THE PLAIN EXPONENTIAL SMOOTHING THE BODY USES ══════════════
 * A fixed time constant is one trade-off for the whole game: smooth enough to
 * hide the landmark model's frame-to-frame jitter while the hand is STILL, and
 * therefore laggy while it is MOVING. For a torso that was acceptable — bodies
 * do not flick. A hand does, and a jump is exactly a flick: the old filter was
 * still catching up to a raised hand when the rock arrived.
 *
 * The One Euro filter varies the cut-off with speed. At rest the cut-off is low
 * and jitter disappears, which is what stops a hand hovering near the duck line
 * from flickering her up and down. In motion the cut-off rises and the filter
 * all but gets out of the way, which is what makes a jump register on the way
 * up instead of after the hand has already stopped.
 *
 * Pure: no DOM, no clock of its own. Time is passed in, so it is testable and so
 * an irregular inference interval (the loop slows under load) is handled
 * correctly rather than assumed away.
 */
export class OneEuroFilter {
  private value: number | null = null;
  private derivative = 0;
  private lastT = 0;

  /**
   * @param minCutoff Hz. Smoothing at rest — lower is steadier and laggier.
   * @param beta How quickly the cut-off opens with speed. Higher is snappier.
   * @param dCutoff Hz. Smoothing of the speed estimate itself.
   */
  constructor(
    private readonly minCutoff: number,
    private readonly beta: number,
    private readonly dCutoff = 1,
  ) {}

  reset(): void {
    this.value = null;
    this.derivative = 0;
    this.lastT = 0;
  }

  /** @param tSeconds A monotonic timestamp in seconds. */
  filter(x: number, tSeconds: number): number {
    if (this.value === null) {
      this.value = x;
      this.lastT = tSeconds;
      return x;
    }
    const dt = tSeconds - this.lastT;
    // A repeated or backwards timestamp carries no information about speed;
    // treat it as "no time passed" rather than dividing by zero.
    if (dt <= 0) return this.value;
    this.lastT = tSeconds;

    const rawDerivative = (x - this.value) / dt;
    this.derivative += (rawDerivative - this.derivative) * smoothingFactor(dt, this.dCutoff);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.derivative);
    this.value += (x - this.value) * smoothingFactor(dt, cutoff);
    return this.value;
  }
}

function smoothingFactor(dt: number, cutoff: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}
