import { useEffect, useRef, useState, type RefObject } from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * BlazeFace presence detection on the live camera feed.
 *
 * Runs the MediaPipe FaceDetector against the `<video>` element so we can tell
 * whether a person is actually standing in front of the camera. The capture
 * countdown is held while no face is present, so we never auto-capture an empty
 * frame and feed it to the AI.
 *
 * Model + wasm are bundled (src/renderer/public/mediapipe) and served:
 *   - dev: straight off the Vite dev server (http origin → fetch ok)
 *   - prod: via the privileged `media://app/…` scheme, because the file://
 *     production origin blocks fetch() of local files.
 */

// In production the renderer is loaded with `webSecurity: true` from a file://
// origin, which cannot fetch() sibling files. The `media://app/*` scheme streams
// them from the renderer bundle instead. In dev the http origin fetches directly.
const MP_BASE = import.meta.env.DEV
  ? `${window.location.origin}/mediapipe`
  : 'media://app/mediapipe';

/**
 * Tolerate brief detection dropouts (a turned head, motion blur, a blink of the
 * detector) before declaring the person gone — avoids flapping the countdown.
 */
const ABSENCE_GRACE_MS = 800;

interface UseFacePresenceOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
}

interface UseFacePresenceResult {
  /** True when a face is currently visible (or detection is unavailable). */
  present: boolean;
  /** True once the detector has loaded and is actively gating. */
  ready: boolean;
}

async function createDetector(): Promise<FaceDetector> {
  const fileset = await FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
  const modelAssetPath = `${MP_BASE}/blaze_face_short_range.tflite`;
  try {
    return await FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath, delegate: 'GPU' },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    });
  } catch {
    // Some kiosk GPUs/drivers reject the WebGL delegate — fall back to CPU.
    return FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath, delegate: 'CPU' },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    });
  }
}

export function useFacePresence({ videoRef, enabled }: UseFacePresenceOptions): UseFacePresenceResult {
  const [present, setPresent] = useState(false);
  const [ready, setReady] = useState(false);
  const detectorRef = useRef<FaceDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSeenRef = useRef(0);
  const lastTsRef = useRef(0);

  // Load the detector once for the lifetime of the display window.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const detector = await createDetector();
        if (cancelled) {
          detector.close();
          return;
        }
        detectorRef.current = detector;
        setReady(true);
        // eslint-disable-next-line no-console
        console.info('[face-presence] detector ready — camera presence gating active');
      } catch (error) {
        // Detection unavailable → fail OPEN: treat as present so the capture
        // flow keeps working exactly as before (never block on a broken model).
        // eslint-disable-next-line no-console
        console.error('[face-presence] detector init failed; gating disabled', error);
        setReady(false);
        setPresent(true);
      }
    })();
    return () => {
      cancelled = true;
      detectorRef.current?.close();
      detectorRef.current = null;
    };
  }, []);

  // Detection loop — only while the camera phase is active and the model loaded.
  useEffect(() => {
    if (!enabled || !ready) return;

    let stopped = false;
    // Seed the grace window so a slightly-late first detection doesn't instantly
    // read as "absent" the moment the camera turns on.
    lastSeenRef.current = performance.now();

    const loop = (): void => {
      if (stopped) return;
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (video && detector && video.readyState >= 2 && video.videoWidth > 0) {
        // detectForVideo requires strictly increasing timestamps.
        let ts = performance.now();
        if (ts <= lastTsRef.current) ts = lastTsRef.current + 1;
        lastTsRef.current = ts;
        try {
          const result = detector.detectForVideo(video, ts);
          const now = performance.now();
          if (result.detections.length > 0) {
            lastSeenRef.current = now;
            setPresent(true);
          } else if (now - lastSeenRef.current > ABSENCE_GRACE_MS) {
            setPresent(false);
          }
        } catch {
          // Transient inference error — ignore this frame.
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled, ready, videoRef]);

  return { present, ready };
}
