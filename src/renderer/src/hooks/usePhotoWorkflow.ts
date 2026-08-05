import { useEffect, useRef } from 'react';
import { isOk } from '@shared/types/result';
import { usePhotoStore } from '@renderer/store/photoStore';

/**
 * Syncs photo workflow state from main process and wires live updates.
 *
 * `onCaptureDue` fires when it is time to take the shot — either the countdown
 * hit 0 (normal flow) or the touch screen pressed 촬영 (manual capture mode,
 * which bumps captureToken). Only the display window passes it, since that is
 * where the camera stream lives.
 */
export function usePhotoWorkflow(onCaptureDue?: () => void): void {
  const applyWorkflow = usePhotoStore((s) => s.applyWorkflow);
  const countdown = usePhotoStore((s) => s.countdown);
  const captureToken = usePhotoStore((s) => s.captureToken);
  const phase = usePhotoStore((s) => s.phase);
  const prevCountdown = useRef<number | null>(null);
  const prevToken = useRef<number>(captureToken);

  useEffect(() => {
    void window.api.photo.getWorkflow().then((r) => {
      if (isOk(r)) applyWorkflow(r.value);
    });

    const off = window.api.events.onPhotoWorkflowChanged(applyWorkflow);
    return off;
  }, [applyWorkflow]);

  useEffect(() => {
    if (
      phase === 'countdown' &&
      prevCountdown.current !== null &&
      prevCountdown.current > 0 &&
      countdown === 0
    ) {
      onCaptureDue?.();
    }
    prevCountdown.current = countdown;
  }, [countdown, phase, onCaptureDue]);

  useEffect(() => {
    // A reset drops the token back to 0 — only a genuine increment is a shot.
    if (captureToken > prevToken.current) onCaptureDue?.();
    prevToken.current = captureToken;
  }, [captureToken, onCaptureDue]);
}
