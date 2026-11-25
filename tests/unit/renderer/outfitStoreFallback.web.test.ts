import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutfitCategory } from '@shared/types/outfit';
import { fallbackOutfitLabels } from '@shared/constants/outfitCategories';

/**
 * 롯데 (2026-11-24): the API answers the 롯데 regions with zero outfits, so the
 * picker drew the bundled PNGs — under the CACHED tab row, whose names
 * (`hanbok`, `daily`, `New Outfit`) the bundle does not use. Those tabs showed
 * 준비 중 while the rest worked. The fallback must bring its own tabs.
 */
const tab = (id: number, categoryName: string): OutfitCategory => ({
  id,
  categoryName,
  sortOrder: id,
  subCategories: [],
  ...fallbackOutfitLabels(categoryName),
});

/** The current catalogue's tab row, as a kiosk that synced elsewhere caches it. */
const CACHED_TABS = ['hanbok', 'New Outfit', 'daily', 'global', 'promotion', 'brand', 'K-Culture'].map((n, i) =>
  tab(i + 1, n),
);

async function loadWith(categories: OutfitCategory[]) {
  vi.stubGlobal('window', {
    api: {
      outfits: {
        get: async () => ({ ok: true, value: { outfits: [], categories, fallback: true } }),
      },
    },
  });
  const { useOutfitStore } = await import('@renderer/store/outfitStore');
  await useOutfitStore.getState().load();
  return useOutfitStore.getState();
}

describe('outfitStore fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('ignores cached tabs and gives every drawn tab its bundled outfits', async () => {
    const s = await loadWith(CACHED_TABS);
    expect(s.fallback).toBe(true);
    expect(s.categories.map((c) => c.categoryName)).not.toContain('daily');
    for (const c of s.categories) {
      expect(s.byCategory[c.categoryName.toLowerCase()]?.length ?? 0, c.categoryName).toBeGreaterThan(0);
    }
  });

  it('still draws the bundled tabs when nothing is cached at all', async () => {
    const s = await loadWith([]);
    expect(s.categories.length).toBeGreaterThan(0);
    for (const c of s.categories) {
      expect(s.byCategory[c.categoryName.toLowerCase()]?.length ?? 0, c.categoryName).toBeGreaterThan(0);
    }
  });
});
