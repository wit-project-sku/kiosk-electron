import { useEffect, useState } from 'react';
import { homeBanners } from '@renderer/assets/banners/insadong';

/** Bottom promo banners rotate every 30 seconds. */
export const BANNER_ROTATE_MS = 30 * 1000;

/** Active banner slot derived from wall-clock time, so every screen agrees. */
function currentSlot(): number {
  if (homeBanners.length === 0) return 0;
  return Math.floor(Date.now() / BANNER_ROTATE_MS) % homeBanners.length;
}

/**
 * Returns the bottom promo banner URL that should be shown right now (or
 * `undefined` when no banners exist). The slot is computed from wall-clock time
 * rather than a per-mount timer, so banners stay in sync across page navigation
 * and flip together on each 30-second boundary.
 */
export function useRotatingBanner(): string | undefined {
  const [idx, setIdx] = useState(currentSlot);

  useEffect(() => {
    if (homeBanners.length < 2) return;
    // Poll every second; the slot only changes on a 30-second boundary (and
    // setIdx with the same value is a no-op, so this stays cheap).
    const id = setInterval(() => setIdx(currentSlot()), 1_000);
    return () => clearInterval(id);
  }, []);

  return homeBanners[idx];
}
