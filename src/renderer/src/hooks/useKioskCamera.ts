import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { openMonoCamera, PHOTO_STEREO_MODES, type MonoCamera } from '@renderer/lib/stereoCamera';

interface UseKioskCameraOptions {
  deviceId: string | null;
  enabled: boolean;
  /**
   * Degrees clockwise the raw frame must be turned to stand upright — the
   * venue's camera mount (see kioskLocations.cameraRotation). 0 for an upright
   * camera; the 제주 kiosks are 90. Must match what the live preview applies.
   */
  rotation?: 0 | 90 | 180 | 270;
}

interface UseKioskCameraResult {
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  error: string | null;
  capture: () => string | null;
  /** The camera delivered a side-by-side frame and one eye was kept. */
  stereo: boolean;
}

/**
 * Kiosk camera hook — uses deviceId from CameraService via IPC.
 * Never stores image data in state; capture returns a data URL on demand.
 *
 * The stream handed to `videoRef` is always a single-picture one. A stereo
 * camera (the ZED 2i) puts both sensors inside one frame, side by side, and
 * `openMonoCamera` halves it before anything here sees it — so the preview, the
 * capture below and the hand landmarker that reads the same element all get an
 * ordinary mono feed. See `lib/stereoCamera.ts`.
 */
export function useKioskCamera({ deviceId, enabled, rotation = 0 }: UseKioskCameraOptions): UseKioskCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<MonoCamera | null>(null);
  const [active, setActive] = useState(false);
  const [stereo, setStereo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback((): void => {
    cameraRef.current?.stop();
    cameraRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setStereo(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    let cancelled = false;

    void (async () => {
      setError(null);
      try {
        const camera = await openMonoCamera({
          deviceId,
          stereoModes: PHOTO_STEREO_MODES,
          // What a plain webcam gets — unchanged from before the ZED, so the
          // Elgato kiosks that have not been swapped over behave identically.
          fallback: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) {
          camera.stop();
          return;
        }
        cameraRef.current = camera;
        if (videoRef.current) {
          videoRef.current.srcObject = camera.stream;
          await videoRef.current.play();
        }
        setStereo(camera.stereo);
        setActive(true);
      } catch {
        if (!cancelled) {
          setError('Camera unavailable. Check that your ZED or USB camera is connected.');
          setActive(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [deviceId, enabled, stop]);

  const capture = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !active) return null;
    // A sideways-mounted camera (rotation 90/270 — the 제주 kiosks) delivers a
    // landscape frame with rotated content, and the AR API must receive the
    // UPRIGHT portrait photo — the same turn the live preview applies. The
    // canvas swaps its axes for a quarter turn (1920×1080 in → 1080×1920 out)
    // and rotates about its centre; rotation 0 leaves the frame untouched.
    // NOT mirrored: the mirror is a display-only affordance, and a mirrored
    // photo would flip text on clothing.
    const w = video.videoWidth;
    const h = video.videoHeight;
    const quarter = rotation === 90 || rotation === 270;
    const canvas = document.createElement('canvas');
    canvas.width = quarter ? h : w;
    canvas.height = quarter ? w : h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(video, -w / 2, -h / 2, w, h);
    return canvas.toDataURL('image/jpeg', 0.92);
  }, [active, rotation]);

  return { videoRef, active, error, capture, stereo };
}
