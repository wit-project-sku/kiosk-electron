import type { Lang } from '@renderer/lib/i18n';
import { changeLanguagePlayKey } from '@shared/config/languages';
import { getKioskLocation, isJejuLayout } from '@shared/config/kioskLocations';
import type { KioskId, KioskLayoutId } from '@shared/types/kiosk';
import { pickText } from '@renderer/data/types';
import { LEGACY_VIDEO_SETS, VIDEO_SETS, type VideoEntry, type VideoFilesBySet, type VideoSet } from '@shared/types/subtitle';

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

/**
 * One real file, and the folder it actually lives in.
 *
 * The two can differ: a 제주 set inherits the pre-split shared `jeju` folder, so
 * a clip belonging to `jeju-airport` may still be sitting under `jeju/`. The
 * `media://` URL has to name the folder the bytes are in, not the set that
 * claims them, or it 404s.
 */
interface VideoFile {
  folder: string;
  name: string;
}

const FILES_BY_SET: Record<VideoSet, VideoFile[]> = emptyBySet<VideoFile[]>(() => []);
const FILE_BY_NORM: Record<VideoSet, Map<string, VideoFile>> = emptyBySet(() => new Map());

/** The sets that inherit the pre-split shared 제주 folder (see LEGACY_VIDEO_SETS). */
const JEJU_SETS: readonly VideoSet[] = ['jeju-airport', 'jeju-terminal', 'jeju-heritage'];

const mediaUrl = (f: VideoFile): string => `media://video/${f.folder}/${encodeURIComponent(f.name)}`;

/**
 * Load the real on-disk video file names (from IPC VideosList) so subtitle
 * entries and the attract wall resolve against files that actually exist right
 * now. Idempotent; call again to refresh after a sync.
 *
 * A 제주 set is its OWN folder plus whatever is still sitting in the pre-split
 * shared `jeju` folder. Own files win on a name clash, so populating
 * `jeju-airport` progressively shadows the shared copies one clip at a time
 * rather than requiring the whole folder to be moved in one go.
 */
export function initVideoFiles(bySet: VideoFilesBySet): void {
  const legacy = LEGACY_VIDEO_SETS.flatMap((folder) =>
    (bySet[folder] ?? []).map((name) => ({ folder, name })),
  );
  for (const set of VIDEO_SETS) {
    const own: VideoFile[] = (bySet[set] ?? []).map((name) => ({ folder: set, name }));
    const inherited = JEJU_SETS.includes(set)
      ? legacy.filter((f) => !own.some((o) => norm(o.name) === norm(f.name)))
      : [];
    FILES_BY_SET[set] = [...own, ...inherited];
    FILE_BY_NORM[set] = new Map(FILES_BY_SET[set].map((f) => [norm(f.name), f]));
  }
}

/** Every playable video URL in a set, in listing order (generic attract wall). */
export function videoUrlsForSet(set: VideoSet): string[] {
  return FILES_BY_SET[set].map(mediaUrl);
}

/** Resolve a sheet file stem to a media:// URL within the kiosk's video set. */
function resolveUrl(stem: string, set: VideoSet): string | null {
  const file = FILE_BY_NORM[set].get(norm(stem));
  return file ? mediaUrl(file) : null;
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
// responds. The API (via its SQLite offline cache) is the ONLY source of
// subtitle data — there is no bundled sheet fallback. Empty until it has
// loaded, so a never-synced kiosk with no network shows no clips (the generic
// attract wall) until it reaches the API once. 제주 (W006–W008) is currently in
// that state in production: /api/kiosks/{6,7,8}/subtitles answers with 21
// buttons and zero subtitle rows until the CMS rollout lands.
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
    // An entry may name the ONE set it belongs to (older SQLite-cached rows
    // from the retired sheet table carried this; the API itself never does).
    // Silently skip another venue's row: not a misconfiguration, so no warn.
    if (e.set && e.set !== set) continue;
    if (FILE_BY_NORM[set].has(norm(e.file))) matched.push(e);
    else dropped.push(`${e.key}=${e.file}`);
  }

  // Entries whose video file stem matches no local file are dropped, but listed
  // so a bad admin edit / a clip that never made it onto this machine is visible
  // instead of the subtitle just silently never appearing.
  //
  // ONE grouped warning, not one per entry: a machine mid-rollout can be missing
  // dozens of files and would otherwise open with dozens of near-identical
  // console lines that bury everything else.
  if (dropped.length > 0) {
    console.warn(
      `[videoMap] ${dropped.length}/${entries.length} subtitles dropped — no local video in "${set}"`,
      dropped,
    );
  }

  // NOTHING matched, yet the folder has videos in it. This is the one failure
  // that looks like a design decision from the outside: the display quietly
  // falls back to the generic attract wall, which has no captions and does not
  // follow the touch screen, so it reads as "subtitles are broken and the video
  // is stuck" rather than "these file names don't line up". Print both lists
  // side by side — the answer is always visible in the first two rows.
  if (matched.length === 0 && FILES_BY_SET[set].length > 0) {
    console.error(
      `[videoMap] NO subtitle matched any video in "${set}". The clip names in the ` +
        `subtitle data and the files on disk are different — compare these two lists. ` +
        `Until they agree the customer display shows the generic wall: no subtitles, ` +
        `and the same loop on every screen.`,
      {
        expectedByData: entries.slice(0, 10).map((e) => `${e.file}.mp4`),
        foundOnDisk: FILES_BY_SET[set].slice(0, 10).map((f) => `${f.folder}/${f.name}`),
      },
    );
  }

  if (matched.length === 0) return;
  // Replace only this set's maps (the call is idempotent per set).
  BY_KEY = { ...BY_KEY, [set]: buildByKey(matched) };
  BY_BUTTON = { ...BY_BUTTON, [set]: buildByButton(matched) };
}

/**
 * 제주 CMS playKey → app playKey, for the rows where the suffix does NOT mean
 * "the next clip of the same key". The CMS carries the sheet's keys verbatim,
 * including its typos and its handful of `-N` suffixes that name a DIFFERENT
 * SCREEN (the 재생조건 column reads 관심사 선택 / 추천 코스 확인 for
 * AISearch-2/-3, 숙소 목록 / 숙소 상세 for ToStay-2/-3, 이벤트 → 카테고리 선택
 * for Event-3). Every other `-N` really is the clip index (`Default-1`…`-10`,
 * `TaxFree-1`…`-4`) and is handled generically below. Mirrors what
 * scripts/sync-sheet.mjs's JEJU_KEY_ALIASES did at generation time; harmless
 * when the CMS keys are already clean (nothing matches).
 */
const JEJU_API_KEY_ALIASES: Record<string, string> = {
  'FlightInf-2': 'FlightInfo',
  'WITH Market': 'Market',
  'Rent Car': 'RentCar',
  'k=drama': 'KDrama',
  'To eat Market': 'ToEat',
  'To eat Market_Category': 'ToEat_Category',
  'To eat Market_Detail': 'ToEat_Detail',
  'AISearch-2': 'AISearch_Category',
  'AISearch-3': 'AISearch_Detail',
  'Event-3': 'Event_Category',
  'ToStay-2': 'ToStay_Category',
  'ToStay-3': 'ToStay_Detail',
};

/**
 * Normalize 제주 API playKeys to the form this module addresses.
 *
 * The CMS carries the sheet's keys verbatim — `Default-1`…`Default-10`,
 * `TaxFree-1`…`-4` — where the trailing `-N` is the clip INDEX within one key,
 * not a distinct key. Left unstripped, `Default` resolves nothing and every
 * `Key#N` tab lookup misses. The suffix is also the ONLY reliable ordering:
 * the API returns rows alphabetically (`Default-1`, `Default-10`, `Default-2`,
 * …) with sortOrder 0 on every row — so it becomes the entry's sortOrder and
 * each key's clips are re-sorted numerically (the home cycle and `Key#N`
 * addressing both depend on it).
 *
 * Resolution per key: exact alias first (suffixes that mean a different
 * screen, and typos — see JEJU_API_KEY_ALIASES), then the Greeting sub-tab
 * collapse (`Greeting-2-N` → `Greeting_Hobby`, `-3-N` → `Greeting_Stretching`;
 * the kiosk reports the TAB, not the sub-tab, so a tab's clips cycle on it),
 * then the generic clip-index strip.
 *
 * 제주 layouts only: the `-N` convention is VideoSubtitle_귤이's, and other
 * venues' live keys must not be rewritten on the chance one ends in a dash-number.
 */
export function normalizeClipIndexKeys(entries: VideoEntry[], kioskId?: KioskId): VideoEntry[] {
  if (kioskId == null || !isJejuLayout(getKioskLocation(kioskId).layout)) return entries;

  const normalizeOne = (e: VideoEntry): VideoEntry => {
    const raw = e.key.trim();
    const alias = JEJU_API_KEY_ALIASES[raw];
    if (alias) return { ...e, key: alias };
    let m = /^Greeting-2(?:-(\d+))?$/.exec(raw);
    if (m) return { ...e, key: 'Greeting_Hobby', sortOrder: m[1] ? Number(m[1]) : e.sortOrder };
    m = /^Greeting-3(?:-(\d+))?$/.exec(raw);
    if (m) return { ...e, key: 'Greeting_Stretching', sortOrder: m[1] ? Number(m[1]) : e.sortOrder };
    m = /-(\d+)$/.exec(raw);
    if (m) return { ...e, key: raw.slice(0, -m[0].length), sortOrder: Number(m[1]) };
    return raw === e.key ? e : { ...e, key: raw };
  };

  // Group by normalized key (first-appearance order), sorting each key's clips
  // by their index. Cross-key order is irrelevant (buildByKey regroups), but
  // within-key order is what the home cycle and `Key#N` addressing read.
  const groups = new Map<string, VideoEntry[]>();
  for (const e of entries) {
    const n = normalizeOne(e);
    const list = groups.get(n.key) ?? [];
    list.push(n);
    groups.set(n.key, list);
  }
  const out: VideoEntry[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    out.push(...list);
  }
  return out;
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
  /* The AR flow's later stages. Only 제주 splits them (its sheet authors a clip
     per stage); everywhere else they resolve to the same Photo_Creating the
     flow has always shown, so reporting them changes nothing here. */
  photo_guide: 'Photo_Creating',
  photo_creating: 'Photo_Creating',
  photo_complete: 'Photo_Creating',

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
  photo_guide:         'Photo_Creating',
  photo_creating:      'Photo_Creating',
  photo_complete:      'Photo_Creating',
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
 * The CMS's `-N` suffixes are the CLIP INDEX within one key, not distinct
 * keys — `Default-1`…`Default-10` is the ten-clip 기본화면 rotation — so
 * normalizeClipIndexKeys strips them at load (see JEJU_API_KEY_ALIASES for the
 * exceptions) and the names below are the stripped forms.
 *
 * Deliberately absent, because no 제주 screen reports them: `Donation_Category` /
 * `Donation_Detail` (기부 is a fullscreen webview, and its three sheet rows all
 * carry the same `기본화면 -> 기부 (기본 3편 순환)` condition, so `Donation` alone
 * covers the screen). Those rows still generate — they simply never resolve,
 * exactly like any other kiosk's unreachable sheet row.
 */
const JEJU_SCREEN_TO_VIDEO_KEY: Record<string, string> = {
  home:             'Default',
  search:           'Search',
  // 결과 목록이 뜼 상태 — the sheet's own 재생조건 for this row. JejuSearch
  // reports it from the keyboard's Enter, and drops back to `search` when the
  // query is cleared, so both clips stay reachable.
  search_enter:     'Search_Enter',
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

  /*
   * Per-TAB clips, addressed by position within their key — see splitClipIndex.
   * The 재생조건 column names the tab each one belongs to, and the landing entry
   * repeats whichever clip that page opens on.
   *
   * TAX-FREE: -1 진입 · -4 가맹점 안내. Its -2 (리펀드 진행) and -3 (처리 완료)
   * are steps INSIDE the third-party refund web app the 환급신청 tab embeds, which
   * the kiosk cannot observe — so 소개 and 환급신청 both hold the entry clip.
   */
  taxfree:          'TaxFree#1',
  taxfree_merchant: 'TaxFree#4',
  // 앱 탭 순서는 관광명소 · 역사 · 문화, the sheet's Here-1/2/3 are
  // 관광명소/역사/문화 — matched by MEANING, not by position.
  about:              'Here#1',
  about_attractions:  'Here#1',
  about_history:      'Here#2',
  about_culture:      'Here#3',
  // Exchange-1 환율계산기 · -2 실시간 환율. The page opens on 실시간.
  exchange:         'Exchange#2',
  exchange_calc:    'Exchange#1',
  exchange_live:    'Exchange#2',
  restroom:         'Toilet',
  /*
   * 기부 is a fullscreen webview onto the WIT Global donation app, and these
   * three keys are its PAGES, not a cycle: the sheet's Key column spells them
   * Donation / Donation_Category / Donation_Detail, and the app really does have
   * a campaign list and a campaign detail behind its entry screen.
   *
   * (Its 재생조건 column reads "기본 3편 순환" on all three rows and its 설명
   * calls them 1·2·3편째 of one key — written before those pages existed. The
   * Key column and the app agree, so the pages win.)
   *
   * DonationWebScreen reports these off the guest's own hash route; see there.
   */
  donation:          'Donation',
  donation_category: 'Donation_Category',
  donation_detail:   'Donation_Detail',
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
  // MarketPaper-1 온누리상품권 · -2 탐나는전. The page opens on 탐나는전.
  localpay:         'MarketPaper#2',
  localpay_onnuri:  'MarketPaper#1',
  localpay_tamna:   'MarketPaper#2',
  // 운항정보 — the airport board is 항공편, the terminal's is 여객선. Both venues
  // reach the same `flights` / `cruise` screens, and each machine only has its
  // own clips on disk, so the unmatched key simply resolves to nothing there.
  flights:          'FlightInfo',
  cruise:           'FerryInfo',

  /*
   * The AR flow, one key per STAGE — VideoSubtitle_귀이 authors four and its
   * 재생조건 column names each: 촬영 버튼(의상 선택) → Photo, 촬영 가이드 →
   * Photo_SelectHanbok, AI 합성 대기(3편 순환) → Photo_Creating, 합성 완료 →
   * Photo_Complete.
   *
   * This screen used to report `photo` for the whole flow, which resolved to
   * Photo_Creating throughout — so GYULI=Photo-1, -2 and -4 were shot and
   * synced and never played. PhotoWorkflow now reports the stage it is on.
   */
  photo:            'Photo',
  photo_guide:      'Photo_SelectHanbok',
  photo_creating:   'Photo_Creating',
  photo_complete:   'Photo_Complete',
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
/**
 * `Key#N` — one clip WITHIN a key, 1-based, in sheet order.
 *
 * VideoSubtitle_귀이 files a clip per TAB under a single key and distinguishes
 * them only in its 재생조건 column: TaxFree-1…4 are the TAX-FREE page's stages,
 * Here-1…3 its three tabs, Exchange-1/2 and MarketPaper-1/2 their two. The
 * generator strips the `-N` suffix (it is the clip INDEX, not a key), so all of
 * them arrive grouped under one key in sheet order — which is exactly what makes
 * addressing them by position sound.
 *
 * Without this a tab press could only ever start the whole key cycling, so the
 * screen would rotate through every tab's clip regardless of which tab is open.
 *
 * An index past the end falls through to the Default sequence like any other
 * unresolved key, so a sheet that loses a row degrades instead of going blank.
 */
function splitClipIndex(key: string): { key: string; clip: number | null } {
  const hash = key.indexOf('#');
  if (hash < 0) return { key, clip: null };
  const n = Number(key.slice(hash + 1));
  return { key: key.slice(0, hash), clip: Number.isFinite(n) && n > 0 ? n : null };
}

export function clipsForScreen(
  screen: string,
  lang: Lang,
  kioskId?: KioskId,
  buttonId?: number | null,
): DisplayClip[] {
  const set = videoSetFor(kioskId);
  const byKey = BY_KEY[set];

  /*
   * The picked language's own clip — eight keys, eight files, chosen from `lang`
   * rather than a static map entry.
   *
   * It LOOPS while the visitor stays on 언어선택, and that is deliberate:
   * VideoSubtitle_귀이's 재생조건 says 직후 1회 재생, but the operators asked
   * (2026-09-10) to keep it repeating instead. Playing once would need
   * AiModelVideoWall's `playOnce` + an `onDone` handing back to Default — the
   * way the weather clips already work — so do NOT "fix" this to match the
   * sheet without asking; the divergence is the answer, not an oversight.
   */
  if (screen === 'language') {
    const clips = clipsForKey(byKey, changeLanguagePlayKey(lang), lang, set);
    return clips.length > 0 ? clips : clipsForKey(byKey, 'Default', lang, set);
  }

  // Top-level home button → resolve its clip by DB id (API-driven). Sub-state
  // screens (category/detail/hello tabs) carry no buttonId, so they skip this.
  //
  // NOT on 제주: its sheet files several tab/stage clips under one key and the
  // screen map addresses them by position (`TaxFree#1`, `Here#2`, …) per the
  // 재생조건 column. The by-button path would return the whole key group — all
  // four TAX-FREE stage clips cycling on entry — so the map stays authoritative.
  if (buttonId != null && !isJejuLayout(layoutOf(kioskId))) {
    const byId = clipsForButton(buttonId, lang, set);
    if (byId.length > 0) return byId;
    // else fall through: this button has no API-associated clip → legacy map.
  }

  const { key, clip } = splitClipIndex(screenKey(screen, lang, layoutOf(kioskId)));
  const all = clipsForKey(byKey, key, lang, set);
  const clips = clip == null ? all : all.slice(clip - 1, clip);
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
