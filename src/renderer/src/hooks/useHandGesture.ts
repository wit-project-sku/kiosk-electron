/**
 * Watches the live camera feed for the two poses 제주's capture screen reacts to
 * — an open palm and a closed fist — and reports whichever is currently being
 * held. See `lib/handGesture.ts` for the classification itself.
 *
 * ── Where the model comes from ─────────────────────────────────────────
 * Nothing is fetched from a CDN: the kiosk is offline-first, and 제주's machine
 * sits behind an airport network we do not control. `resources/mediapipe/` is
 * vendored into the installer (`npm run vendor:mediapipe`) and served over the
 * `appres://` scheme, which exists because a packaged renderer runs from
 * `file://` — where the WASM loader's <script> tag and its `.wasm` fetch are
 * both blocked by Chromium. See `main/core/appResourceProtocol.ts`.
 *
 * ── Failure is not an error here ───────────────────────────────────────
 * A kiosk that will not take a photo because a model would not load is worse
 * than one that ignores gestures. Every failure path lands on
 * `status: 'unavailable'`, and the caller is expected to fall back to starting
 * the countdown on a timer — never to block on this.
 */
import { useEffect, useState, type RefObject } from 'react';
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { classifyFrame, GestureStabilizer, type HandGesture } from '@renderer/lib/handGesture';

export type HandGestureStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

interface Options {
  /** The element carrying the camera stream — `useKioskCamera`'s videoRef. */
  video: RefObject<HTMLVideoElement | null>;
  /** Detection runs only while true; the model stays loaded either way. */
  enabled: boolean;
}

interface UseHandGestureResult {
  /** The pose currently being held, or null for neither. */
  gesture: HandGesture | null;
  status: HandGestureStatus;
}

/** Base path served by the appres:// protocol handler. */
const RUNTIME_BASE = 'appres://mediapipe';

/**
 * Inference rate. The countdown reacts in tenths of a second, so there is
 * nothing to gain from running at the camera's 30 fps — and plenty to lose: this
 * kiosk has no discrete GPU and shares the machine with a 4K attract video.
 */
const DETECT_INTERVAL_MS = 80;

/**
 * One landmarker for the whole renderer, kept alive across captures.
 *
 * Loading it means 9.5 MB of WASM plus a 7.5 MB model — about a second on this
 * hardware. A visitor who retakes a photo must not pay that again, and neither
 * must the second visitor of the day, so it is created once and never closed.
 * The promise (not the instance) is cached so concurrent callers share one load
 * rather than racing two.
 */
let landmarkerPromise: Promise<HandLandmarker> | null = null;

function loadLandmarker(): Promise<HandLandmarker> {
  landmarkerPromise ??= (async () => {
    // Dynamic import: ~140 KB of glue that only 제주 ever needs, kept out of the
    // display window's initial chunk so every other location's boot is untouched.
    const { FilesetResolver, HandLandmarker: Landmarker } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(RUNTIME_BASE);
    return Landmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: `${RUNTIME_BASE}/hand_landmarker.task`,
        // GPU keeps a frame under ~8 ms here; CPU is 4-5× that and competes with
        // the attract video's decode for the same cores.
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      // Two hands: 함께 촬영 puts a second person in frame, and either of them
      // raising a palm should start the count.
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  })().catch((error) => {
    // Clear the cache so a later capture retries rather than inheriting a
    // rejected promise for the rest of the session.
    landmarkerPromise = null;
    throw error;
  });
  return landmarkerPromise;
}

export function useHandGesture({ video, enabled }: Options): UseHandGestureResult {
  const [gesture, setGesture] = useState<HandGesture | null>(null);
  const [status, setStatus] = useState<HandGestureStatus>('idle');

  useEffect(() => {
    if (!enabled) {
      setGesture(null);
      setStatus('idle');
      return;
    }

    let cancelled = false;
    let frameHandle: number | null = null;
    let landmarker: HandLandmarker | null = null;
    const stabilizer = new GestureStabilizer();
    let lastDetectAt = 0;
    /**
     * MediaPipe's VIDEO mode rejects a timestamp that is not strictly greater
     * than the previous one. `video.currentTime` repeats while a frame is held,
     * so the loop tracks its own monotonic clock instead.
     */
    let lastTimestamp = 0;

    const pump = (): void => {
      if (cancelled) return;
      frameHandle = requestAnimationFrame(pump);

      const element = video.current;
      if (!landmarker || !element || element.readyState < 2) return;

      const now = performance.now();
      if (now - lastDetectAt < DETECT_INTERVAL_MS) return;
      lastDetectAt = now;

      const timestamp = Math.max(Math.round(now), lastTimestamp + 1);
      lastTimestamp = timestamp;

      try {
        const result = landmarker.detectForVideo(element, timestamp);
        setGesture(stabilizer.push(classifyFrame(result.landmarks ?? [])));
      } catch (error) {
        // A single bad frame (the stream restarting, a resize mid-detect) must
        // not kill the loop — the next frame usually succeeds.
        console.warn('[gesture] frame detection failed', error);
      }
    };

    setStatus('loading');
    void loadLandmarker()
      .then((instance) => {
        if (cancelled) return;
        landmarker = instance;
        setStatus('ready');
        pump();
      })
      .catch((error) => {
        if (cancelled) return;
        // Expected on a machine where the vendor step never ran, or where the
        // GPU delegate is unavailable. The camera screen falls back to a timer.
        console.warn('[gesture] hand landmarker unavailable — countdown falls back to a timer', error);
        setStatus('unavailable');
      });

    return () => {
      cancelled = true;
      if (frameHandle !== null) cancelAnimationFrame(frameHandle);
      // The landmarker itself is intentionally NOT closed — see the singleton.
      stabilizer.reset();
    };
  }, [enabled, video]);

  return { gesture, status };
}
