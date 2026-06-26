import { useEffect } from 'react';
import { isOk } from '@shared/types/result';
import { useExchangeStore } from '@renderer/store/exchangeStore';

/**
 * Mirrors the main-process FX snapshot into the renderer store: reads the cached
 * value once on mount, then subscribes to refresh broadcasts. Call once near the
 * top of the kiosk tree.
 */
export function useExchangeSync(): void {
  const setExchange = useExchangeStore((s) => s.setExchange);

  useEffect(() => {
    // Guard against a stale preload (e.g. before a full dev restart) so a missing
    // `exchange` bridge can't throw and break the rest of the kiosk.
    const api = window.api?.exchange;
    if (!api) return;
    void api.get().then((r) => {
      if (isOk(r)) setExchange(r.value);
    });
    const off = window.api.events.onExchangeChanged((snapshot) => setExchange(snapshot));
    return off;
  }, [setExchange]);
}
