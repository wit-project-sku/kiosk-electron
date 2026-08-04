import { useEffect, useState } from 'react';
import type { UpdateStatus } from '@shared/types/update';

/**
 * Live auto-update status for the renderer.
 *
 * Reads the current status once on mount, then stays in sync via the
 * `event:update:statusChanged` broadcast. Returns `null` until the first value
 * arrives. The renderer only ever reads status — all update behaviour lives in
 * the main-process UpdateService (see the preload bridge; no Electron APIs are
 * exposed to the renderer).
 */
export function useUpdateStatus(): UpdateStatus | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    let active = true;

    void window.api.updates.getStatus().then((res) => {
      if (active && res.ok) setStatus(res.value);
    });

    const off = window.api.events.onUpdateStatusChanged((next) => {
      if (active) setStatus(next);
    });

    return () => {
      active = false;
      off();
    };
  }, []);

  return status;
}
