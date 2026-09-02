import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  DEPTH_CAMERA_PATTERN,
  PREFERRED_CAMERA_PATTERN,
  looksLikeStereoPair,
} from '@shared/config/cameras';

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
}

/**
 * Pick the camera to open, EXCLUDING any depth sensor.
 *
 * ── Why this happens here and not in main ──────────────────────────────
 * CameraService also refuses depth devices, but it can only judge what it has
 * been told about: its cache is filled by `camera:listDevices`, and nothing in
 * the renderer ever calls it. `resolveDeviceId()` therefore returns null, and a
 * null deviceId used to mean "no constraint" — which hands the choice to
 * Chromium, which picks the SYSTEM DEFAULT camera. On a 제주 machine that is
 * quite likely the ZED, and the result is a side-by-side stereo photo sent to
 * the AR API with nothing logged anywhere. That is not a fallback, it is a
 * coin toss, so it is gone: this hook decides for itself, from the device list
 * it can see, and opens nothing if there is no valid camera.
 */
async function pickPhotoCamera(explicit: string | null, rejected: Set<string>): Promise<string | null> {
  if (explicit && !rejected.has(explicit)) return explicit;

  const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === 'videoinput',
  );
  const usable = devices.filter(
    (d) => !DEPTH_CAMERA_PATTERN.test(d.label) && !rejected.has(d.deviceId),
  );
  const preferred = usable.find((d) => PREFERRED_CAMERA_PATTERN.test(d.label));
  return (preferred ?? usable[0])?.deviceId ?? null;
}

/**
 * Kiosk camera hook — opens the venue's PHOTO camera, never its depth sensor.
 * Never stores image data in state; capture returns a data URL on demand.
 */
export function useKioskCamera({ deviceId, enabled, rotation = 0 }: UseKioskCameraOptions): UseKioskCameraResult {
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
      // Devices rejected this attempt — a depth sensor whose LABEL was empty
      // (Chromium hides labels until camera permission is granted) and which
      // only gave itself away once its frame arrived. Retrying without it is
      // what turns that hole into a one-frame delay instead of a broken photo.
      const rejected = new Set<string>();

      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (cancelled) return;

        const chosen = await pickPhotoCamera(deviceId, rejected);
        if (!chosen) {
          if (!cancelled) {
            setError('No photo camera found. Check that the Elgato or USB camera is connected.');
            setActive(false);
          }
          return;
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: chosen }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          });
        } catch {
          rejected.add(chosen);
          continue;
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // The label-free backstop. A stereo pair's aspect ratio is nothing like
        // a webcam's, so if this is one we opened a depth sensor blind — drop
        // it, remember it, and take the next candidate.
        const { width = 0, height = 0 } = stream.getVideoTracks()[0]?.getSettings() ?? {};
        if (looksLikeStereoPair(width, height)) {
          stream.getTracks().forEach((t) => t.stop());
          rejected.add(chosen);
          continue;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setActive(true);
        return;
      }

      if (!cancelled) {
        setError('Camera unavailable. Check that your Elgato or USB camera is connected.');
        setActive(false);
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

  return { videoRef, active, error, capture };
}
