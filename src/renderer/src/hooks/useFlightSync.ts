import { useEffect } from 'react';
import { isOk } from '@shared/types/result';
import { useFlightStore } from '@renderer/store/flightStore';

/**
 * Mirrors the main-process 제주 운항 snapshot into the renderer store.
 * Call once from JejuKiosk.
 */
export function useFlightSync(): void {
  const setSnapshot = useFlightStore((s) => s.setSnapshot);

  useEffect(() => {
    void window.api.flights.get().then((r) => {
      if (isOk(r)) setSnapshot(r.value);
    });
    const off = window.api.events.onFlightsChanged((snapshot) => setSnapshot(snapshot));
    return off;
  }, [setSnapshot]);
}
