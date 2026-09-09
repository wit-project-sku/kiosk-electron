import type { Lang } from '@renderer/lib/i18n';
import { changeLanguagePlayKey } from '@shared/config/languages';
import { getKioskLocation, isJejuLayout } from '@shared/config/kioskLocations';
import type { KioskId, KioskLayoutId } from '@shared/types/kiosk';
import { pickText } from '@renderer/data/types';
import { VIDEO_SETS, type VideoEntry, type VideoFilesBySet, type VideoSet } from '@shared/types/subtitle';
import { VIDEO_SUBTITLES_JEJU } from '@renderer/data/videoSubtitles-jeju.generated';

/**
 * Resolves the AI-model display videos for each kiosk screen, from that
 * location's VideoSubtitle tab (Insa / Osaek / Hwaseong / 제주's VideoSubtitle_귤이).
 * The customer display plays the clip(s) for the current screen (looping
 * forever); `Default` is the idle/attract sequence.
 *
 * Everything per-location is keyed off three tables — {@link VIDEO_SET_BY_LAYOUT}
 * (+ its {@link VIDEO_SET_BY_KIOSK} exceptions) and {@link SCREEN_KEYS_BY_LAYOUT} —
 * so adding a location is a couple of entries, not a new branch in every lookup.
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
const emptyBySet = <T,>(make: () => T): Record<VideoSet, T> =>
  Object.fromEntries(VIDEO_SETS.map((s) => [s, make()])) as Record<VideoSet, T>;

const FILES_BY_SET: VideoFilesBySet = emptyBySet<string[]>(() => []);
const FILE_BY_NORM: Record<VideoSet, Map<string, string>> = emptyBySet(() => new Map());

/**
 * Load the real on-disk video file names (from IPC VideosList) so subtitle
 * entries and the attract wall resolve against files that actually exist right
 * now. Idempotent; call again to refresh after a sync.
 */
export function initVideoFiles(bySet: VideoFilesBySet): void {
  for (const set of VIDEO_SETS) {
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

// Mutable maps, one per video set — populated by initSubtitles() when the API
// responds. The API (via SQLite offline cache) is the source of truth for
// subtitles wherever it HAS them. 제주 (W006–W008) is the one place it does not:
// /api/kiosks/{6,7,8}/subtitles answer with 21 buttons and zero subtitle rows,
// so those kiosks read the build-time table generated from VideoSubtitle_귤이
// instead (see bundledSubtitles below). Empty until whichever source applies has
// loaded, so a never-synced non-제주 kiosk with no network shows no clips until
// it reaches the API once.
let BY_KEY: Record<VideoSet, Map<string, VideoEntry[]>> = emptyBySet(() => new Map());

// Same entries indexed by owning `buttons.id` — lets a top-level home tile resolve
// its clip straight from its DB id (API-driven) instead of a hardcoded
// screen→playKey guess. Only entries from `data.buttons[]` have a buttonId;
// autoSubtitles (Default idle, weather) have none and live only in BY_KEY.
let BY_BUTTON: Record<VideoSet, Map<number, VideoEntry[]>> = emptyBySet(() => new Map());

/** Each layout's video set. Locations sharing a design share a set (W001–W003). */
const VIDEO_SET_BY_LAYOUT: Record<KioskLayoutId, VideoSet> = {
  INSADONG: 'insadong',
  NAM_INSADONG: 'insadong',
  OSAN: 'osaek',
  HWASEONG: 'hwaseong',
  JEJU_AIRPORT: 'jeju-airport',
  JEJU_HERITAGE: 'jeju-heritage',
  // KADA W202 gets its OWN set rather than borrowing insadong's, even though
  // resources/videos/kada/ does not exist yet. Pointing it at 'insadong' would
  // put 인사동 AI-model clips and Korean subtitles on Monitor 2 in Hanoi; an
  // empty set resolves no clips, so the customer display stays on its attract
  // slideshow until KADA footage is dropped into that folder.
  KADA: 'kada',
};

/**
 * Per-KIOSK overrides, consulted before the layout table.
 *
 * Layout is the right granularity everywhere except 제주: W006 제주공항 and W007
 * 제주국제여객터미널 deliberately share the JEJU_AIRPORT layout (one design, one
 * sheet, one mascot) but must NOT share footage — the airport reels are about
 * 항공편/탑승구 and the terminal's about 여객선/뱃길. So the venue that diverges
 * from its layout's default is named here rather than being given a layout id
 * it does not need.
 */
const VIDEO_SET_BY_KIOSK: Partial<Record<KioskId, VideoSet>> = {
  W007: 'jeju-terminal',
};

/** Which video set a kiosk's own subtitle entries belong to — the caller
 *  already knows this (it fetched `/api/kiosks/{thisKiosk}/subtitles`), so
 *  entries are assigned directly instead of guessed from the file name. */
export function videoSetFor(kioskId?: KioskId): VideoSet {
  if (kioskId == null) return 'insadong';
  return VIDEO_SET_BY_KIOSK[kioskId] ?? VIDEO_SET_BY_LAYOUT[getKioskLocation(kioskId).layout];
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
  const dropped: string[] = [];

  for (const e of entries) {
    // Sheet-sourced entries may name the ONE set they belong to (VideoSubtitle_귤이's
    // `비디오 폴더명` column — one tab, three 제주 venues). Silently skip another
    // venue's row: it is not a misconfiguration, so it must not warn.
    if (e.set && e.set !== set) continue;
    if (FILE_BY_NORM[set].has(norm(e.file))) matched.push(e);
    else dropped.push(`${e.key}=${e.file}`);
  }

  // Entries whose video file stem matches no local file are dropped, but listed
  // so a bad admin edit / a clip that never made it onto this machine is visible
  // instead of the subtitle just silently never appearing.
  //
  // ONE grouped warning, not one per entry: 제주 kiosks are handed the whole
  // VideoSubtitle_귤이 table (78 rows for all three venues) and load their
  // footage folder by folder, so a machine mid-rollout would otherwise open with
  // seventy near-identical console lines and bury everything else.
  if (dropped.length > 0) {
    console.warn(
      `[videoMap] ${dropped.length}/${entries.length} subtitles dropped — no local video in "${set}"`,
      dropped,
    );
  }

  if (matched.length === 0) return;
  // Replace only this set's maps (the call is idempotent per set).
  BY_KEY = { ...BY_KEY, [set]: buildByKey(matched) };
  BY_BUTTON = { ...BY_BUTTON, [set]: buildByButton(matched) };
}

/**
 * The build-time subtitle table for `kioskId`, or `[]` when that kiosk has none.
 *
 * A LAST RESORT, used only when `/api/kiosks/{n}/subtitles` came back with no
 * rows — the caller checks, this does not. Only 제주 has one: W006–W008 are the
 * kiosks whose CMS carries buttons but no clips, so without it their second
 * monitor plays nothing on any screen. Every other location's API answers with
 * its full VideoSubtitle tab, and giving them a stale bundled copy to fall back
 * on would hide a broken sync instead of showing it.
 */
export function bundledSubtitles(kioskId?: KioskId): VideoEntry[] {
  if (kioskId == null) return [];
  return isJejuLayout(getKioskLocation(kioskId).layout) ? VIDEO_SUBTITLES_JEJU : [];
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
 * 제주 (W006 공항 / W007 여객터미널 / W008 세계자연유산본부) screen→key mapping,
 * transcribed from VideoSubtitle_귤이's `Key (개발)` + `재생조건(Condition)` columns.
 *
 * `inherit: false`, like Hwaseong: the 제주 home grid is its own (렌트카 · 탐나오 ·
 * 지역화폐 · 크루즈 운항 · 운항정보 have no Insadong equivalent, and 미술관/고궁/
 * 교통안내 have no 제주 one), so falling through to the Insadong names would map
 * screens this venue does not have and miss the ones it does.
 *
 * The sheet's `-N` suffixes are the CLIP INDEX within one key, not distinct
 * keys — `Default-1`…`Default-10` is the ten-clip 기본화면 rotation — so the
 * generator strips them (see scripts/sync-sheet.mjs JEJU_KEY_ALIASES) and the
 * names below are the stripped forms.
 *
 * Deliberately absent, because no 제주 screen reports them: `Search_Enter`
 * (검색어 입력 후 엔터 — JejuSearch has no result sub-state); `Photo` /
 * `Photo_SelectHanbok` / `Photo_Complete` (the whole AR flow reports one `photo`
 * screen, and the display asks for it while COMPOSITING — hence Photo_Creating
 * below, the same choice every other layout makes); and `Donation_Category` /
 * `Donation_Detail` (기부 is a fullscreen webview, and its three sheet rows all
 * carry the same `기본화면 -> 기부 (기본 3편 순환)` condition, so `Donation` alone
 * covers the screen). Those rows still generate — they simply never resolve,
 * exactly like any other kiosk's unreachable sheet row.
 */
const JEJU_SCREEN_TO_VIDEO_KEY: Record<string, string> = {
  home:             'Default',
  search:           'Search',
  search_detail:    'Search_Detail',
  detail:           'Default',      // generic detail — context comes from `<from>_detail`
  language:         'Default',      // overridden per-lang in screenKey()

  ai_search:        'AISearch',
  ai_result:        'AISearch_Category',
  ai_detail:        'AISearch_Detail',

  events:           'Event',
  events_category:  'Event_Category',

  eat:              'ToEat',
  eat_category:     'ToEat_Category',
  eat_detail:       'ToEat_Detail',
  shop:             'ToBuy',
  shop_category:    'ToBuy_Category',
  shop_detail:      'ToBuy_Detail',
  lodging:          'ToStay',
  lodging_category: 'ToStay_Category',
  lodging_detail:   'ToStay_Detail',

  taxfree:          'TaxFree',
  about:            'Here',
  exchange:         'Exchange',
  restroom:         'Toilet',
  donation:         'Donation',
  // 위드마켓 and K-DRAMA are wired but silent: their sheet rows carry no file
  // name yet, so the generator skips them and these resolve to the Default idle
  // sequence. Filling `파일명` in VideoSubtitle_귤이 is all it takes — no code change.
  market:           'Market',
  kdrama:           'KDrama',

  hello:            'Greeting',
  hello_hobby:      'Greeting_Hobby',
  hello_stretch:    'Greeting_Stretching',
  help:             'ToHelp',
  help_category:    'ToHelp_Category',
  help_detail:      'ToHelp_Detail',

  // 제주-only home tiles.
  rentcar:          'RentCar',
  tamnao:           'Tamnao',
  localpay:         'MarketPaper',
  // 운항정보 — the airport board is 항공편, the terminal's is 여객선. Both venues
  // reach the same `flights` / `cruise` screens, and each machine only has its
  // own clips on disk, so the unmatched key simply resolves to nothing there.
  flights:          'FlightInfo',
  cruise:           'FerryInfo',

  photo:            'Photo_Creating',
  hanbok_explain:   'HanbokExplain',
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

/**
 * Per-layout screen→playKey resolution.
 *
 * `map` is consulted first; `inherit: true` means "fall through to the base
 * Insadong map when this layout has no entry" (Osan overrides only a handful of
 * screens), while `inherit: false` means the layout's map is the WHOLE story and
 * anything unlisted goes to Default (Hwaseong's grid diverges too far to inherit).
 */
interface LayoutScreenKeys {
  map: Record<string, string>;
  inherit: boolean;
}

const SCREEN_KEYS_BY_LAYOUT: Record<KioskLayoutId, LayoutScreenKeys> = {
  INSADONG: { map: {}, inherit: true },
  NAM_INSADONG: { map: {}, inherit: true },
  OSAN: { map: OSAN_SCREEN_TO_VIDEO_KEY, inherit: true },
  HWASEONG: { map: HWASEONG_SCREEN_TO_VIDEO_KEY, inherit: false },
  // Both 제주 layouts read the SAME map: VideoSubtitle_귤이 is one tab for all
  // three venues, and the grid differences between them (렌트카 vs 크루즈 운항,
  // W008's 제주세계유산 trio) are extra screens, not different keys for the same
  // screen. What differs per venue is the video SET, above.
  JEJU_AIRPORT: { map: JEJU_SCREEN_TO_VIDEO_KEY, inherit: false },
  JEJU_HERITAGE: { map: JEJU_SCREEN_TO_VIDEO_KEY, inherit: false },
  // KADA has five screens and no video set, so there is nothing to map and
  // nothing worth inheriting — Insadong's screen names do not exist here.
  KADA: { map: {}, inherit: false },
};

// Every kiosk carries a dedicated ChangeLanguage_* clip per UI language (all 8),
// so the language screen is resolved from `lang` directly instead of a static
// map entry — this applies uniformly to all kiosks.
function screenKey(screen: string, lang: Lang, layout: KioskLayoutId): string {
  if (screen === 'language') return changeLanguagePlayKey(lang);
  const { map, inherit } = SCREEN_KEYS_BY_LAYOUT[layout];
  const own = map[screen];
  if (own) return own;
  return (inherit ? SCREEN_TO_VIDEO_KEY[screen] : undefined) ?? 'Default';
}

function layoutOf(kioskId?: KioskId): KioskLayoutId {
  return kioskId == null ? 'INSADONG' : getKioskLocation(kioskId).layout;
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
  const entries = BY_BUTTON[set].get(buttonId);
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
  const byKey = BY_KEY[set];

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

  const key = screenKey(screen, lang, layoutOf(kioskId));
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
  return clipsForKey(BY_KEY[set], key, lang, set);
}

/** The idle/attract sequence (Default). */
export function idleClips(lang: Lang, kioskId?: KioskId): DisplayClip[] {
  const set = videoSetFor(kioskId);
  return clipsForKey(BY_KEY[set], 'Default', lang, set);
}
