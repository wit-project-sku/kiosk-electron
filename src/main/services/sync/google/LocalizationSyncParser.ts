import type { SupportedLanguage } from '@shared/types/kiosk';
import { createLogger } from '@main/core/logger';

const log = createLogger('localization-sync-parser');

/** Localization_Insa columns: 0 Num, 1 Key, 2 Korean, 3 English, 4 Japanese, 5 Chinese. */
const COLS: Array<{ lang: SupportedLanguage; index: number }> = [
  { lang: 'ko', index: 2 },
  { lang: 'en', index: 3 },
  { lang: 'ja', index: 4 },
  { lang: 'zh', index: 5 },
];

export type LocalizationByLang = Partial<Record<SupportedLanguage, Record<string, string>>>;

/**
 * Parses the Localization_Insa tab into per-language `{ key: text }` maps.
 * Header / blank-key rows are skipped; empty cells are omitted (the renderer
 * falls back to Korean, then the key).
 */
export function parseLocalizationSheet(rows: string[][]): LocalizationByLang {
  const result: LocalizationByLang = { ko: {}, en: {}, ja: {}, zh: {} };

  for (const row of rows) {
    const key = (row[1] ?? '').trim();
    if (!key || key === 'Key') continue; // skip section/header rows

    for (const { lang, index } of COLS) {
      const text = (row[index] ?? '').replace(/ /g, ' ').trim();
      if (text) result[lang]![key] = text;
    }
  }

  log.info('Parsed localization sheet', {
    keys: Object.keys(result.ko ?? {}).length,
  });
  return result;
}
