import type { SupportedLanguage } from '@shared/types/kiosk';
import type { LocalizationByLang } from './LocalizationSyncParser';

/**
 * Header text → language for the 제주 voice script tab (Text-to-speech_Script).
 * Its language columns sit after Key / 화면 / 적용, so they are found by name in
 * the header row rather than by position. Mirrors VOICE_LANG_HEADERS in
 * scripts/sync-sheet.mjs.
 */
const VOICE_LANG_HEADERS: Array<{ lang: SupportedLanguage; pattern: RegExp }> = [
  { lang: 'ko', pattern: /^korean$/i },
  { lang: 'en', pattern: /^english$/i },
  { lang: 'ja', pattern: /^japanese$/i },
  { lang: 'zh', pattern: /^chinese$/i },
  { lang: 'vi', pattern: /^vietnamese$/i },
  { lang: 'th', pattern: /^thai$/i },
  { lang: 'ru', pattern: /^russian$/i },
  { lang: 'id', pattern: /^indonesian$/i },
];

/**
 * The voice script's `Voice_*` rows, per language, keyed exactly as in the sheet
 * (`Voice_jeju.home@W008`). The `Voice_` prefix keeps them apart from the
 * Localization keys they are stored alongside. Empty when the tab has no
 * Key header — a renamed or rebuilt tab must not erase the bundled script.
 */
export function parseVoiceSheet(rows: string[][]): LocalizationByLang {
  const header = rows.find((row) => (row[1] ?? '').trim() === 'Key');
  if (!header) return {};
  const cols = VOICE_LANG_HEADERS.map(({ lang, pattern }) => ({
    lang,
    index: header.findIndex((cell) => pattern.test((cell ?? '').trim())),
  })).filter(({ index }) => index >= 0);

  const out: LocalizationByLang = {};
  for (const row of rows) {
    const key = (row[1] ?? '').trim();
    if (!key.startsWith('Voice_')) continue;
    for (const { lang, index } of cols) {
      const text = (row[index] ?? '').trim();
      if (!text) continue;
      (out[lang] ??= {})[key] = text;
    }
  }
  return out;
}
