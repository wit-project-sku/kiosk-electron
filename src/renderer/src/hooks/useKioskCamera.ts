import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { CameraRotation } from '@shared/types/photo';

interface UseKioskCameraOptions {
  deviceId: string | null;
  enabled: boolean;
  /**
   * Degrees clockwise the camera is physically rotated on its mount. The UVC
   * stream is always landscape 1920×1080 — a vertically mounted camera just
   * lays the scene on its side — so 90/270 is undone here at capture time and
   * mirrored by the preview's CSS transform.
   */
  rotation?: CameraRotation;
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
export function useKioskCamera({
  deviceId,
  enabled,
  rotation = 0,
}: UseKioskCameraOptions): UseKioskCameraResult {
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
    const frameW = video.videoWidth;
    const frameH = video.videoHeight;
    if (!frameW || !frameH) return null;

    // A quarter turn swaps the output dimensions: a 1920×1080 stream from a
    // vertically mounted camera is written as an upright 1080×1920 portrait,
    // which is what the AR API and the 9:16 result frame expect.
    const quarterTurn = rotation === 90 || rotation === 270;
    const canvas = document.createElement('canvas');
    canvas.width = quarterTurn ? frameH : frameW;
    canvas.height = quarterTurn ? frameW : frameH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (rotation === 0) {
      ctx.drawImage(video, 0, 0, frameW, frameH);
    } else {
      // Canvas rotates clockwise in its y-down space, same direction as the
      // preview's CSS `rotate()` — one rotation value drives both.
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(video, -frameW / 2, -frameH / 2, frameW, frameH);
    }
    return canvas.toDataURL('image/jpeg', 0.92);
  }, [active, rotation]);

  return { videoRef, active, error, capture };
}
