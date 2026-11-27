/**
 * What a 자동 촬영 wears — a random outfit from this kiosk's catalogue and, for a
 * 제주 outfit, a random 배경 테마. Same pairing rule as the visitor screen
 * (JejuHanbokSelect): only the 제주 category offers backgrounds, every other
 * category is shot without one (an AR solo request with a background needs the
 * outfit's CB template, which only the 제주 outfits have).
 */

/** The 제주 category name, lower-cased — JejuHanbokSelect's `JEJU_CATEGORY`. */
export const AUTO_SHOT_THEME_CATEGORY = 'jeju';

export interface AutoShotOutfit {
  code: string;
  gender: 'female' | 'male' | undefined;
}

export interface AutoShotPick {
  /** "gender|code", as the visitor flow sends it. */
  clothingKey: string;
  backgroundId: number | null;
}

/**
 * @param byCategory outfits keyed by lower-cased category name (outfitStore)
 * @param backgroundIds this kiosk's active 배경 테마 ids (backgroundStore)
 * @param random [0, 1) — injectable for tests
 * @returns null when the catalogue is empty
 */
export function pickAutoShot(
  byCategory: Readonly<Record<string, readonly AutoShotOutfit[]>>,
  backgroundIds: readonly number[],
  random: () => number = Math.random,
): AutoShotPick | null {
  const all = Object.entries(byCategory).flatMap(([category, outfits]) =>
    outfits.map((outfit) => ({ category, outfit })),
  );
  if (all.length === 0) return null;
  const { category, outfit } = all[Math.floor(random() * all.length)]!;
  const themed = category === AUTO_SHOT_THEME_CATEGORY && backgroundIds.length > 0;
  return {
    clothingKey: `${outfit.gender ?? ''}|${outfit.code}`,
    backgroundId: themed ? backgroundIds[Math.floor(random() * backgroundIds.length)]! : null,
  };
}
