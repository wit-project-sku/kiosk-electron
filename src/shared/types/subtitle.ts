/** Shared subtitle types used by both main-process SubtitleService and renderer. */

export interface SubtitleLangText {
  ko: string;
  en: string;
  ja: string;
  zh: string;
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
  return {
    ko: obj.kr ?? '',
    en: obj.en ?? '',
    ja: obj.jp ?? '',
    zh: obj.cn ?? '',
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
