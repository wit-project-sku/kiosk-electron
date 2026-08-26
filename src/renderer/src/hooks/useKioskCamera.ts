import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { PHOTO_CAMERA_ROTATION } from '@shared/constants/photoOptions';

interface UseKioskCameraOptions {
  deviceId: string | null;
  enabled: boolean;
}

interface UseKioskCameraResult {
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  error: string | null;
  capture: () => string | null;
}

/**
 * Kiosk camera hook — uses deviceId from CameraService via IPC.
 * Never stores image data in state; capture returns a data URL on demand.
 */
export function useKioskCamera({ deviceId, enabled }: UseKioskCameraOptions): UseKioskCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback((): void => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
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
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setActive(true);
      } catch {
        if (!cancelled) {
          setError('Camera unavailable. Check that your Elgato or USB camera is connected.');
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
    // The kiosk cameras are mounted sideways (PHOTO_CAMERA_ROTATION): the raw
    // frame is landscape with rotated content, and the AR API must receive the
    // UPRIGHT portrait photo — the same turn the live preview applies. The
    // canvas swaps its axes for a quarter turn (1920×1080 in → 1080×1920 out)
    // and rotates about its centre. NOT mirrored: the mirror is a display-only
    // affordance, and a mirrored photo would flip text on clothing.
    const w = video.videoWidth;
    const h = video.videoHeight;
    const quarter = PHOTO_CAMERA_ROTATION === 90 || PHOTO_CAMERA_ROTATION === 270;
    const canvas = document.createElement('canvas');
    canvas.width = quarter ? h : w;
    canvas.height = quarter ? w : h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((PHOTO_CAMERA_ROTATION * Math.PI) / 180);
    ctx.drawImage(video, -w / 2, -h / 2, w, h);
    return canvas.toDataURL('image/jpeg', 0.92);
  }, [active]);

  return { videoRef, active, error, capture };
}
