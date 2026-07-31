import { useEffect, useMemo, useState } from 'react';
import type { KioskBanner } from '@shared/types/banner';
import { homeBanners } from '@renderer/assets/banners/insadong';
import { useBannerStore } from '@renderer/store/bannerStore';

/** Bottom promo banners rotate every 30 seconds. */
export const BANNER_ROTATE_MS = 30 * 1000;

/** Local `YYYY-MM-DD` for today, to test a banner's inclusive date window. */
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Banner image URLs active today (inclusive `[startDate, endDate]`), ordered by
 * `sortOrder`. ISO `YYYY-MM-DD` strings compare lexicographically, so plain
 * string comparison is a correct date test. A missing bound is treated as open.
 */
function activeBannerUrls(banners: KioskBanner[], today: string): string[] {
  return banners
    .filter(
      (b) =>
        Boolean(b.imageUrl) &&
        (!b.startDate || b.startDate <= today) &&
        (!b.endDate || b.endDate >= today),
    )
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((b) => b.imageUrl);
}

/** Active slot from wall-clock time, so every screen agrees and flips together. */
function slot(len: number, nowMs: number): number {
  if (len === 0) return 0;
  return Math.floor(nowMs / BANNER_ROTATE_MS) % len;
}

/**
 * Returns the bottom promo banner URL to show right now, or `undefined` when
 * there is nothing to show.
 *
 * The banner set is the live one from the witteria banners API
 * (`GET /api/kiosks/{id}/banners`, cached in SQLite via {@link useBannerStore}),
 * filtered to today's active date window and ordered by `sortOrder`. When the
 * API set is empty — offline before the first fetch, or no active banner — it
 * falls back to `fallback` (the caller's bundled banner). Insadong defaults to
 * its bundled {@link homeBanners}, so its many call sites need no change.
 *
 * The slot is computed from wall-clock time rather than a per-mount timer, so
 * banners stay in sync across page navigation and flip together on each
 * 30-second boundary.
 */
export function useRotatingBanner(
  fallback: string | undefined | ReadonlyArray<string | undefined> = homeBanners,
): string | undefined {
  const banners = useBannerStore((s) => s.banners);
  const [tick, setTick] = useState(() => Date.now());

  const today = todayKey();
  const urls = useMemo(() => {
    const api = activeBannerUrls(banners, today);
    if (api.length > 0) return api;
    const fb = Array.isArray(fallback) ? fallback : [fallback];
    return (fb as ReadonlyArray<string | undefined>).filter((u): u is string => Boolean(u));
  }, [banners, today, fallback]);

  useEffect(() => {
    if (urls.length < 2) return;
    // Poll every second; the slot only changes on a 30-second boundary (and
    // setTick with a value in the same slot is effectively a no-op paint).
    const id = setInterval(() => setTick(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [urls.length]);

  if (urls.length === 0) return undefined;
  return urls[slot(urls.length, tick)];
}
