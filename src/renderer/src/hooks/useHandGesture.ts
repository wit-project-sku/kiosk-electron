import { useEffect, useRef, useState, type RefObject } from 'react';
import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * MediaPipe hand-gesture control for the 인스타 효과 (Instagram-effects) screen.
 *
 * Runs the GestureRecognizer against the live `<video>` so the user can drive the
 * whole experience by hand, standing back from the (large) kiosk:
 *   - Open-palm SWIPE left/right  → change the active filter
 *   - ✌️ Victory held ~0.5s        → capture the photo (no countdown)
 *
 * The 0.5s hold on Victory is a deliberate confirm so a passer-by's hand can't
 * fire a shot. Model + wasm are the same bundle the face-presence detector uses
 * (src/renderer/public/mediapipe), served via `media://app/*` in production.
 *
 * Fails OPEN: if the model can't load, `ready` stays false and the screen falls
 * back to its on-screen touch buttons — gestures never become a hard dependency.
 */

const MP_BASE = import.meta.env.DEV
  ? `${window.location.origin}/mediapipe`
  : 'media://app/mediapipe';

/** Victory must be held this long before the shot fires. */
const CAPTURE_HOLD_MS = 500;
/** Minimum recognizer confidence for a gesture to count. */
const MIN_SCORE = 0.55;
/** Horizontal hand travel (normalized 0–1) that counts as a swipe. */
const SWIPE_DISTANCE = 0.16;
/** Window over which swipe travel is measured. */
const SWIPE_WINDOW_MS = 280;
/** Ignore further swipes for this long after one fires (debounce). */
const SWIPE_COOLDOWN_MS = 650;
/**
 * Flip if swipe direction feels reversed on the kiosk. The Monitor 2 preview is
 * mirrored (selfie view), so increasing raw landmark-x maps to "previous" by
 * default; set to +1 if hardware testing shows it inverted.
 */
const SWIPE_SIGN = -1;

export type SwipeDirection = 'next' | 'prev';

interface UseHandGestureOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  onCapture: () => void;
  onSwipe: (dir: SwipeDirection) => void;
}

interface UseHandGestureResult {
  /** True once the recognizer has loaded and is running. */
  ready: boolean;
  /** True while a hand is currently visible. */
  handPresent: boolean;
  /** 0–1 progress of the Victory capture hold (drives the confirm ring). */
  captureProgress: number;
}

async function createRecognizer(): Promise<GestureRecognizer> {
  const fileset = await FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
  const modelAssetPath = `${MP_BASE}/gesture_recognizer.task`;
  try {
    return await GestureRecognizer.createFromOptions(fileset, {
      baseOptions: { modelAssetPath, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
    });
  } catch {
    // Some kiosk GPUs reject the WebGL delegate — fall back to CPU.
    return GestureRecognizer.createFromOptions(fileset, {
      baseOptions: { modelAssetPath, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numHands: 1,
    });
  }
}

export function useHandGesture({
  videoRef,
  enabled,
  onCapture,
  onSwipe,
}: UseHandGestureOptions): UseHandGestureResult {
  const [ready, setReady] = useState(false);
  const [handPresent, setHandPresent] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);

  // Keep callbacks in refs so the detection loop never re-subscribes on each
  // parent re-render (which would thrash the recognizer).
  const onCaptureRef = useRef(onCapture);
  const onSwipeRef = useRef(onSwipe);
  onCaptureRef.current = onCapture;
  onSwipeRef.current = onSwipe;

  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);

  // Capture-hold + swipe state (refs — mutated every frame, not render state).
  const captureStartRef = useRef<number | null>(null);
  const capturedRef = useRef(false);
  const swipeSamplesRef = useRef<Array<{ x: number; t: number }>>([]);
  const lastSwipeAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const recognizer = await createRecognizer();
        if (cancelled) {
          recognizer.close();
          return;
        }
        recognizerRef.current = recognizer;
        setReady(true);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[hand-gesture] recognizer init failed; gestures disabled', error);
        setReady(false);
      }
    })();
    return () => {
      cancelled = true;
      recognizerRef.current?.close();
      recognizerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !ready) return;

    let stopped = false;
    captureStartRef.current = null;
    capturedRef.current = false;
    swipeSamplesRef.current = [];

    const loop = (): void => {
      if (stopped) return;
      const video = videoRef.current;
      const recognizer = recognizerRef.current;
      if (video && recognizer && video.readyState >= 2 && video.videoWidth > 0) {
        let ts = performance.now();
        if (ts <= lastTsRef.current) ts = lastTsRef.current + 1;
        lastTsRef.current = ts;
        try {
          const result = recognizer.recognizeForVideo(video, ts);
          processResult(result, ts);
        } catch {
          // Transient inference error — ignore this frame.
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    const processResult = (
      result: ReturnType<GestureRecognizer['recognizeForVideo']>,
      now: number,
    ): void => {
      const hasHand = result.landmarks.length > 0;
      setHandPresent((prev) => (prev === hasHand ? prev : hasHand));

      const topGesture = result.gestures[0]?.[0];
      const name = topGesture?.categoryName ?? '';
      const score = topGesture?.score ?? 0;

      // ── Capture: Victory held for CAPTURE_HOLD_MS ──
      if (name === 'Victory' && score >= MIN_SCORE) {
        if (captureStartRef.current == null) captureStartRef.current = now;
        const held = now - captureStartRef.current;
        const progress = Math.min(1, held / CAPTURE_HOLD_MS);
        setCaptureProgress((prev) =>
          Math.round(prev * 20) === Math.round(progress * 20) ? prev : progress,
        );
        if (progress >= 1 && !capturedRef.current) {
          capturedRef.current = true;
          onCaptureRef.current();
        }
        // While confirming a shot, don't also read swipes.
        swipeSamplesRef.current = [];
        return;
      }

      // Not Victory → reset the capture hold (and re-arm for the next shot).
      if (captureStartRef.current != null) {
        captureStartRef.current = null;
        capturedRef.current = false;
        setCaptureProgress((prev) => (prev === 0 ? prev : 0));
      }

      // ── Swipe: horizontal travel of an open/visible hand ──
      if (!hasHand) {
        swipeSamplesRef.current = [];
        return;
      }
      const wrist = result.landmarks[0]?.[0];
      if (!wrist) return;
      const samples = swipeSamplesRef.current;
      samples.push({ x: wrist.x, t: now });
      // Drop samples older than the measurement window.
      while (samples.length > 0) {
        const first = samples[0];
        if (!first || now - first.t <= SWIPE_WINDOW_MS) break;
        samples.shift();
      }

      if (now - lastSwipeAtRef.current < SWIPE_COOLDOWN_MS) return;
      const oldest = samples[0];
      if (!oldest) return;
      const dx = wrist.x - oldest.x;
      if (Math.abs(dx) >= SWIPE_DISTANCE) {
        const dir: SwipeDirection = dx * SWIPE_SIGN > 0 ? 'next' : 'prev';
        lastSwipeAtRef.current = now;
        swipeSamplesRef.current = [];
        onSwipeRef.current(dir);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setCaptureProgress(0);
      setHandPresent(false);
    };
  }, [enabled, ready, videoRef]);

  return { ready, handPresent, captureProgress };
}
