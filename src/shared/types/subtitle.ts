/** Shared subtitle types used by both main-process SubtitleService and renderer. */

import { LANGUAGES, type LocalizedLang } from '@shared/config/languages';

/** Every bundled video set, in one place — iterate this instead of re-listing the
 *  names, so adding a location's set is a single edit.
 *
 *  제주 is THREE sets, not one. W006 제주공항 and W007 제주국제여객터미널 share a
 *  layout and a content sheet, but not their footage: the airport reels talk
 *  about 항공편/탑승구 and the terminal's about 여객선/뱃길 (see the FlightInfo_*
 *  vs FerryInfo_* rows of VideoSubtitle_귤이). One shared `jeju` folder would
 *  put flight clips on a ferry terminal's second monitor, so each venue reads
 *  its own folder and W008 세계자연유산본부 (mascot 유산, its own tab) gets a
 *  third — empty until 유산 footage exists, which simply plays nothing. */
export const VIDEO_SETS = [
  'insadong',
  'osaek',
  'hwaseong',
  'jeju-airport',
  'jeju-terminal',
  'jeju-heritage',
  'kada',
] as const;

/** Which bundled video set a kiosk plays from (resources/videos/<set>/). */
export type VideoSet = (typeof VIDEO_SETS)[number];

/**
 * Folders still READ under the videos root that no kiosk is assigned to.
 *
 * `jeju` is the single folder all three 제주 venues shared before the airport /
 * terminal / heritage split. Every 제주 machine already in the field has its
 * footage there, and an auto-update ships code, not file moves — so dropping
 * the name would black out those second monitors the moment they updated.
 * The legacy folder is folded into each 제주 set at load (see initVideoFiles),
 * with the venue's own folder winning, so moving the files is a cleanup rather
 * than a migration anyone has to perform on a deadline.
 */
export const LEGACY_VIDEO_SETS = ['jeju'] as const;
export type LegacyVideoSet = (typeof LEGACY_VIDEO_SETS)[number];

/** Every folder the main process lists under the videos root. */
export const VIDEO_FOLDERS = [...VIDEO_SETS, ...LEGACY_VIDEO_SETS] as const;
export type VideoFolder = VideoSet | LegacyVideoSet;

/** Real .mp4 file names present on disk, per folder. Listed at runtime by the
 *  main process (IPC VideosList) so newly-added videos are picked up without a
 *  rebuild — there is no build-time file manifest. */
export type VideoFilesBySet = Record<VideoFolder, string[]>;

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
  /**
   * The ONE video set this entry belongs to, when the source says so.
   *
   * The API never does — its `videoFileName` carries a folder prefix that
   * `extractStem` throws away, because a kiosk only ever fetches its own
   * `/subtitles` and every row in that response is by definition its own.
   * The 제주 sheet is the exception: VideoSubtitle_귤이 is ONE tab serving three
   * venues, and its `비디오 폴더명 (운영)` column is where an operator says a row
   * is airport-only or terminal-only. Left undefined the entry is offered to
   * whichever 제주 venue is running and kept only if the video file is actually
   * on that machine — the same file-existence filter every other kiosk uses.
   */
  set?: VideoSet;
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
