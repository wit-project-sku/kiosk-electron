import type { Lang } from '@renderer/lib/i18n';
import { toLocalizedLang, type LocalizedLang } from '@shared/config/languages';

/** A string in the supported UI languages. ko/en/ja/zh are always present; the
 *  four newer languages (vi/th/ru/id) are optional so 4-language datasets that
 *  haven't been extended yet still satisfy the type. */
export interface LangText {
  ko: string;
  en: string;
  ja: string;
  zh: string;
  vi?: string;
  th?: string;
  ru?: string;
  id?: string;
}

/**
 * Compile-time guard: every language in the LANGUAGES registry MUST have a
 * column here, or pickText would read a key that doesn't exist. If you added a
 * row to LANGUAGES and this line errors, add the matching optional field above —
 * that is the intended coupling, not a bug. The error names the missing code.
 *
 * It must be a CONST, not a bare type alias: an unused conditional type is never
 * evaluated, so a type-only version silently passes and guards nothing.
 */
type MissingLangTextColumns = Exclude<LocalizedLang, keyof LangText>;
export const __langTextCoversRegistry: MissingLangTextColumns extends never
  ? true
  : ['LangText is missing a column for these registry languages:', MissingLangTextColumns] = true;

/** Resolve a LangText for the active language, falling back to Korean. The set of
 *  languages comes from the LANGUAGES registry — no list to keep in sync here. */
export function pickText(text: LangText, lang: Lang): string {
  return (text[toLocalizedLang(lang)] || text.ko || '').trim();
}
