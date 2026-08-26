import type { Lang } from '@renderer/lib/i18n';
import { hasLoc, t } from '@renderer/lib/loc';
import { toLocalizedLang, type LocalizedLang } from '@shared/config/languages';

/**
 * The "고궁" category chip shown on every 고궁안내 card and on its detail page.
 *
 * Sheet-first: the moment a `Palace_Category` row exists in Localization_Insa,
 * `t()` serves it and this file's table stops being consulted — a copy edit then
 * needs no code change, like every other string on the screen. The row does NOT
 * exist yet (checked against the live sheet), and `t()` renders the raw KEY when
 * a row is missing, so a bare `t('Palace_Category', lang)` would put the literal
 * text "Palace_Category" on the card. Hence the guard and the table below.
 *
 * The table exists because the previous hardcoded map covered ko/en/ja/zh only
 * and fell back to Korean — so vi/th/ru/id visitors saw "고궁" on an otherwise
 * fully translated card. Delete this file's table once the sheet row lands.
 */
const SHEET_KEY = 'Palace_Category';

const FALLBACK: Record<LocalizedLang, string> = {
  ko: '고궁',
  en: 'Palace',
  ja: '古宮',
  zh: '古宫',
  vi: 'Cung điện',
  th: 'พระราชวัง',
  ru: 'Дворец',
  id: 'Istana',
};

/** Localized "고궁" category label. */
export function palaceCategory(lang: Lang): string {
  if (hasLoc(SHEET_KEY)) return t(SHEET_KEY, lang);
  return FALLBACK[toLocalizedLang(lang)];
}
