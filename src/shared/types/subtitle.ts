/** Shared subtitle types used by both main-process SubtitleService and renderer. */

/** Which bundled video set a kiosk plays from (resources/videos/<set>/). */
export type VideoSet = 'insadong' | 'osaek' | 'hwaseong';

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

function apiLang(obj: ApiLangText): SubtitleLangText {
  // API language keys → app language codes. The kiosk supports 8 UI languages;
  // the API delivers all of them, so map every one (was previously 4, which
  // silently dropped vi/th/ru/id and made those languages fall back to Korean).
  return {
    ko: obj.kr ?? '',
    en: obj.en ?? '',
    ja: obj.jp ?? '',
    zh: obj.cn ?? '',
    vi: obj.vn ?? '',
    th: obj.th ?? '',
    ru: obj.ru ?? '',
    id: obj.id ?? '',
  };
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
  const push = (s: ApiSubtitleItem): void => {
    if (!s.video?.videoFileName) return;
    entries.push({
      key: s.playKey,
      file: extractStem(s.video.videoFileName),
      subtitle: apiLang(s.main),
      label: apiLang(s.rightTop),
    });
  };

  for (const button of res.data.buttons) {
    for (const s of button.subtitles) push(s);
  }
  for (const s of res.data.autoSubtitles) push(s);

  return entries;
}
