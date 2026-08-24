import { useEffect } from 'react';
import { isOk } from '@shared/types/result';
import { useSailingStore } from '@renderer/store/sailingStore';

/**
 * Mirrors the main-process 제주 선박 운항 snapshot into the renderer store.
 * Call once from JejuKiosk on W007.
 */
export function useSailingSync(): void {
  const setSnapshot = useSailingStore((s) => s.setSnapshot);

  useEffect(() => {
    void window.api.sailings.get().then((r) => {
      if (isOk(r)) setSnapshot(r.value);
    });
    const off = window.api.events.onSailingsChanged((snapshot) => setSnapshot(snapshot));
    return off;
  }, [setSnapshot]);
}
