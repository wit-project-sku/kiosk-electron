import { useEffect } from 'react';
import { isOk } from '@shared/types/result';
import type { ExpresswayTrafficSnapshot } from '@shared/types/traffic';
import { useTrafficStore } from '@renderer/store/trafficStore';

/** The server caches 3 minutes — polling faster only re-reads the same value. */
const POLL_MS = 3 * 60 * 1000;

/**
 * Polls GET /api/traffic/expressway (through main) while the caller is mounted
 * and returns the latest snapshot. A failed or empty answer (503 INFO5031)
 * leaves the previous snapshot in place; null means nothing has arrived yet.
 */
export function useExpresswayTraffic(): ExpresswayTrafficSnapshot | null {
  const expressway = useTrafficStore((s) => s.expressway);
  const setExpressway = useTrafficStore((s) => s.setExpressway);

  useEffect(() => {
    // Guard against a stale preload (before a full dev restart).
    const api = window.api?.traffic;
    if (!api) return;
    let alive = true;
    const load = (): void => {
      void api.getExpressway().then((r) => {
        if (alive && isOk(r) && r.value) setExpressway(r.value);
      });
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [setExpressway]);

  return expressway;
}
