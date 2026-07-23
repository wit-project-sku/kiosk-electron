import type { Lang } from '@renderer/lib/i18n';
import { changeLanguagePlayKey } from '@shared/config/languages';
import { getKioskLocation } from '@shared/config/kioskLocations';
import type { KioskId } from '@shared/types/kiosk';
import { pickText } from '@renderer/data/types';
import type { VideoEntry, VideoFilesBySet, VideoSet } from '@shared/types/subtitle';

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

/** Normalize a file stem so API names tolerant-match the real files. */
const norm = (s: string): string => s.toLowerCase().replace(/\.mp4$/, '').replace(/[^a-z0-9]/g, '');

// The real .mp4 files on disk, per set — the SINGLE source of truth for which
// videos exist. Populated by initVideoFiles() from the main process's live
// directory listing (IPC VideosList); empty until then. No build-time manifest,
// so adding a video file makes it resolvable without a rebuild.
const FILES_BY_SET: VideoFilesBySet = { insadong: [], osaek: [], hwaseong: [] };
const FILE_BY_NORM: Record<VideoSet, Map<string, string>> = {
  insadong: new Map(),
  osaek: new Map(),
  hwaseong: new Map(),
};

/**
 * Load the real on-disk video file names (from IPC VideosList) so subtitle
 * entries and the attract wall resolve against files that actually exist right
 * now. Idempotent; call again to refresh after a sync.
 */
export function initVideoFiles(bySet: VideoFilesBySet): void {
  for (const set of ['insadong', 'osaek', 'hwaseong'] as VideoSet[]) {
    const files = bySet[set] ?? [];
    FILES_BY_SET[set] = files;
    FILE_BY_NORM[set] = new Map(files.map((f) => [norm(f), f]));
  }
}

/** Real file names for a set (for the generic attract wall). */
export function filesForSet(set: VideoSet): string[] {
  return FILES_BY_SET[set];
}

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

/** Group entries by their owning `buttons.id` (skips autoSubtitles, which have
 *  no buttonId). Built from the same file-filtered list as buildByKey. */
function buildByButton(entries: VideoEntry[]): Map<number, VideoEntry[]> {
  const m = new Map<number, VideoEntry[]>();
  for (const e of entries) {
    if (e.buttonId == null) continue;
    const list = m.get(e.buttonId) ?? [];
    list.push(e);
    m.set(e.buttonId, list);
  }
  return m;
}

// Mutable maps — populated by initSubtitles() when the API responds. The API
// (via SQLite offline cache) is the single source of truth for subtitles; there
// is no build-time sheet fallback. Empty until the first successful fetch, so a
// never-synced kiosk with no network shows no clips until it reaches the API once.
let BY_KEY_INSA = new Map<string, VideoEntry[]>();
let BY_KEY_OSAEK = new Map<string, VideoEntry[]>();
let BY_KEY_HWASEONG = new Map<string, VideoEntry[]>();

// Same entries indexed by owning `buttons.id` — lets a top-level home tile resolve
// its clip straight from its DB id (API-driven) instead of a hardcoded
// screen→playKey guess. Only entries from `data.buttons[]` have a buttonId;
// autoSubtitles (Default idle, weather) have none and live only in BY_KEY.
let BY_BUTTON_INSA = new Map<number, VideoEntry[]>();
let BY_BUTTON_OSAEK = new Map<number, VideoEntry[]>();
let BY_BUTTON_HWASEONG = new Map<number, VideoEntry[]>();

/** Which video set a kiosk's own subtitle entries belong to — the caller
 *  already knows this (it fetched `/api/kiosks/{thisKiosk}/subtitles`), so
 *  entries are assigned directly instead of guessed from the file name. */
function videoSetFor(kioskId?: KioskId): VideoSet {
  if (isHwaseong(kioskId)) return 'hwaseong';
  if (isOsan(kioskId)) return 'osaek';
  return 'insadong';
}

/**
 * Load API-sourced subtitle entries into the active map for `kioskId`'s own
 * video set. Called once after the renderer fetches SubtitlesGet — the
 * response is always THIS kiosk's own data, so every entry is assigned to
 * `kioskId`'s set directly (not guessed by matching the file name against all
 * three manifests: several video files are bundled identically across sets,
 * e.g. every Osaek file also exists in the Insadong manifest, which used to
 * make Osaek's entries misclassify as Insadong's and never actually apply).
 * Only entries whose video file stem resolves to a known local file are kept.
 * The call is idempotent; calling it again replaces that one map.
 */
export function initSubtitles(entries: VideoEntry[], kioskId?: KioskId): void {
  const set = videoSetFor(kioskId);
  const matched: VideoEntry[] = [];

  for (const e of entries) {
    if (FILE_BY_NORM[set].has(norm(e.file))) matched.push(e);
    // Entry's video file stem matches no bundled local file — drop it, but
    // log so a bad admin edit / unbundled video is visible instead of the
    // subtitle just silently never appearing.
    else console.warn('[videoMap] subtitle dropped — no local video match', { key: e.key, file: e.file, set });
  }

  if (matched.length === 0) return;
  if (set === 'insadong') {
    BY_KEY_INSA = buildByKey(matched);
    BY_BUTTON_INSA = buildByButton(matched);
  } else if (set === 'osaek') {
    BY_KEY_OSAEK = buildByKey(matched);
    BY_BUTTON_OSAEK = buildByButton(matched);
  } else {
    BY_KEY_HWASEONG = buildByKey(matched);
    BY_BUTTON_HWASEONG = buildByButton(matched);
  }
}

function isOsan(kioskId?: KioskId): boolean {
  return kioskId != null && getKioskLocation(kioskId).layout === 'OSAN';
}

function isHwaseong(kioskId?: KioskId): boolean {
  return kioskId != null && getKioskLocation(kioskId).layout === 'HWASEONG';
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
  // Language screen is handled separately in clipsForScreen using the `lang`
  // param to pick ChangeLanguage_KR/EN/JP/CH — no static entry here.
  photo: 'Photo_Creating',

  // Category sub-state (broadcast by list screens when a category tab is active).
  eat_category: 'ToEat_Category',
  shop_category: 'ToBuy_Category',
  museum_category: 'ToGallery_Category',
  lodging_category: 'ToStay_Category',
  help_category: 'ToHelp_Category',
  events_category: 'ToEvent_Category',
  transport_category: 'Transport_Category',

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
 * Hwaseong (W005) screen→key mapping. Language screen is handled separately
 * in clipsForScreen using the `lang` param to pick ChangeLanguage_KR/EN/JP/CH.
 */
const HWASEONG_SCREEN_TO_VIDEO_KEY: Record<string, string> = {
  home:        'Default',
  search:      'Search',
  detail:      'Default',     // generic detail — can't distinguish context at screen level
  language:    'Default',     // overridden per-lang below
  restroom:    'Toilet',
  transport:   'TrafficInfo',
  market:              'Default',     // 전국시장 — no dedicated key in sheet
  market_detail:       'Default',
  events:              'Event',
  food_court:          'ToEat',
  food_court_category: 'ToEat_Category',
  food_court_detail:   'ToEat_Detail',
  shop:                'ToBuy',
  shop_category:       'ToBuy_Category',
  shop_detail:         'ToBuy_Detail',
  convenience:         'RestArea',
  convenience_category:'RestArea_Category',
  convenience_detail:  'RestArea_Detail',
  taxfree:             'TaxFree',
  tourism:             'Here',
  hello:               'Greeting',
  help:                'ToHelp',
  help_category:       'ToHelp_Category',
  help_detail:         'ToHelp_Detail',
  parking:             'SAMap',
  exchange:            'Exchange',
  rest_info:           'Default',
  photo:               'Photo_Creating',
  hanbok_explain:      'HanbokExplain',
  search_detail:       'Search_Detail',
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
  lodging_category: 'ToBuy_Category',
  lodging_detail: 'ToBuy_Detail',
};

// Every kiosk carries a dedicated ChangeLanguage_* clip per UI language (all 8),
// so the language screen is resolved from `lang` directly instead of a static
// map entry — this applies uniformly to all kiosks, not just Hwaseong.
function screenKey(screen: string, lang: Lang, osan: boolean): string {
  if (screen === 'language') return changeLanguagePlayKey(lang);
  const override = osan ? OSAN_SCREEN_TO_VIDEO_KEY[screen] : undefined;
  return override ?? SCREEN_TO_VIDEO_KEY[screen] ?? 'Default';
}

function hwaseongScreenKey(screen: string, lang: Lang): string {
  if (screen === 'language') return changeLanguagePlayKey(lang);
  return HWASEONG_SCREEN_TO_VIDEO_KEY[screen] ?? 'Default';
}

function byButtonFor(set: VideoSet): Map<number, VideoEntry[]> {
  return set === 'hwaseong' ? BY_BUTTON_HWASEONG : set === 'osaek' ? BY_BUTTON_OSAEK : BY_BUTTON_INSA;
}

/**
 * The base (top-level) playKey among one button's subtitles — the clip shown when
 * the button is tapped from home. A button also carries its deeper drill-in clips,
 * which extend the base playKey with a suffix (`Search` → `Search_Enter`/
 * `Search_Detail`, `ToEat` → `ToEat_Category`/`_Detail`). The base is therefore
 * the SHORTEST playKey. `sortOrder` cannot be used to tell them apart — the live
 * API returns `0` for every row (verified against W005's /subtitles response).
 */
function basePlayKeyOf(entries: VideoEntry[]): string {
  return entries.reduce((best, e) => (e.key.length < best.key.length ? e : best)).key;
}

/**
 * Ordered clips for a home button's PRIMARY (top-level) video, resolved straight
 * from its DB `buttons.id` via the API association — no screen→playKey guess.
 * Picks the button's base clip (see basePlayKeyOf) and returns every entry sharing
 * that key (ordered by sortOrder, for the rare multi-clip base). Empty when the
 * button has no subtitles (e.g. 홈/날씨/사진 on W005) or none is bundled locally,
 * so callers fall back to the legacy screen map / Default idle.
 */
function clipsForButton(buttonId: number, lang: Lang, set: VideoSet): DisplayClip[] {
  const entries = byButtonFor(set).get(buttonId);
  if (!entries || entries.length === 0) return [];
  const basePlayKey = basePlayKeyOf(entries);
  const sortOf = (e: VideoEntry): number => e.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const clips: DisplayClip[] = [];
  for (const e of entries.filter((e) => e.key === basePlayKey).sort((a, b) => sortOf(a) - sortOf(b))) {
    const url = resolveUrl(e.file, set);
    if (url) clips.push({ url, subtitle: pickText(e.subtitle, lang), label: pickText(e.label, lang) });
  }
  return clips;
}

/**
 * Ordered clips for a screen, falling back to the Default idle sequence.
 *
 * Resolution order:
 *  1. Language screen → the per-language ChangeLanguage_* clip.
 *  2. A top-level home button (buttonId supplied by navigate()) → that button's
 *     API-associated clip, resolved by DB id — the authoritative, no-guess path.
 *  3. Legacy screen→playKey map (sub-states like `eat_category`, and any button
 *     the API has no clip association for) — a safety net so nothing regresses.
 *  4. Default idle sequence.
 */
export function clipsForScreen(
  screen: string,
  lang: Lang,
  kioskId?: KioskId,
  buttonId?: number | null,
): DisplayClip[] {
  const set = videoSetFor(kioskId);
  const byKey = set === 'hwaseong' ? BY_KEY_HWASEONG : set === 'osaek' ? BY_KEY_OSAEK : BY_KEY_INSA;

  if (screen === 'language') {
    const clips = clipsForKey(byKey, changeLanguagePlayKey(lang), lang, set);
    return clips.length > 0 ? clips : clipsForKey(byKey, 'Default', lang, set);
  }

  // Top-level home button → resolve its clip by DB id (API-driven). Sub-state
  // screens (category/detail/hello tabs) carry no buttonId, so they skip this.
  if (buttonId != null) {
    const byId = clipsForButton(buttonId, lang, set);
    if (byId.length > 0) return byId;
    // else fall through: this button has no API-associated clip → legacy map.
  }

  const key = isHwaseong(kioskId)
    ? hwaseongScreenKey(screen, lang)
    : screenKey(screen, lang, isOsan(kioskId));
  const clips = clipsForKey(byKey, key, lang, set);
  return clips.length > 0 ? clips : clipsForKey(byKey, 'Default', lang, set);
}

/**
 * Ordered clips for an explicit subtitles playKey (e.g. `Weather_Rain`),
 * resolved in this kiosk's own video set. Unlike clipsForScreen there is NO
 * Default fallback: a caller asking for a specific clip wants that clip or
 * nothing. Empty when the key has no API entry, or when its video file isn't
 * bundled on this machine (initSubtitles drops those) — callers keep playing
 * whatever they had instead of cutting to an unrelated video.
 */
export function clipsForPlayKey(key: string, lang: Lang, kioskId?: KioskId): DisplayClip[] {
  const set = videoSetFor(kioskId);
  const byKey =
    set === 'hwaseong' ? BY_KEY_HWASEONG : set === 'osaek' ? BY_KEY_OSAEK : BY_KEY_INSA;
  return clipsForKey(byKey, key, lang, set);
}

/** The idle/attract sequence (Default). */
export function idleClips(lang: Lang, kioskId?: KioskId): DisplayClip[] {
  if (isHwaseong(kioskId)) {
    return clipsForKey(BY_KEY_HWASEONG, 'Default', lang, 'hwaseong');
  }
  const osan = isOsan(kioskId);
  return clipsForKey(osan ? BY_KEY_OSAEK : BY_KEY_INSA, 'Default', lang, osan ? 'osaek' : 'insadong');
}
