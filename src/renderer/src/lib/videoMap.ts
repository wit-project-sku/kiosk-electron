import type { Lang } from '@renderer/lib/i18n';
import { VIDEO_SUBTITLES, type VideoEntry } from '@renderer/data/videoSubtitles.generated';
import { VIDEO_SUBTITLES_OSAEK } from '@renderer/data/videoSubtitles-osaek.generated';
import { VIDEO_FILES_INSADONG, VIDEO_FILES_OSAEK } from '@renderer/assets/videos/manifest';
import { getKioskLocation } from '@shared/config/kioskLocations';
import type { KioskId } from '@shared/types/kiosk';
import { pickText } from '@renderer/data/types';

/**
 * Resolves the AI-model display videos for each kiosk screen, from
 * VideoSubtitle_Insa (default) or VideoSubtitle_Osaek (W004 / OSAN layout). The
 * customer display plays the clip(s) for the current screen (looping forever);
 * `Default` is the idle/attract sequence.
 */

export interface DisplayClip {
  url: string;
  subtitle: string;
  label: string;
}

/** Video set (subfolder under resources/videos) chosen per kiosk at runtime. */
type VideoSet = 'insadong' | 'osaek';

/** Normalize a file stem so sheet names tolerant-match the real files. */
const norm = (s: string): string => s.toLowerCase().replace(/\.mp4$/, '').replace(/[^a-z0-9]/g, '');
const FILE_BY_NORM: Record<VideoSet, Map<string, string>> = {
  insadong: new Map(VIDEO_FILES_INSADONG.map((f) => [norm(f), f])),
  osaek: new Map(VIDEO_FILES_OSAEK.map((f) => [norm(f), f])),
};

/** Resolve a sheet file stem to a media:// URL within the kiosk's video set. */
function resolveUrl(stem: string, set: VideoSet): string | null {
  const file = FILE_BY_NORM[set].get(norm(stem));
  return file ? `media://video/${set}/${encodeURIComponent(file)}` : null;
}

function buildByKey(entries: VideoEntry[]): Map<string, VideoEntry[]> {
  const m = new Map<string, VideoEntry[]>();
  for (const e of entries) {
    const list = m.get(e.key) ?? [];
    list.push(e);
    m.set(e.key, list);
  }
  return m;
}
const BY_KEY_INSA = buildByKey(VIDEO_SUBTITLES);
const BY_KEY_OSAEK = buildByKey(VIDEO_SUBTITLES_OSAEK);

function isOsan(kioskId?: KioskId): boolean {
  return kioskId != null && getKioskLocation(kioskId).layout === 'OSAN';
}

function clipsForKey(
  byKey: Map<string, VideoEntry[]>,
  key: string,
  lang: Lang,
  set: VideoSet,
): DisplayClip[] {
  const clips: DisplayClip[] = [];
  for (const e of byKey.get(key) ?? []) {
    const url = resolveUrl(e.file, set);
    if (url) clips.push({ url, subtitle: pickText(e.subtitle, lang), label: pickText(e.label, lang) });
  }
  return clips;
}

/** Kiosk screen id → VideoSubtitle key. */
const SCREEN_TO_VIDEO_KEY: Record<string, string> = {
  home: 'Default',
  ai_search: 'AISearch',
  ai_result: 'AISearch_Category',
  ai_detail: 'AISearch_Detail',
  events: 'Event',
  eat: 'ToEat',
  shop: 'ToBuy',
  museum: 'ToGallery',
  taxfree: 'TaxFree',
  about: 'Here',
  hello: 'Greeting',
  help: 'ToHelp',
  map: 'Map',
  exchange: 'Exchange',
  transport: 'Transport',
  lodging: 'ToStay',
  palace: 'Palace',
  restroom: 'Toilet',
  search: 'Search',
  detail: 'Default',
  language: 'Default',
  photo: 'Photo_Creating',

  // Per-source detail pages (reported by InsadongDetail as `<from>_detail`).
  eat_detail: 'ToEat_Detail',
  shop_detail: 'ToBuy_Detail',
  museum_detail: 'ToGallery_Detail',
  lodging_detail: 'ToStay_Detail',
  help_detail: 'ToHelp_Detail',
  palace_detail: 'Palace_Detail',
  search_detail: 'Search_Detail',
  ai_result_detail: 'AISearch_Detail',

  // Photo sub-pages reported by HanbokSelect.
  hanbok_explain: 'HanbokExplain',

  // Greeting (안녕 인사) tabs reported by InsadongHello.
  hello_hobby: 'Greeting_Hobby',
  hello_stretch: 'Greeting_Stretching',
};

/**
 * Osan (W004) screen→key overrides — the home grid reorders several screens, so
 * a few resolve to different VideoSubtitle_Osaek keys than Insadong:
 *  - museum = 지역화폐 (시장화폐) → MarketPaper (not the gallery)
 *  - lodging = 뭐사지(물품) → ToBuy (same family as 식품), incl. its detail page.
 * kdrama/palace have no Osaek clip → fall back to Default.
 */
const OSAN_SCREEN_TO_VIDEO_KEY: Record<string, string> = {
  museum: 'MarketPaper',
  lodging: 'ToBuy',
  lodging_detail: 'ToBuy_Detail',
};

function screenKey(screen: string, osan: boolean): string {
  const override = osan ? OSAN_SCREEN_TO_VIDEO_KEY[screen] : undefined;
  return override ?? SCREEN_TO_VIDEO_KEY[screen] ?? 'Default';
}

/** Ordered clips for a screen, falling back to the Default idle sequence. */
export function clipsForScreen(screen: string, lang: Lang, kioskId?: KioskId): DisplayClip[] {
  const osan = isOsan(kioskId);
  const set: VideoSet = osan ? 'osaek' : 'insadong';
  const byKey = osan ? BY_KEY_OSAEK : BY_KEY_INSA;
  const clips = clipsForKey(byKey, screenKey(screen, osan), lang, set);
  return clips.length > 0 ? clips : clipsForKey(byKey, 'Default', lang, set);
}

/** The idle/attract sequence (Default). */
export function idleClips(lang: Lang, kioskId?: KioskId): DisplayClip[] {
  const osan = isOsan(kioskId);
  return clipsForKey(osan ? BY_KEY_OSAEK : BY_KEY_INSA, 'Default', lang, osan ? 'osaek' : 'insadong');
}
