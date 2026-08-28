import type { Lang } from '@renderer/lib/i18n';
import type {
  OutfitCategory,
  OutfitCategoryLabels,
  OutfitSubCategory,
} from '@shared/types/outfit';

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
export const outfitCategoryLabel = (cat: OutfitCategory, lang: Lang): string =>
  label(cat, lang) || cat.categoryName;

/**
 * A sub-category chip's label in the current UI language.
 *
 * Unlike a category there is no code to fall back to — the id is the key and
 * these labels are the entire display — so the Korean one is the last resort,
 * and the normalizer already drops a row that has not even that.
 */
export const outfitSubCategoryLabel = (sub: OutfitSubCategory, lang: Lang): string =>
  label(sub, lang);

/**
 * An outfit's own name in the current UI language — the caption under its card
 * (Figma 6530:10487).
 *
 * ★ This is `label*`, never the row's `name`: that field is the operator's
 * filing slug ("global_5.7"), identical in all eight languages. OutfitService
 * already falls the labels back to it (and then to the AR code) for a source
 * that carries none — prod today — so there is nothing further to fall back
 * to here.
 */
export const outfitLabel = (outfit: OutfitCategoryLabels, lang: Lang): string =>
  label(outfit, lang);

/** The label for the current language, else the Korean one. */
function label(labels: OutfitCategoryLabels, lang: Lang): string {
  const key = `label${SUFFIX[lang] ?? 'Kr'}` as keyof OutfitCategoryLabels;
  return labels[key] || labels.labelKr;
}
