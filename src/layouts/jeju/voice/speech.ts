/**
 * The one speaker for 제주 voice guidance, on Chromium's speechSynthesis (the
 * Windows voices installed on the kiosk — nothing leaves the machine).
 *
 * ── Three layers, one voice ─────────────────────────────────────────────────
 * Only one line plays at a time. What a new line does to the one playing
 * depends on their priority — L3 state (3) > L1 screen entry (2) > L2 focus (1):
 *   - same or higher priority → cuts the current line and plays now;
 *   - lower → waits in the queue and plays when the current line ends, so the
 *     ring re-landing on a new screen is read AFTER that screen's intro rather
 *     than cutting it off.
 * The queue keeps only the newest waiting focus line: walking past five tiles
 * while an intro plays should read the fifth, not all five. Screen and state
 * lines queue in order — an intro and its hint are two lines of one sentence.
 *
 * A `lead` line (voice on, language changed, going home…) is the first half of
 * a pair — the screen that opens next follows it instead of cutting it off.
 * Only a more urgent line gets past a lead: a countdown number does not wait
 * for the capture intro to finish.
 *
 * Input stops everything (`stop`): useJejuVoice calls it on every touch and
 * every keypad press, before the key's own action speaks.
 */
import { useVoiceStore, VOLUME_STEPS } from './voiceStore';

export type VoiceLang = 'ko' | 'en' | 'ja' | 'zh' | 'vi' | 'th' | 'ru' | 'id';

export const Priority = { Focus: 1, Screen: 2, State: 3 } as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export interface Line {
  text: string;
  lang: VoiceLang;
  priority: Priority;
  /** The next screen's intro follows this line rather than cutting it off. */
  lead?: boolean;
  /** Plays even while voice is off — the goodbye line of the idle reset. */
  force?: boolean;
  /** Follows whatever is playing instead of cutting it — "no results" after the intro. */
  after?: boolean;
}

/** BCP-47 tag handed to the utterance, which steers Chromium's own pick too. */
const LANG_TAGS: Record<VoiceLang, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
  vi: 'vi-VN',
  th: 'th-TH',
  ru: 'ru-RU',
  id: 'id-ID',
};

/** "5~9명": a number range, in words — a voice either reads the sign or runs the numbers together. */
const RANGE_WORD: Record<VoiceLang, string> = {
  ko: '에서',
  en: 'to',
  ja: 'から',
  zh: '到',
  vi: 'đến',
  th: 'ถึง',
  ru: 'до',
  id: 'sampai',
};
/** "10명~", "10+ pax": an open range. */
const OR_MORE: Record<VoiceLang, string> = {
  ko: '이상',
  en: 'or more',
  ja: '以上',
  zh: '以上',
  vi: 'trở lên',
  th: 'ขึ้นไป',
  ru: 'и более',
  id: 'atau lebih',
};

/** Screen text as it should sound: the sheet's chips and bodies are written for the eye. */
export function speakable(text: string, lang: VoiceLang): string {
  return text
    .replace(/(\d)\s*[~～∼]\s*(?=\d)/g, `$1 ${RANGE_WORD[lang]} `)
    // A number and its unit, then the sign, with no second number: "10명~." — the
    // focus templates add a period or "선택됨" after it, so it is rarely line-final.
    .replace(/(\d[^\d~～∼\n]{0,6}?)\s*[~～∼]+(?!\s*\d)/g, `$1 ${OR_MORE[lang]}`)
    .replace(/(\d)\+/g, `$1 ${OR_MORE[lang]}`)
    .replace(/[~～∼]+/g, ' ');
}

let voices: SpeechSynthesisVoice[] = [];
const loadVoices = (): void => {
  voices = window.speechSynthesis?.getVoices() ?? [];
};
if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  // The list arrives asynchronously in Chromium; getVoices() is empty at boot.
  window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

function voiceFor(lang: VoiceLang): SpeechSynthesisVoice | undefined {
  const prefix = lang.toLowerCase();
  const matches = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(prefix));
  // Installed voices before network ones: guidance must not depend on the internet.
  return matches.find((v) => v.localService) ?? matches[0];
}

/**
 * Whether the kiosk can speak `lang` at all. True while the voice list has not
 * loaded yet, so the first line after boot is not needlessly moved to English.
 */
export function canSpeak(lang: VoiceLang): boolean {
  return voices.length === 0 || voiceFor(lang) !== undefined;
}

/** The installed voices, for the diagnostics the spec asks for on the kiosk PC. */
export function listVoices(): { name: string; lang: string; local: boolean }[] {
  return voices.map((v) => ({ name: v.name, lang: v.lang, local: v.localService }));
}

let current: Line | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let queue: Line[] = [];

function play(line: Line): void {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const u = new SpeechSynthesisUtterance(speakable(line.text, line.lang));
  u.lang = LANG_TAGS[line.lang];
  const voice = voiceFor(line.lang);
  if (voice) u.voice = voice;
  u.volume = VOLUME_STEPS[useVoiceStore.getState().volumeStep] ?? VOLUME_STEPS[1];
  const done = (): void => {
    // cancel() fires end/error on the utterance it dropped, after the next
    // one has started — only the utterance still playing may advance the queue.
    if (currentUtterance !== u) return;
    current = null;
    currentUtterance = null;
    const next = queue.shift();
    if (next) play(next);
  };
  // Debug level: in main.log on a dev build only (see core/logger), never on a kiosk.
  // eslint-disable-next-line no-console
  u.onstart = () => console.debug(`[voice] speaking (${u.lang}, ${voice?.name ?? 'default voice'}): ${line.text}`);
  u.onend = done;
  u.onerror = (e) => {
    // 'interrupted' / 'canceled' are our own stop() and cuts — not failures.
    if (e.error !== 'interrupted' && e.error !== 'canceled') {
      console.warn('[voice] could not speak', { error: e.error, lang: line.lang, text: line.text.slice(0, 40) });
    }
    done();
  };
  current = line;
  // Also keeps the utterance referenced: Chromium drops end events for
  // utterances that were garbage-collected mid-sentence.
  currentUtterance = u;
  synth.speak(u);
}

export function say(line: Line | null): void {
  if (!line || !line.text) return;
  if (!line.force && !useVoiceStore.getState().on) return;

  // A lead holds back lines of its own priority or lower; a more urgent line
  // (a countdown number over the capture intro) still cuts straight in.
  if (
    current &&
    (line.after || (current.lead ? current.priority >= line.priority : current.priority > line.priority))
  ) {
    if (line.priority === Priority.Focus) queue = queue.filter((q) => q.priority !== Priority.Focus);
    queue.push(line);
    return;
  }
  queue = [];
  if (current) {
    currentUtterance = null;
    window.speechSynthesis?.cancel();
  }
  play(line);
}

/**
 * Forget waiting lines of `priority` — a new screen intro supersedes one that
 * never got to play (the visitor has already moved past that screen).
 */
export function dropQueued(priority: Priority): void {
  queue = queue.filter((q) => q.priority !== priority);
}

/** Silence now and forget anything waiting. */
export function stop(): void {
  queue = [];
  current = null;
  currentUtterance = null;
  window.speechSynthesis?.cancel();
}
