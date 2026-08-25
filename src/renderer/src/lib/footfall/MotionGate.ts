/**
 * The cheap question asked before the expensive one: did anything move?
 *
 * A kiosk corridor is empty for most of the day and all of the night. Running a
 * neural network four times a second at 3 a.m. to confirm that a wall is still a
 * wall costs real watts and real CPU on a machine that is also decoding 4K
 * video. This downsamples the frame to a 32×24 thumbnail and compares it to the
 * previous one — a few hundred microseconds — and only wakes the detector when
 * enough of it changed.
 *
 * The threshold is on the LOW side deliberately. A missed person is a permanent
 * hole in the data; a needless detector pass costs five milliseconds. Camera
 * noise, an auto-exposure adjustment, and a shadow moving across the floor all
 * pass the gate, and that is the correct trade — the detector then finds nothing
 * and the frame costs what it would have cost anyway.
 */

/** Thumbnail size. Small enough to be free, large enough that a distant person
 *  still occupies more than one cell. */
const GRID_WIDTH = 32;
const GRID_HEIGHT = 24;

/** Mean per-pixel luma change (0–255) that counts as "something happened". */
const MOTION_THRESHOLD = 2.5;

/**
 * Frames the gate lets through after motion stops.
 *
 * A person who stops walking to read the screen stops producing motion, and
 * their track would then be starved of detections and expire mid-frame. Coasting
 * for a couple of seconds keeps live tracks fed until they genuinely leave.
 */
const COAST_FRAMES = 8;

export class MotionGate {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private previous: Float32Array | null = null;
  private coasting = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = GRID_WIDTH;
    this.canvas.height = GRID_HEIGHT;
    // willReadFrequently keeps Chromium from promoting this to a GPU-backed
    // canvas, which would make every getImageData a stall.
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  /** Drop history — the next frame is a fresh baseline, not a comparison. */
  reset(): void {
    this.previous = null;
    this.coasting = 0;
  }

  /**
   * @returns true when the detector should run on this frame. Fails OPEN: if the
   *   canvas is unavailable for any reason, every frame is passed through, so a
   *   broken optimization can only cost performance, never counts.
   */
  shouldDetect(video: HTMLVideoElement): boolean {
    if (!this.ctx) return true;

    try {
      this.ctx.drawImage(video, 0, 0, GRID_WIDTH, GRID_HEIGHT);
    } catch {
      return true;
    }

    const { data } = this.ctx.getImageData(0, 0, GRID_WIDTH, GRID_HEIGHT);
    const current = new Float32Array(GRID_WIDTH * GRID_HEIGHT);
    for (let i = 0; i < current.length; i++) {
      const p = i * 4;
      // Rec. 601 luma — chroma adds nothing to a "did it change" question.
      current[i] = 0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!;
    }

    const previous = this.previous;
    this.previous = current;
    if (!previous) return true;

    let sum = 0;
    for (let i = 0; i < current.length; i++) sum += Math.abs(current[i]! - previous[i]!);
    const meanDelta = sum / current.length;

    if (meanDelta >= MOTION_THRESHOLD) {
      this.coasting = COAST_FRAMES;
      return true;
    }
    if (this.coasting > 0) {
      this.coasting -= 1;
      return true;
    }
    return false;
  }
}
