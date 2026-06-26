import { useMemo } from 'react';
import type { KioskScreenId } from '@shared/types/kiosk';
import { parseScreenContent, type ScreenContent } from '@shared/validation/content.schema';
import { useKioskStore } from '@renderer/store/kioskStore';

const FALLBACK: ScreenContent = { title: '', body: '' };

/**
 * Returns validated screen content from the local cache (SQLite via bootstrap).
 * Never fetches from network — content is always local-first.
 */
export function useScreenContent(screenKey: KioskScreenId | string): ScreenContent {
  const getContent = useKioskStore((s) => s.getContent);

  return useMemo(() => {
    const cached = getContent(screenKey);
    if (!cached) return FALLBACK;
    return parseScreenContent(cached.data) ?? FALLBACK;
  }, [getContent, screenKey]);
}
