/** Shared subtitle types used by both main-process SubtitleService and renderer. */

import { LANGUAGES, type LocalizedLang } from '@shared/config/languages';

/** Every bundled video set, in one place — iterate this instead of re-listing the
 *  names, so adding a location's set is a single edit. */
export const VIDEO_SETS = ['insadong', 'osaek', 'hwaseong', 'jeju'] as const;

/** Which bundled video set a kiosk plays from (resources/videos/<set>/). */
export type VideoSet = (typeof VIDEO_SETS)[number];

/** Real .mp4 file names present on disk, per video set. Listed at runtime by
 *  the main process (IPC VideosList) so newly-added videos are picked up without
 *  a rebuild — there is no build-time file manifest. */
export type VideoFilesBySet = Record<VideoSet, string[]>;

export interface SubtitleLangText {
  ko: string;
  en: string;
  ja: string;
  zh: string;
  vi?: string;
  th?: string;
  ru?: string;
  id?: string;
}

/** Single video + subtitle entry, keyed by playKey (e.g. "Default", "ToEat"). */
export interface VideoEntry {
  /** State/screen key (Default, ToEat, Palace, …). */
  key: string;
  /** Video file stem (matches resources/videos, minus .mp4 and set prefix). */
  file: string;
  subtitle: SubtitleLangText;
  label: SubtitleLangText;
  /**
   * Owning `buttons.id` when this entry came from `data.buttons[]`, else `null`
   * (autoSubtitles — Default idle, weather). Lets the display resolve a home
   * button's clip directly by its DB id instead of a hardcoded screen→playKey
   * table. Optional so older SQLite-cached entries (written before this field
   * existed) still parse.
   */
  buttonId?: number | null;
  /** API sort order within the owning button/autoSubtitles list. Optional for
   *  the same cache-compat reason; used to pick a button's primary clip. */
  sortOrder?: number;
}

// ── Raw API response shapes ────────────────────────────────────────────────

interface ApiLangText {
  kr?: string;
  en?: string;
  jp?: string;
  cn?: string;
  vn?: string;
  th?: string;
  ru?: string;
  id?: string;
}

interface ApiSubtitleItem {
  playKey: string;
  sortOrder: number;
  video: { videoFileName: string } | null;
  main: ApiLangText;
  rightTop: ApiLangText;
}

interface ApiButton {
  buttonId: number;
  subtitles: ApiSubtitleItem[];
}

export interface SubtitleApiResponse {
  success: boolean;
  data: {
    kioskId: number;
    buttons: ApiButton[];
    autoSubtitles: ApiSubtitleItem[];
  };
}

// ── Transformation ─────────────────────────────────────────────────────────

/**
 * API language keys → app language codes, driven by the LANGUAGES registry so a
 * new language needs no edit here. This used to be a hand-written list, and when
 * it carried only 4 entries it silently dropped vi/th/ru/id.
 */
function apiLang(obj: ApiLangText): SubtitleLangText {
  const out = {} as Record<LocalizedLang, string>;
  for (const { code, apiTextKey } of LANGUAGES) {
    out[code] = obj[apiTextKey] ?? '';
  }
  return out as SubtitleLangText;
}

function extractStem(videoFileName: string): string {
  const slash = videoFileName.lastIndexOf('/');
  return slash >= 0 ? videoFileName.slice(slash + 1) : videoFileName;
}

/** Flatten API response into VideoEntry[] matching the static generated format. */
export function transformSubtitleResponse(res: SubtitleApiResponse): VideoEntry[] {
  const entries: VideoEntry[] = [];

  // Include every button's subtitles regardless of `status`: status gates the
  // touch-screen button visibility, not whether the subtitle/video lookup entry
  // should exist. The map is just a playKey → clip table.
  const push = (s: ApiSubtitleItem, buttonId: number | null): void => {
    if (!s.video?.videoFileName) return;
    entries.push({
      key: s.playKey,
      file: extractStem(s.video.videoFileName),
      subtitle: apiLang(s.main),
      label: apiLang(s.rightTop),
      buttonId,
      sortOrder: s.sortOrder,
    });
  };

  for (const button of res.data.buttons) {
    for (const s of button.subtitles) push(s, button.buttonId);
  }
  for (const s of res.data.autoSubtitles) push(s, null);

  return entries;
}
