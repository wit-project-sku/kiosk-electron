/**
 * One upright, scaled copy of the camera frame, shared by every model that
 * looks at it.
 *
 * ══ WHY THE FRAME IS PREPARED ONCE, HERE ══════════════════════════════
 * The motion games run TWO models over the same frame — hands for the
 * controller, pose for the body fallback and the orientation probe. Both need
 * the frame turned upright and scaled down, and both used to be able to do that
 * for themselves, which would mean two rotate-and-scale passes over a 1080×1920
 * frame twenty times a second to produce two identical canvases.
 *
 * So the turn happens once, here, and the trackers are handed the result.
 *
 * ── Why the model must not be shown the raw <video> ───────────────────
 * A pose model is trained on people who are the right way up. Feed it a frame
 * from a camera mounted at 90° and it sees a person lying down, and either
 * finds nobody or returns nonsense. (The hand model is far more rotation
 * tolerant, which is why the 손동작 게이트 never needed this and why the trap is
 * easy to miss — but a hand tracked in a sideways frame still moves along the
 * wrong axis, so the turn matters for both.)
 *
 * Doing the turn before inference also means the landmarks come back ALREADY
 * upright, so the geometry downstream only has to mirror.
 *
 * ── Nothing here is retained ──────────────────────────────────────────
 * One canvas, overwritten every frame, dropped on {@link dispose}. No frame is
 * copied, encoded, stored or sent anywhere.
 */

/**
 * Longest edge of the frame actually handed to the models.
 *
 * The 제주 Elgato runs PORTRAIT at 1080×1920 and we open it at its native mode
 * (see the note in useMotionTracking), which is more pixels than either model
 * needs. Scaling to this keeps the per-frame cost flat whatever camera a venue
 * has, and costs one drawImage.
 *
 * ── Why not smaller ───────────────────────────────────────────────────
 * Both models letterbox their input into a SQUARE. A 9:16 portrait frame
 * therefore lands in a narrow column down the middle of that square — at a 480
 * long edge the whole frame is only ~144px wide inside it, and a raised hand is
 * a fraction of that. 720 keeps the column wide enough for a hand to survive
 * the letterbox, and the extra cost is one larger drawImage at 20fps, not extra
 * inference.
 */
const WORK_LONG_EDGE = 720;

export type CanvasRotation = 0 | 90 | 180 | 270;

export class FrameSource {
  /** Size of the last frame drawn, AFTER rotation. Zero until the first draw. */
  width = 0;
  height = 0;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  /**
   * Draw the video's current frame upright and scaled.
   *
   * Returns null when there is no decodable frame yet — `readyState < 2` means
   * nothing has been decoded, and handing that to MediaPipe throws rather than
   * returning nothing.
   *
   * @param rotation Degrees the RAW frame must be turned clockwise to stand
   *   upright — the venue's `cameraRotation`, or whatever the orientation probe
   *   has settled on.
   */
  draw(video: HTMLVideoElement, rotation: CanvasRotation): HTMLCanvasElement | null {
    if (video.readyState < 2) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    // After a quarter turn the frame's axes swap.
    const quarter = rotation === 90 || rotation === 270;
    const uprightW = quarter ? vh : vw;
    const uprightH = quarter ? vw : vh;
    const scale = Math.min(1, WORK_LONG_EDGE / Math.max(uprightW, uprightH));
    const w = Math.max(1, Math.round(uprightW * scale));
    const h = Math.max(1, Math.round(uprightH * scale));

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      // `willReadFrequently: false` — MediaPipe uploads this to the GPU; we
      // never read it back, and asking for a readback-optimised surface would
      // force a software canvas.
      this.ctx = this.canvas.getContext('2d');
    }
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!ctx) return null;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    this.width = w;
    this.height = h;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    // Drawn about the centre in the SOURCE's own aspect, so a quarter turn
    // fills the swapped canvas exactly rather than letterboxing.
    const drawW = quarter ? h : w;
    const drawH = quarter ? w : h;
    ctx.drawImage(video, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    return canvas;
  }

  /**
   * Drop the working canvas.
   *
   * The models are shared and deliberately outlive a game; this buffer is
   * per-session and should not. Called when the tracking hook tears down.
   */
  dispose(): void {
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
  }
}

/**
 * The frame clock every MediaPipe VIDEO-mode call in this folder shares.
 *
 * ══ THIS IS THE BUG THAT KILLED EVERY GAME AFTER THE FIRST ════════════
 * MediaPipe's VIDEO mode rejects a timestamp that is not strictly greater than
 * the last one IT was given — and "it" is the landmarker, which is a
 * module-level singleton deliberately kept alive between games (loading is
 * ~15 MB and a second). The tracker objects around it are not: a new run builds
 * a new one.
 *
 * So a per-tracker counter starting at zero meant run 1 fed the landmarker
 * timestamps 1…1200 and run 2 fed the SAME landmarker a 1. Every `detect` call
 * of every later run threw, the frame loop's catch swallowed it, and the games
 * spent the rest of the window's life with a live camera, a live preview, and
 * nobody ever detected. That is the "play once and the camera games stop
 * working" report, and it survived a reboot only because reloading the window
 * is what drops the singleton.
 *
 * A clock that belongs to the MODELS rather than to a tracker cannot drift out
 * of step with them. Anchored to `performance.now()` for the same reason
 * PersonDetector and useHandGesture are: it is monotonic across the whole
 * window, so even a tracker built from scratch resumes above the last value.
 */
let lastStamp = 0;

/** The next timestamp to hand MediaPipe. Strictly greater than the last one. */
export function nextFrameStamp(): number {
  const stamp = Math.max(Math.round(performance.now()), lastStamp + 1);
  lastStamp = stamp;
  return stamp;
}
