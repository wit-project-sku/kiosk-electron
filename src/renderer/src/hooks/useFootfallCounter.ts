import { useEffect, useRef, useState, type RefObject } from 'react';
import type { FootfallCrossing, FootfallRuntime, FootfallTuning } from '@shared/types/footfall';
import { FOOTFALL_REPORT_INTERVAL_MS } from '@shared/config/footfall';
import { isOk } from '@shared/types/result';
import { LineCrossingCounter } from '@renderer/lib/footfall/LineCrossingCounter';
import { MotionGate } from '@renderer/lib/footfall/MotionGate';
import { ObjectTracker } from '@renderer/lib/footfall/ObjectTracker';
import { PersonDetector } from '@renderer/lib/footfall/PersonDetector';
import { FOOTFALL_STEREO_MODES, openMonoCamera, type MonoCamera } from '@renderer/lib/stereoCamera';

/**
 * 유동인구 — the seeing half.
 *
 * Runs the whole vision pipeline for the touch-screen window: open the camera,
 * detect people, track them, count the ones that cross the line, hand the
 * integers to main. It draws nothing, shows nothing, and stores nothing; a
 * visitor has no way to tell it is running, which is the point — a counter that
 * announces itself changes the behaviour it is measuring.
 *
 * ── It is a guest on this machine ──────────────────────────────────────
 * Three separate brakes keep it out of the way of the things visitors actually
 * see. It yields the camera entirely whenever main says something else needs it
 * (`runtime.active`). It runs the detector a few times a second, not at frame
 * rate. And it skips the detector completely while nothing in front of the
 * camera is moving. On an empty corridor at night the loop costs a canvas
 * thumbnail and a subtraction.
 *
 * ── Failure is quiet ───────────────────────────────────────────────────
 * No camera, no model, no GPU, an unplugged USB cable: every one of these ends
 * with counting off and the kiosk otherwise untouched. Nothing here is allowed
 * to throw into the UI, and nothing here is on the path of anything a visitor is
 * waiting for.
 */

interface Options {
  /** Hidden element the camera stream is attached to. */
  video: RefObject<HTMLVideoElement | null>;
}

export type FootfallStatus = 'off' | 'loading' | 'counting' | 'suspended' | 'unavailable';

/**
 * Camera retry backoff. An unplugged camera must not turn into a
 * getUserMedia call every second for the rest of the week.
 */
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

/**
 * Detector budget. If a pass costs more than this the machine is busy with
 * something that matters more (an AI generation, a 4K decode), so the loop
 * halves its own rate rather than competing.
 */
const SLOW_FRAME_MS = 60;
const MIN_FPS = 1;
/**
 * ...and the way back up. Without this, one busy stretch (an AI generation, a
 * content sync) would leave the counter at 1 fps for the rest of the day, and
 * the hours after it would quietly under-count.
 */
const FAST_FRAME_MS = 25;

export function useFootfallCounter({ video }: Options): FootfallStatus {
  const [status, setStatus] = useState<FootfallStatus>('off');
  const [runtime, setRuntime] = useState<FootfallRuntime | null>(null);

  // Buffered crossings live in a ref, not state: they are produced by a timer
  // loop several times a second and must never cause a React render.
  const bufferRef = useRef<FootfallCrossing[]>([]);
  const activeMsRef = useRef(0);

  // ── What main wants us to do ─────────────────────────────────────────
  useEffect(() => {
    void window.api.footfall.getRuntime().then((result) => {
      if (isOk(result)) setRuntime(result.value);
    });
    return window.api.events.onFootfallRuntimeChanged(setRuntime);
  }, []);

  // ── The loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!runtime || !runtime.enabled) {
      setStatus('off');
      return;
    }
    if (!runtime.active) {
      setStatus('suspended');
      return;
    }

    let cancelled = false;
    // Captured now rather than read in the cleanup: by the time cleanup runs the
    // ref may already point at a different element (or at null), and clearing
    // the wrong element's srcObject would leave this stream attached to nothing
    // that can release it.
    const videoElement = video.current;
    let camera: MonoCamera | null = null;
    let loopTimer: ReturnType<typeof setTimeout> | null = null;
    let reportTimer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryIndex = 0;

    const detector = new PersonDetector();
    const tracker = new ObjectTracker();
    const counter = new LineCrossingCounter();
    const motion = new MotionGate();

    let warmupLeft = runtime.tuning.warmupFrames;
    let fps = runtime.tuning.targetFps;
    let lastTickAt = 0;

    const flushReport = (): void => {
      const crossings = bufferRef.current;
      const activeMs = activeMsRef.current;
      if (crossings.length === 0 && activeMs === 0) return;
      bufferRef.current = [];
      activeMsRef.current = 0;
      // Fire and forget. A failed report is a handful of counts, and blocking
      // the loop on IPC would be a far worse trade than losing them.
      void window.api.footfall.report({ crossings, activeMs });
    };

    const tick = (): void => {
      if (cancelled) return;

      const started = performance.now();
      if (lastTickAt > 0) activeMsRef.current += started - lastTickAt;
      lastTickAt = started;

      try {
        processFrame(videoElement, {
          detector,
          tracker,
          counter,
          motion,
          runtime,
          skipWarmup: () => {
            if (warmupLeft <= 0) return false;
            warmupLeft -= 1;
            return true;
          },
          onCrossing: (direction) => {
            bufferRef.current.push({ direction, at: new Date().toISOString() });
          },
        });
      } catch {
        // A single bad frame (a stream that died between the readyState check
        // and the detect call) must not kill the loop.
      }

      const elapsed = performance.now() - started;
      if (elapsed > SLOW_FRAME_MS && fps > MIN_FPS) {
        fps = Math.max(MIN_FPS, fps / 2);
      } else if (elapsed < FAST_FRAME_MS && fps < runtime.tuning.targetFps) {
        // Climb back gently rather than in one jump, so a machine hovering at
        // the threshold does not oscillate between full rate and half rate.
        fps = Math.min(runtime.tuning.targetFps, fps * 1.25);
      }

      loopTimer = setTimeout(tick, Math.max(0, 1000 / fps - elapsed));
    };

    const startCamera = async (): Promise<void> => {
      setStatus('loading');
      try {
        // 640×480 is all the detector can use (it resizes to 320 internally) and
        // it is what keeps this stream cheap to decode next to everything else
        // on screen. The photo pipeline's 1920×1080 is a different open of the
        // same device — which is exactly why we let go of it rather than share.
        //
        // openMonoCamera, not getUserMedia, for the ZED 2i: its frames carry
        // both sensors side by side, and a detector fed the raw frame sees two
        // half-width copies of every visitor — which is two of every line
        // crossing. The counting pipeline behind this call is unchanged; it
        // just receives one picture per frame. See lib/stereoCamera.ts.
        camera = await openMonoCamera({
          deviceId: runtime.deviceId,
          stereoModes: FOOTFALL_STEREO_MODES,
          fallback: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
        });
        if (cancelled) {
          camera.stop();
          camera = null;
          return;
        }

        if (!videoElement) throw new Error('No video element');
        videoElement.srcObject = camera.stream;
        await videoElement.play();

        await detector.load(runtime.tuning);
        if (cancelled) return;

        detector.resetClock();
        motion.reset();
        tracker.reset();
        counter.reset();

        void window.api.footfall.status({ available: true, deviceId: runtime.deviceId });
        retryIndex = 0;
        setStatus('counting');
        lastTickAt = 0;
        tick();
        reportTimer = setInterval(flushReport, FOOTFALL_REPORT_INTERVAL_MS);
      } catch {
        // The camera may well have opened and the MODEL have been what failed.
        // Letting that stream live would mean the next retry opens a second one
        // — and on Windows, the second open of a busy device is the one that
        // fails, so the retry would be guaranteed to fail too.
        camera?.stop();
        camera = null;
        if (videoElement) videoElement.srcObject = null;
        if (cancelled) return;
        setStatus('unavailable');
        void window.api.footfall.status({ available: false, deviceId: null });

        const delay = RETRY_DELAYS_MS[Math.min(retryIndex, RETRY_DELAYS_MS.length - 1)]!;
        retryIndex += 1;
        retryTimer = setTimeout(() => void startCamera(), delay);
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      if (loopTimer) clearTimeout(loopTimer);
      if (reportTimer) clearInterval(reportTimer);
      if (retryTimer) clearTimeout(retryTimer);
      flushReport();
      // Releasing the device is the whole contract with the photo pipeline —
      // stop() is what actually hands the camera back (for a stereo camera it
      // also tears down the frame pump doing the split), and it has to happen
      // here, synchronously, not on some later frame.
      camera?.stop();
      camera = null;
      if (videoElement) videoElement.srcObject = null;
    };
  }, [runtime, video]);

  // Last chance to keep the final few crossings when the window goes away.
  useEffect(() => {
    const handler = (): void => {
      if (bufferRef.current.length === 0 && activeMsRef.current === 0) return;
      void window.api.footfall.report({
        crossings: bufferRef.current,
        activeMs: activeMsRef.current,
      });
      bufferRef.current = [];
      activeMsRef.current = 0;
    };
    window.addEventListener('pagehide', handler);
    return () => window.removeEventListener('pagehide', handler);
  }, []);

  return status;
}

interface FrameContext {
  detector: PersonDetector;
  tracker: ObjectTracker;
  counter: LineCrossingCounter;
  motion: MotionGate;
  runtime: FootfallRuntime;
  skipWarmup: () => boolean;
  onCrossing: (direction: FootfallCrossing['direction']) => void;
}

/** One pass of the pipeline. Extracted so the loop above stays readable. */
function processFrame(video: HTMLVideoElement | null, context: FrameContext): void {
  const { detector, tracker, counter, motion, runtime, skipWarmup, onCrossing } = context;
  if (!video || video.readyState < 2 || video.videoWidth === 0) return;
  if (!detector.isLoaded()) return;

  // Exposure is still settling; the detector hallucinates on the noise.
  if (skipWarmup()) return;

  // Nothing moved — the previous answer is still the right answer.
  if (!motion.shouldDetect(video)) return;

  const tuning: FootfallTuning = runtime.tuning;
  const detections = detector.detect(video, tuning);
  const tracks = tracker.update(detections, {
    matchThreshold: tuning.matchThreshold,
    trackScoreThreshold: tuning.trackScoreThreshold,
    maxAge: tuning.maxTrackAge,
  });

  const crossings = counter.check(
    tracks,
    runtime.line,
    video.videoWidth,
    video.videoHeight,
    tuning.minTrackHits,
  );
  for (const crossing of crossings) onCrossing(crossing.direction);
}
