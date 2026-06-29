import { useEffect, useRef, useState, type RefObject } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * Face-mesh tracking for the 인스타 효과 AR wearables. Reports, per frame, where
 * to anchor a hat / glasses on the (mirrored) Monitor 2 preview.
 *
 * Coordinates are returned already MIRROR-CORRECTED and normalized 0–1 to the
 * displayed video, so the overlay can be positioned directly over the selfie
 * preview. Runs only while a wearable is selected (`enabled`) to avoid paying for
 * a second MediaPipe model when it isn't needed. Model + wasm are the shared
 * bundle (src/renderer/public/mediapipe), served via `media://app/*` in prod.
 *
 * Fails OPEN: if the model can't load, `ready` stays false and the overlay simply
 * doesn't show — the rest of the effects screen keeps working.
 */

const MP_BASE = import.meta.env.DEV
  ? `${window.location.origin}/mediapipe`
  : 'media://app/mediapipe';

/** Throttle inference to ~22fps — plenty smooth for anchoring, lighter on the GPU. */
const MIN_INTERVAL_MS = 45;

/** Face-mesh landmark indices (canonical MediaPipe FaceMesh). */
const IDX = { foreheadTop: 10, eyeOuterL: 33, eyeOuterR: 263, templeL: 127, templeR: 356 };

export interface FaceMetrics {
  /** Forehead-top anchor (hats), normalized + mirror-corrected. */
  foreheadX: number;
  foreheadY: number;
  /** Eye-centre anchor (glasses). */
  eyeX: number;
  eyeY: number;
  /** Temple-to-temple distance (hat width basis). */
  faceW: number;
  /** Outer-eye distance (glasses width basis). */
  eyeDist: number;
  /** Head roll in degrees (display space; ~0 when level). */
  roll: number;
}

interface UseFaceTrackingOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  onFace: (metrics: FaceMetrics | null) => void;
}

async function createLandmarker(): Promise<FaceLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
  const modelAssetPath = `${MP_BASE}/face_landmarker.task`;
  try {
    return await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
    });
  } catch {
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
    });
  }
}

export function useFaceTracking({ videoRef, enabled, onFace }: UseFaceTrackingOptions): { ready: boolean } {
  const [ready, setReady] = useState(false);
  const onFaceRef = useRef(onFace);
  onFaceRef.current = onFace;

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const lastProcessRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const landmarker = await createLandmarker();
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setReady(true);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[face-tracking] landmarker init failed; AR overlay disabled', error);
        setReady(false);
      }
    })();
    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !ready) return;
    let stopped = false;

    const loop = (): void => {
      if (stopped) return;
      const now = performance.now();
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (
        video &&
        landmarker &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        now - lastProcessRef.current >= MIN_INTERVAL_MS
      ) {
        lastProcessRef.current = now;
        let ts = now;
        if (ts <= lastTsRef.current) ts = lastTsRef.current + 1;
        lastTsRef.current = ts;
        try {
          const result = landmarker.detectForVideo(video, ts);
          const lm = result.faceLandmarks[0];
          onFaceRef.current(lm ? toMetrics(lm) : null);
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
      onFaceRef.current(null);
    };
  }, [enabled, ready, videoRef]);

  return { ready };
}

/** Build mirror-corrected anchor metrics from one face's landmarks. */
function toMetrics(lm: Array<{ x: number; y: number }>): FaceMetrics | null {
  const f = lm[IDX.foreheadTop];
  const el = lm[IDX.eyeOuterL];
  const er = lm[IDX.eyeOuterR];
  const tl = lm[IDX.templeL];
  const tr = lm[IDX.templeR];
  if (!f || !el || !er || !tl || !tr) return null;

  // Mirror x (the preview is scaleX(-1)); y is unchanged.
  const mx = (x: number): number => 1 - x;
  const elx = mx(el.x);
  const erx = mx(er.x);

  let roll = (Math.atan2(er.y - el.y, erx - elx) * 180) / Math.PI;
  if (roll > 90) roll -= 180;
  else if (roll < -90) roll += 180;

  return {
    foreheadX: mx(f.x),
    foreheadY: f.y,
    eyeX: (elx + erx) / 2,
    eyeY: (el.y + er.y) / 2,
    faceW: Math.abs(tr.x - tl.x),
    eyeDist: Math.abs(el.x - er.x),
    roll,
  };
}
