/**
 * THE registry of localized kiosk languages — one row per language, one home.
 *
 * Adding a language used to mean editing five separate lists (LocLang,
 * LANG_TEXT_KEYS, apiLang, LANG_TO_CHANGE_KEY, plus the selector's own labels).
 * Miss one and it fails SILENTLY: that is exactly how vi/th/ru/id shipped with
 * working subtitle text but played the KOREAN language-screen video for weeks —
 * only LANG_TO_CHANGE_KEY was missed, and its `?? ChangeLanguage_KR` fallback hid it.
 *
 * So: add the row here and the whole data path follows — localization lookup,
 * LangText columns, subtitle text, and the language-screen video.
 *
 * The vocabularies genuinely differ and CANNOT be derived from each other —
 * nothing in the API says "VN means Vietnamese". Note the traps, all verified
 * against GET /api/kiosks/{n}/subtitles on production and stage:
 *   - ja  → text key `jp`,  playKey suffix `JP`
 *   - zh  → text key `cn`,  playKey suffix `CH`   ← the two DISAGREE
 *   - vi  → text key `vn`,  playKey suffix `VN`   ← VN, never VI
 * Do not "tidy" these to match the app codes; every one would stop resolving.
 *
 * NOT covered here (a new language still needs these): the `SupportedLanguage`
 * union in shared/types/kiosk.ts, and the selector's flag + label (LANG_META).
 * Those carry assets/types rather than data-path vocabulary.
 */

/** A language the localization tables and API can carry data for. */
export interface LanguageDef {
  /** App language code — the key used everywhere in the UI. */
  code: 'ko' | 'en' | 'ja' | 'zh' | 'vi' | 'th' | 'ru' | 'id';
  /** Key this language uses in API text objects (`main`/`rightTop`). */
  apiTextKey: 'kr' | 'en' | 'jp' | 'cn' | 'vn' | 'th' | 'ru' | 'id';
  /** Suffix of this language's `ChangeLanguage_*` subtitle playKey. */
  playKeySuffix: 'KR' | 'EN' | 'JP' | 'CH' | 'VN' | 'TH' | 'RU' | 'ID';
}

/** Every localized language, in selector order. Korean is first and is the
 *  fallback for every lookup, so it must stay index 0. */
export const LANGUAGES: readonly LanguageDef[] = [
  { code: 'ko', apiTextKey: 'kr', playKeySuffix: 'KR' },
  { code: 'en', apiTextKey: 'en', playKeySuffix: 'EN' },
  { code: 'ja', apiTextKey: 'jp', playKeySuffix: 'JP' },
  { code: 'zh', apiTextKey: 'cn', playKeySuffix: 'CH' },
  { code: 'vi', apiTextKey: 'vn', playKeySuffix: 'VN' },
  { code: 'th', apiTextKey: 'th', playKeySuffix: 'TH' },
  { code: 'ru', apiTextKey: 'ru', playKeySuffix: 'RU' },
  { code: 'id', apiTextKey: 'id', playKeySuffix: 'ID' },
] as const;

/** App code of a localized language (the subset of SupportedLanguage that has data). */
export type LocalizedLang = LanguageDef['code'];

/** The fallback for any language with no data — Korean. */
export const FALLBACK_LANG: LocalizedLang = 'ko';

/** All localized language codes, in selector order. */
export const LOCALIZED_LANGS: readonly LocalizedLang[] = LANGUAGES.map((l) => l.code);

/** Narrow any language string to one with data, else Korean. */
export function toLocalizedLang(lang: string): LocalizedLang {
  return (LOCALIZED_LANGS as readonly string[]).includes(lang)
    ? (lang as LocalizedLang)
    : FALLBACK_LANG;
}

/** The `ChangeLanguage_*` playKey introducing `lang` on the 언어선택 screen. */
export function changeLanguagePlayKey(lang: string): string {
  const def = LANGUAGES.find((l) => l.code === lang);
  return `ChangeLanguage_${(def ?? LANGUAGES[0]!).playKeySuffix}`;
}
