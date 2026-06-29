/**
 * Spoken voice prompts for the AI 한복 camera phase (Monitor 2).
 *
 * Files are pre-generated (neural TTS) and bundled, so playback is instant and
 * works fully offline. One clip per supported language, named
 * `stay-in-frame.<lang>.mp3` — played when the customer steps out of frame
 * during the capture countdown ("please stand in front of the camera").
 *
 * Drop additional `<key>.<lang>.mp3` clips into this folder to add prompts;
 * they are picked up automatically at build time.
 */
import type { SupportedLanguage } from '@shared/types/kiosk';

const modules = import.meta.glob('./*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Chinese variants share the simplified-Chinese clip. */
function normalizeLang(lang: SupportedLanguage): string {
  if (lang === 'zh_cn' || lang === 'zh_tw') return 'zh';
  return lang;
}

/** URL of a voice prompt for the active language, falling back to Korean. */
function promptUrl(key: string, lang: SupportedLanguage): string | undefined {
  const l = normalizeLang(lang);
  return modules[`./${key}.${l}.mp3`] ?? modules[`./${key}.ko.mp3`];
}

/** "Please stand in front of the camera" — localized. */
export function stayInFrameAudioUrl(lang: SupportedLanguage): string | undefined {
  return promptUrl('stay-in-frame', lang);
}
