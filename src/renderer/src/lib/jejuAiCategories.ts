import { JEJU_AI_CATEGORIES_KEY } from '@shared/constants/jejuSheetData';
import { AI_CATEGORIES_JEJU } from '@renderer/data/aiCategories-jeju.generated';
import type { LangText } from '@renderer/data/types';
import { useKioskStore } from '@renderer/store/kioskStore';

let source: unknown = null;
let merged: readonly LangText[] = AI_CATEGORIES_JEJU;

/**
 * AI_CATEGORIES_JEJU with the labels from the copy of AICategory_Jeju downloaded
 * at launch, for display only.
 *
 * Joined by Korean name, in the bundled order, because the tiles are not just
 * labels: JejuAiSearch joins this list BY INDEX to its colours and grid order,
 * direction-fe reads the row number, and the Korean name is what matches a shop's
 * `aiCategoryKr`. So translations and spelling fixes in other languages apply on
 * restart, while a renamed, moved or new Korean row keeps waiting for a release
 * (a new tile needs code anyway) instead of silently emptying or recolouring one.
 */
export function jejuAiCategories(): readonly LangText[] {
  const rows = useKioskStore.getState().getContent(JEJU_AI_CATEGORIES_KEY)?.data['rows'];
  if (rows === source) return merged;
  source = rows;
  if (!Array.isArray(rows)) return (merged = AI_CATEGORIES_JEJU);

  const byKo = new Map((rows as LangText[]).map((row) => [row.ko, row]));
  const unknown = (rows as LangText[]).filter((row) => !AI_CATEGORIES_JEJU.some((c) => c.ko === row.ko));
  if (unknown.length > 0) {
    console.warn(
      '[aiCategories] AICategory_Jeju rows this build does not know:',
      unknown.map((row) => row.ko).join(', '),
      '— they need a release.',
    );
  }
  merged = AI_CATEGORIES_JEJU.map((bundled) => {
    const live = byKo.get(bundled.ko);
    if (!live) return bundled;
    // An emptied cell keeps the bundled text rather than blanking the tile.
    const text = { ...bundled };
    for (const lang of ['en', 'ja', 'zh', 'vi', 'th', 'ru', 'id'] as const) {
      if (live[lang]) text[lang] = live[lang]!;
    }
    return text;
  });
  return merged;
}
