import type { Lang } from '@renderer/lib/i18n';
import type { KioskBackground } from '@shared/types/background';

type Suffix = 'Kr' | 'En' | 'Jp' | 'Ch' | 'Vn' | 'Id' | 'Th' | 'Ru';
// Same suffix convention as the shops API (see lib/shops.ts) — the backgrounds
// endpoint carries one name field per UI language.
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
 * The background's name in the current UI language.
 *
 * Every non-Korean field is nullable and is null for most rows today (the CMS
 * only fills Kr/En so far), so an untranslated name shows the Korean one rather
 * than an empty plate.
 */
export const backgroundName = (bg: KioskBackground, lang: Lang): string => {
  const key = `name${SUFFIX[lang] ?? 'Kr'}` as keyof KioskBackground;
  return (bg[key] as string | null | undefined) || bg.nameKr;
};
