import type { KioskLayoutId, SupportedLanguage } from '@shared/types/kiosk';
import { createLogger } from '@main/core/logger';

const log = createLogger('localization-sync-parser');

/**
 * Column index of each language in the Localization tab. The first six columns
 * are shared (0 Num, 1 Key, 2 Korean, 3 English, 4 Japanese, 5 Chinese) but the
 * four newer languages sit in a DIFFERENT order per location's sheet, so the
 * column set is keyed by layout:
 *   Localization_Insa      → 6 Vietnamese, 7 Thai,       8 Russian, 9 Indonesian
 *   Localization_Osaek     → 6 Vietnamese, 7 Indonesian, 8 Thai,    9 Russian
 *   Localization_Hwaseong  → 6 Vietnamese, 7 Indonesian, 8 Thai,    9 Russian
 *   Localization_Jeju      → assumed same as Osaek/Hwaseong (the newer template);
 *                            VERIFY against the real 제주 sheet header row before
 *                            trusting it — a wrong order silently swaps languages.
 */
const SHARED_COLS: Array<{ lang: SupportedLanguage; index: number }> = [
  { lang: 'ko', index: 2 },
  { lang: 'en', index: 3 },
  { lang: 'ja', index: 4 },
  { lang: 'zh', index: 5 },
];

const INSA_NEW: Array<{ lang: SupportedLanguage; index: number }> = [
  { lang: 'vi', index: 6 },
  { lang: 'th', index: 7 },
  { lang: 'ru', index: 8 },
  { lang: 'id', index: 9 },
];

const OSAEK_HWASEONG_NEW: Array<{ lang: SupportedLanguage; index: number }> = [
  { lang: 'vi', index: 6 },
  { lang: 'id', index: 7 },
  { lang: 'th', index: 8 },
  { lang: 'ru', index: 9 },
];

const NEW_LANG_COLS: Record<KioskLayoutId, Array<{ lang: SupportedLanguage; index: number }>> = {
  INSADONG: INSA_NEW,
  NAM_INSADONG: INSA_NEW,
  OSAN: OSAEK_HWASEONG_NEW,
  HWASEONG: OSAEK_HWASEONG_NEW,
  JEJU_AIRPORT: OSAEK_HWASEONG_NEW,
};

export type LocalizationByLang = Partial<Record<SupportedLanguage, Record<string, string>>>;

/**
 * Parses a Localization tab into per-language `{ key: text }` maps. Header /
 * blank-key rows are skipped; empty cells are omitted (the renderer falls back
 * to Korean, then the key). Column layout for the four newer languages depends
 * on the kiosk layout — see NEW_LANG_COLS.
 */
export function parseLocalizationSheet(rows: string[][], layout: KioskLayoutId): LocalizationByLang {
  const cols = [...SHARED_COLS, ...NEW_LANG_COLS[layout]];
  const result: LocalizationByLang = {};
  for (const { lang } of cols) result[lang] = {};

  for (const row of rows) {
    const key = (row[1] ?? '').trim();
    if (!key || key === 'Key') continue; // skip section/header rows

    for (const { lang, index } of cols) {
      const text = (row[index] ?? '').replace(/ /g, ' ').trim();
      if (text) result[lang]![key] = text;
    }
  }

  log.info('Parsed localization sheet', {
    layout,
    keys: Object.keys(result.ko ?? {}).length,
  });
  return result;
}
