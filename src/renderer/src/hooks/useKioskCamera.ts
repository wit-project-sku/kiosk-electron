import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

interface UseKioskCameraOptions {
  deviceId: string | null;
  enabled: boolean;
}

interface UseKioskCameraResult {
  videoRef: RefObject<HTMLVideoElement | null>;
  /**
   * Callback ref for the `<video>`. Prefer this over `videoRef` whenever the
   * element can be swapped while the camera stays on — it re-attaches the live
   * stream to whatever element is currently mounted.
   */
  setVideoEl: (el: HTMLVideoElement | null) => void;
  active: boolean;
  error: string | null;
  capture: () => string | null;
}

/**
 * The camera can hand off between windows — Monitor 2 releases it when the
 * capture countdown ends, and Monitor 1 grabs it for the wait-time game at
 * effectively the same moment. On Windows the device can still read as busy for
 * a beat, so a first `getUserMedia` can fail on a camera that is about to be
 * free. Retry a few times before giving up.
 */
const ACQUIRE_ATTEMPTS = 4;
const ACQUIRE_RETRY_MS = 400;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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

  /**
   * Bind the live stream to whichever `<video>` is mounted right now.
   *
   * The element can change WITHOUT the camera being re-acquired: the customer
   * display swaps the capture-screen video for the mini game's as the workflow
   * moves countdown → generating, and `enabled` stays true across that hop, so
   * the acquire effect never re-runs. Assigning `srcObject` only there left the
   * new element blank — a live camera feeding nothing, which reads downstream as
   * "no one is in front of the camera".
   */
  const setVideoEl = useCallback((el: HTMLVideoElement | null): void => {
    videoRef.current = el;
    if (!el || !streamRef.current) return;
    if (el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      void el.play().catch(() => {
        // Autoplay is allowed kiosk-wide; a transient failure just retries on
        // the next attach.
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    let cancelled = false;

    void (async () => {
      setError(null);
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      };

      for (let attempt = 1; attempt <= ACQUIRE_ATTEMPTS; attempt += 1) {
        if (cancelled) return;
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          setVideoEl(videoRef.current);
          setActive(true);
          return;
        } catch {
          // Last attempt failed for real — surface it. Otherwise the device is
          // most likely mid-handoff from the other window; wait and try again.
          if (attempt === ACQUIRE_ATTEMPTS) {
            if (!cancelled) {
              setError('Camera unavailable. Check that your Elgato or USB camera is connected.');
              setActive(false);
            }
            return;
          }
          await wait(ACQUIRE_RETRY_MS);
        }
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [deviceId, enabled, stop, setVideoEl]);

  const capture = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !active) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.92);
  }, [active]);

  return { videoRef, setVideoEl, active, error, capture };
}
