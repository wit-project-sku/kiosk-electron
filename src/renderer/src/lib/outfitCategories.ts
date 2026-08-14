import type { Lang } from '@renderer/lib/i18n';
import type { OutfitCategory } from '@shared/types/outfit';

type Suffix = 'Kr' | 'En' | 'Jp' | 'Ch' | 'Vn' | 'Id' | 'Th' | 'Ru';
// Same suffix convention as the backgrounds and shops APIs (see lib/backgrounds
// and lib/shops) — the category endpoint carries one label per UI language.
const SUFFIX: Record<string, Suffix> = {
  ko: 'Kr',
  en: 'En',
  ja: 'Jp',
  zh: 'Ch',
  vi: 'Vn',
  id: 'Id',
  th: 'Th',
  ru: 'Ru',
};

/**
 * The outfit tab's label in the current UI language.
 *
 * These come from the admin web and are the only thing the visitor may see —
 * `categoryName` is a filter code ("w=hannbok") and must never be rendered. It
 * is still the last resort here, ahead of drawing a blank tab, but the server
 * and the offline fallback both fill every label, so it should not be reached.
 */
export const outfitCategoryLabel = (cat: OutfitCategory, lang: Lang): string => {
  const key = `label${SUFFIX[lang] ?? 'Kr'}` as keyof OutfitCategory;
  return (cat[key] as string | undefined) || cat.labelKr || cat.categoryName;
};
