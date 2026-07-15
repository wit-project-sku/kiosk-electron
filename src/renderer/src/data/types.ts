import type { Lang } from '@renderer/lib/i18n';

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

/** Languages that a LangText can carry a value for. */
type LangTextKey = keyof LangText;
const LANG_TEXT_KEYS: readonly LangTextKey[] = ['ko', 'en', 'ja', 'zh', 'vi', 'th', 'ru', 'id'];

/** Resolve a LangText for the active language, falling back to Korean. */
export function pickText(text: LangText, lang: Lang): string {
  const key = (LANG_TEXT_KEYS as readonly string[]).includes(lang) ? (lang as LangTextKey) : 'ko';
  return (text[key] || text.ko || '').trim();
}
