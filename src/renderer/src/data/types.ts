import type { Lang } from '@renderer/lib/i18n';

/** A string in the four supported languages (ko / en / ja / zh). */
export interface LangText {
  ko: string;
  en: string;
  ja: string;
  zh: string;
}

/** Resolve a LangText for the active language, falling back to Korean. */
export function pickText(text: LangText, lang: Lang): string {
  const key = (['ko', 'en', 'ja', 'zh'] as const).includes(lang as 'ko') ? (lang as 'ko' | 'en' | 'ja' | 'zh') : 'ko';
  return (text[key] || text.ko || '').trim();
}
