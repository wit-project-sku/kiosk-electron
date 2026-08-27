/**
 * Side-by-side (stereo) camera support — the ZED 2i.
 *
 * ── What the ZED 2i actually is ────────────────────────────────────────
 * It is a plain UVC device. Windows and Chromium see it as ONE ordinary
 * `videoinput`; no ZED SDK, no CUDA, no NVIDIA GPU is needed to get video out
 * of it. What is not ordinary is the FRAME. Both sensors are delivered inside a
 * single uncompressed frame — left eye in the left half, right eye in the right
 * — so the camera's "1080p" mode is a 3840×1080 frame, not 1920×1080.
 *
 * Point a <video> straight at that stream and the visitor appears TWICE, side
 * by side. That is the "two streams" this module exists to fix: it is one
 * device and one frame with two pictures inside it, NOT two cameras, so no
 * amount of device picking makes it go away. The frame has to be cut in half.
 *
 * The cut follows the packing, which is not always horizontal: a camera turned
 * a quarter in its OWN settings — what the 제주 kiosks use to feed their portrait
 * screens an upright picture without the app rotating anything — delivers the
 * same pair stacked top and bottom instead. See {@link StereoLayout}.
 *
 * ── UVC video modes (side-by-side frame; per eye = width / 2) ──────────
 *   HD2K    4416×1242 @15            (2208×1242 per eye)
 *   HD1080  3840×1080 @30, 15        (1920×1080 per eye)
 *   HD720   2560×720  @60, 30, 15    (1280×720  per eye)
 *   VGA     1344×376  @100, 60, 30   (672×376   per eye)
 *
 * These are the ONLY sizes the device offers, which is the second half of the
 * bug: asking for `width: { ideal: 1920 }` (what the kiosk asked for when its
 * camera was an Elgato) leaves Chromium to pick a mode and rescale it, and what
 * it picks is a whole squashed side-by-side frame. So we ask for the sensor's
 * exact mode and do the halving ourselves.
 *
 * ── Why the split happens at the STREAM, not in CSS ────────────────────
 * The feed is consumed in four places — 제주's guide, the legacy camera screen,
 * `useKioskCamera.capture()` (the JPEG the AR API receives) and the MediaPipe
 * hand landmarker. Cropping in CSS would fix the two that are visible and leave
 * the photo doubled and the gesture detector looking at two of every hand.
 * Halving the stream once, here, means every consumer downstream receives an
 * ordinary mono camera and needs to know nothing about any of this.
 *
 * ── Depth ─────────────────────────────────────────────────────────────
 * Nothing here produces depth. Measuring a visitor's body off a ZED needs the
 * ZED SDK (CUDA, an NVIDIA GPU, a native process); the two raw eyes over UVC
 * are not it. When that work starts it belongs in a main-process sidecar, not
 * in this file.
 */

/** One UVC video mode, given as the full side-by-side frame it delivers. */
export interface StereoMode {
  /** Full side-by-side width. A single eye is half of this. */
  width: number;
  height: number;
  frameRate: number;
  name: string;
}

export const ZED_MODES = {
  HD2K: { width: 4416, height: 1242, frameRate: 15, name: 'HD2K' },
  HD1080: { width: 3840, height: 1080, frameRate: 30, name: 'HD1080' },
  HD720: { width: 2560, height: 720, frameRate: 30, name: 'HD720' },
  VGA: { width: 1344, height: 376, frameRate: 30, name: 'VGA' },
} as const satisfies Record<string, StereoMode>;

/**
 * Photo capture, best first. HD1080 is the match the rest of the pipeline was
 * built around — 1920×1080 per eye is exactly what the Elgato used to hand over
 * — so nothing downstream changes size. HD720 is the fallback for a camera on a
 * USB link that will not sustain 3840×1080, and HD2K last: it is 15 fps, which
 * makes the live preview visibly stuttery, so it is a last resort, not a treat.
 */
export const PHOTO_STEREO_MODES: StereoMode[] = [ZED_MODES.HD1080, ZED_MODES.HD720, ZED_MODES.HD2K];

/**
 * Footfall counting, best first. The detector resizes to 320 px internally, so
 * VGA (672×376 per eye) loses it nothing and costs the least — which matters,
 * because this stream runs all day behind the attract video.
 */
export const FOOTFALL_STEREO_MODES: StereoMode[] = [ZED_MODES.VGA, ZED_MODES.HD720];

/**
 * Device labels that name a stereo camera. A HINT ONLY — it reorders the
 * candidate modes below and is never allowed to rule a camera out. The first
 * version of this file used the label as a veto and a machine that reported the
 * device by some other spelling fell straight through to the doubled preview.
 *
 * `\bzed` and not `\bzed\b`: the word boundary after the "d" fails against
 * "ZED2i", which is exactly the kind of variation drivers produce. The leading
 * boundary stays, so "optimiZED USB Camera" does not match.
 */
const STEREO_LABEL = /\bzed[\s_-]?\d*|stereolabs/i;

/**
 * Aspect ratio above which two pictures are assumed rather than one. Every ZED
 * mode is ≈3.55:1 (16:9 doubled) or 3.57:1 (VGA doubled); the widest ordinary
 * webcam frame is a 2.35:1 cinema crop, so 3:1 separates them cleanly.
 */
const STEREO_ASPECT_MIN = 3;

/**
 * How the two eyes are packed into the delivered frame.
 *
 * `side-by-side` is what the sensor produces natively. `stacked` is the SAME
 * frame after a quarter turn: rotating 3840×1080 gives 1080×3840, and the left
 * and right halves become top and bottom ones. That turn can be applied in the
 * camera's own settings, which the 제주 kiosks use so their portrait screens get
 * an upright picture without the app rotating anything — so the splitter has to
 * recognise both packings or a rotated camera shows two visitors stacked.
 */
export type StereoLayout = 'side-by-side' | 'stacked';

/**
 * The packing of a frame this shape, or null when it holds a single picture.
 * Symmetric by design: a quarter turn in either direction is still stereo, just
 * along the other axis.
 */
export function stereoLayoutOf(width: number, height: number): StereoLayout | null {
  if (width <= 0 || height <= 0) return null;
  if (width / height >= STEREO_ASPECT_MIN) return 'side-by-side';
  if (height / width >= STEREO_ASPECT_MIN) return 'stacked';
  return null;
}

/** True when a device label names a known stereo camera. */
export function isStereoLabel(label: string | undefined | null): boolean {
  return !!label && STEREO_LABEL.test(label);
}

/**
 * True when the DEVICE — not the frame it happens to be delivering — is a
 * stereo camera, judged from the widest mode it advertises.
 *
 * This is the check that survives what broke the first version. Chromium is
 * free to satisfy `width: { ideal: 1920 }` by rescaling a whole 3840×1080
 * side-by-side frame down to 16:9, and that rescaled frame is indistinguishable
 * from an ordinary one by aspect ratio — the two visitors are still both in it,
 * just squashed. Capabilities describe the hardware and are not rewritten by
 * that negotiation, so a ZED still reports a ≈3.55:1 widest mode no matter what
 * the browser chose to hand over.
 */
export function deviceLooksStereo(capabilities: MediaTrackCapabilities | null): boolean {
  const maxWidth = capabilities?.width?.max ?? 0;
  const maxHeight = capabilities?.height?.max ?? 0;
  return stereoLayoutOf(maxWidth, maxHeight) !== null;
}

export interface OpenMonoCameraOptions {
  /** Device to open, or null to let the browser choose. */
  deviceId: string | null;
  /** Side-by-side modes to try before the fallback, best first. */
  stereoModes: StereoMode[];
  /** What to ask an ordinary (non-stereo) camera for. */
  fallback: MediaTrackConstraints;
  /**
   * Which SENSOR to keep — the physical eye, not a half of the frame. Left is
   * the ZED's reference eye: its calibration origin, and the one every ZED
   * sample treats as "the" image, so depth work later lines up with the photo
   * that was actually taken.
   */
  eye?: 'left' | 'right';
  /**
   * Which way the camera was turned in its OWN settings, for a frame that
   * arrives `stacked`. It decides which half holds which sensor and cannot be
   * read off the picture — the two eyes sit 12 cm apart and look identical.
   *
   * Turning the image left (counter-clockwise) swings the right edge to the
   * top, so the RIGHT eye ends up on top and the left eye at the bottom;
   * turning it right does the opposite. Defaults to `left`, which is what the
   * 제주 cameras are set to. Ignored for a `side-by-side` frame.
   */
  cameraTurn?: 'left' | 'right';
}

export interface MonoCamera {
  /** An ordinary single-picture stream, whatever the camera delivered. */
  stream: MediaStream;
  /** A side-by-side frame was detected and halved. */
  stereo: boolean;
  /** Frame size of `stream` — per eye when `stereo`. */
  width: number;
  height: number;
  /** Releases the device AND the splitting machinery. Always call it. */
  stop: () => void;
}

/**
 * Opens a camera and guarantees a single-picture stream out of it.
 *
 * A stereo camera is opened at one of its exact sensor modes and split; an
 * ordinary camera takes `fallback` and is passed straight through, byte for
 * byte the stream the caller would have opened itself. Callers therefore never
 * branch on which kind of camera is plugged in.
 */
export async function openMonoCamera(options: OpenMonoCameraOptions): Promise<MonoCamera> {
  const { deviceId, stereoModes, fallback, eye = 'left', cameraTurn = 'left' } = options;

  const label = await labelOf(deviceId);
  const stream = await openBestStream(deviceId, isStereoLabel(label) ? stereoModes : [], fallback);
  const track = stream.getVideoTracks()[0];

  let width = track?.getSettings().width ?? 0;
  let height = track?.getSettings().height ?? 0;
  const capabilities = track?.getCapabilities?.() ?? null;

  // Second chance. The open above may have produced an ordinary-looking frame
  // from a stereo camera — because the label gave no hint and the fallback was
  // used, or because every exact mode was refused (a ZED on a USB 2.0 port
  // advertises a much shorter format list). The device's own capabilities give
  // it away, and the track can be retuned in place.
  //
  // The label is worth a retry of its own where capabilities came back empty,
  // which some capture backends do: between "a device that says it is a ZED"
  // and "no evidence either way", the retune is a few milliseconds and the
  // alternative is a visitor looking at two of themselves.
  const suspect = deviceLooksStereo(capabilities) || (!capabilities?.width?.max && isStereoLabel(label));
  if (track && stereoLayoutOf(width, height) === null && suspect) {
    const upgraded = await retuneToStereoMode(track, stereoModes, capabilities);
    if (upgraded) {
      width = track.getSettings().width ?? width;
      height = track.getSettings().height ?? height;
    }
  }

  const layout = stereoLayoutOf(width, height);
  const stereo = layout !== null;

  // One line per camera open, so the next machine that misbehaves reports what
  // it did instead of leaving us to infer it from the picture on the glass.
  // Everything is interpolated INTO the string rather than passed as a second
  // argument: WindowManager copies these lines into the main log through
  // Electron's console-message event, which hands over one flattened string and
  // would render an object as "[object Object]" — losing the whole point.
  const widest = capabilities?.width?.max
    ? `${capabilities.width.max}×${capabilities.height?.max ?? '?'}`
    : '(unknown)';
  const summary = `label="${label || '(none)'}" frame=${width}×${height} widest=${widest} layout=${layout ?? 'mono'}`;
  if (!stereo && suspect) {
    // The one combination that means a visitor is about to see themselves
    // twice: the hardware looks stereo, the frame is not, and retuning failed.
    console.warn(`[camera] stereo device but no side-by-side frame — feed may be doubled: ${summary}`);
  } else {
    console.info(`[camera] opened ${summary}`);
  }

  if (!layout) {
    return {
      stream,
      stereo: false,
      width,
      height,
      stop: () => stream.getTracks().forEach((t) => t.stop()),
    };
  }

  // One eye is half the frame along whichever axis the pair is packed on.
  const eyeWidth = layout === 'side-by-side' ? Math.floor(width / 2) : width;
  const eyeHeight = layout === 'side-by-side' ? height : Math.floor(height / 2);

  // Which half carries the requested sensor. Natively the left eye is the first
  // half; a quarter turn to the LEFT swings the right edge to the top, putting
  // the right eye first and the left eye second. A turn to the right keeps the
  // left eye first. Everything else follows from that one fact.
  const firstHalfIsLeftEye = layout === 'side-by-side' || cameraTurn === 'right';
  const takeSecondHalf = (eye === 'left') !== firstHalfIsLeftEye;

  const split = splitStereoStream(stream, layout, takeSecondHalf, eyeWidth, eyeHeight);
  return {
    stream: split.stream,
    stereo: true,
    width: eyeWidth,
    height: eyeHeight,
    stop: split.stop,
  };
}

/**
 * Retunes an already-open track to the best side-by-side mode it can take.
 *
 * `applyConstraints`, not a close-and-reopen: on Windows the second open of a
 * device that was just released is the one that fails — a hazard the footfall
 * counter is already written around — and there is no reason to take it when
 * the source can simply be reconfigured underneath the same track.
 *
 * Modes are tried in the caller's preference order and skipped when the device
 * says it cannot reach them, so a photo open still lands on HD1080 and a
 * footfall open on VGA.
 */
async function retuneToStereoMode(
  track: MediaStreamTrack,
  stereoModes: StereoMode[],
  capabilities: MediaTrackCapabilities | null,
): Promise<boolean> {
  const maxWidth = capabilities?.width?.max ?? Infinity;
  const maxHeight = capabilities?.height?.max ?? Infinity;

  // Both orientations of every mode: a camera rotated in its own settings
  // reports its modes turned on their side (3840×1080 becomes 1080×3840), and
  // asking for the unrotated size on such a device matches nothing.
  const sizes = stereoModes.flatMap((mode) => [
    { width: mode.width, height: mode.height, frameRate: mode.frameRate },
    { width: mode.height, height: mode.width, frameRate: mode.frameRate },
  ]);

  for (const size of sizes) {
    if (size.width > maxWidth || size.height > maxHeight) continue;
    try {
      await track.applyConstraints({
        width: { exact: size.width },
        height: { exact: size.height },
        frameRate: { ideal: size.frameRate },
      });
      const now = track.getSettings();
      if (stereoLayoutOf(now.width ?? 0, now.height ?? 0) !== null) return true;
    } catch {
      // This mode is not reachable on this machine; try the next one.
    }
  }
  return false;
}

/**
 * Tries each stereo mode as an EXACT size, then the caller's fallback.
 *
 * Exact is deliberate. `ideal` is what produced the doubled preview in the
 * first place: it always "succeeds", by handing back whichever mode the browser
 * liked, rescaled. Exact either gets the sensor mode or throws, and a mode the
 * camera does not have throws off the enumerated format list — there is no
 * device open to pay for — so the walk down this list is cheap.
 *
 * `stereoModes` is empty when the label gave no reason to expect a stereo
 * camera; that is a shortcut, NOT a verdict. A stereo camera that lands on the
 * fallback here is caught afterwards from its capabilities and retuned.
 */
async function openBestStream(
  deviceId: string | null,
  stereoModes: StereoMode[],
  fallback: MediaTrackConstraints,
): Promise<MediaStream> {
  // Each mode in both orientations, upright first: a camera turned in its own
  // settings (제주) advertises its modes on their side, so asking only for
  // 3840×1080 would miss a device that offers 1080×3840 and nothing else.
  // Interleaved rather than appended so an unturned camera still matches on the
  // very first candidate and pays nothing for the extra entries.
  const candidates: MediaTrackConstraints[] = stereoModes.flatMap((mode) => [
    { width: { exact: mode.width }, height: { exact: mode.height }, frameRate: { ideal: mode.frameRate } },
    { width: { exact: mode.height }, height: { exact: mode.width }, frameRate: { ideal: mode.frameRate } },
  ]);
  candidates.push(fallback);

  let lastError: unknown;
  for (const video of candidates) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { ...video, deviceId: { exact: deviceId } } : video,
        audio: false,
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('No camera stream could be opened');
}

/**
 * The label for `deviceId`, or '' when there is none to be had — no device
 * chosen, no permission granted in this window yet, or enumeration refused.
 * '' is not "ordinary camera": it only means the label shortcut is unavailable
 * and the capability check has to earn the answer.
 */
async function labelOf(deviceId: string | null): Promise<string> {
  if (!deviceId) return '';
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.find((d) => d.kind === 'videoinput' && d.deviceId === deviceId)?.label ?? '';
  } catch {
    return '';
  }
}

interface SplitStream {
  stream: MediaStream;
  stop: () => void;
}

/**
 * Halves a side-by-side stream into a real MediaStream carrying one eye.
 *
 * The raw stream drives a hidden <video>, each of whose frames is drawn — one
 * `drawImage` with a source rectangle, so the GPU does the crop — into a canvas
 * half its width, and that canvas is captured back out as the stream returned.
 *
 * `captureStream(0)` plus an explicit `requestFrame()` per draw, rather than a
 * fixed capture rate, so the output is paced by the sensor: no frame is
 * duplicated and none is dropped, and a 15 fps HD2K feed is not published as a
 * 30 fps stream half of whose frames are stale.
 */
function splitStereoStream(
  source: MediaStream,
  layout: StereoLayout,
  takeSecondHalf: boolean,
  eyeWidth: number,
  eyeHeight: number,
): SplitStream {
  const video = document.createElement('video');
  video.srcObject = source;
  video.muted = true;
  video.playsInline = true;
  // In the document, not display:none. Chromium throttles — and can stop
  // delivering frame callbacks to — a video it believes nobody is looking at,
  // which would freeze the split feed while the raw one ran on. 1×1 and
  // transparent is the cheapest way to stay "visible".
  video.style.cssText =
    'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(video);
  // Autoplay of a muted MediaStream is always allowed; a rejection here means
  // the track died on open, and the pump below simply never draws.
  void video.play().catch(() => undefined);

  const canvas = document.createElement('canvas');
  // Sized from the track's own settings BEFORE capture, not left at the 300×150
  // a fresh canvas starts at: the capture track takes its resolution from the
  // canvas, and consumers that latch on to the first frame (the landmarker, and
  // `capture()` reading videoWidth) would otherwise see the placeholder size.
  canvas.width = eyeWidth;
  canvas.height = eyeHeight;
  const ctx = canvas.getContext('2d', { alpha: false });
  const out = canvas.captureStream(0);
  const outTrack = out.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;

  // Paced off the decoded frames themselves where the browser offers it, so the
  // canvas is redrawn once per sensor frame instead of once per compositor tick
  // — no wasted redraws on a 15 fps HD2K feed, no missed ones at 60.
  const useFrameCallback = typeof video.requestVideoFrameCallback === 'function';

  let stopped = false;
  let handle = 0;

  const draw = (): void => {
    if (stopped) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    // Re-read every frame rather than latching at metadata time: a UVC device
    // can renegotiate its mode mid-stream, and a stale canvas size would show
    // up as a smeared or re-doubled picture rather than as an error.
    if (ctx && w > 0 && h > 0) {
      // The pair is packed along one axis; halve that one and keep the other.
      const sbs = layout === 'side-by-side';
      const cw = sbs ? Math.floor(w / 2) : w;
      const ch = sbs ? h : Math.floor(h / 2);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      // Which half was worked out by the caller from the sensor asked for and
      // the way the camera is turned; here it is only left/right or top/bottom.
      const sx = sbs && takeSecondHalf ? w - cw : 0;
      const sy = !sbs && takeSecondHalf ? h - ch : 0;
      ctx.drawImage(video, sx, sy, cw, ch, 0, 0, cw, ch);
      outTrack?.requestFrame();
    }
    schedule();
  };

  const schedule = (): void => {
    if (stopped) return;
    handle = useFrameCallback ? video.requestVideoFrameCallback(draw) : requestAnimationFrame(draw);
  };

  schedule();

  return {
    stream: out,
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (handle) {
        if (useFrameCallback) video.cancelVideoFrameCallback(handle);
        else cancelAnimationFrame(handle);
      }
      out.getTracks().forEach((t) => t.stop());
      // Releasing the device is the point of stop(): the photo pipeline and the
      // footfall counter share this camera, and on Windows the second open of a
      // still-held device is the one that fails.
      source.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      video.remove();
    },
  };
}
