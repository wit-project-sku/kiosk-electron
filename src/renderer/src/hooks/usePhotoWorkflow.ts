import { useEffect, useRef } from 'react';
import { isOk } from '@shared/types/result';
import { usePhotoStore } from '@renderer/store/photoStore';

/**
 * Syncs photo workflow state from main process and wires live updates.
 */
export function usePhotoWorkflow(onCountdownComplete?: () => void): void {
  const applyWorkflow = usePhotoStore((s) => s.applyWorkflow);
  const countdown = usePhotoStore((s) => s.countdown);
  const phase = usePhotoStore((s) => s.phase);
  const prevCountdown = useRef<number | null>(null);

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
      onCountdownComplete?.();
    }
    prevCountdown.current = countdown;
  }, [countdown, phase, onCountdownComplete]);
}
