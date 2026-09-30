import { createLogger } from '@main/core/logger';
import { getServiceAccount, serviceAccountProblem } from '@main/core/GoogleSyncConfig';
import { getKioskLocation } from '@shared/config/kioskLocations';
import type { VideoEntry, SubtitleApiResponse } from '@shared/types/subtitle';
import { transformSubtitleResponse } from '@shared/types/subtitle';
import type { KioskService } from './KioskService';
import type { LocalCacheService } from './LocalCacheService';
import {
  INSA_PARSE,
  INSA_SUBTITLE_LAYOUTS,
  INSA_SUBTITLE_TAB,
  JEJU_SUBTITLE_TABS,
  parseJejuSubtitleSheet,
} from './JejuSubtitleSheet';
import { SheetsClient } from './sync/google/SheetsClient';
import { contentSheetIdFor } from './sync/GoogleSheetsSyncTransport';

const log = createLogger('subtitle-service');
const DEFAULT_API_BASE = 'https://api-v3.witteria.com';

/** local_cache key for offline-first persistence of the entry list. */
const CACHE_KEY = 'subtitles';

/** Where the current entries came from. */
type SubtitleSource = 'api' | 'sheet';

/**
 * Fetches AI-model video subtitles (playKey, video file name, per-language
 * subtitle + title) from the witteria API. Offline-first, like weather/exchange:
 *
 *  - `start()` hydrates instantly from SQLite so the first paint has data even
 *    with no network, then fires exactly ONE network refresh for the session.
 *  - `getEntries()` awaits that in-flight refresh so the renderer never races to
 *    a premature `null` (and thus never gets stuck on the static fallback while
 *    the real data is still on the wire).
 *  - We never poll: the data changes rarely, so one request per app launch is
 *    enough, and every kiosk restarts daily. A close+reopen refreshes it.
 *
 * ── 제주: the sheet fallback ────────────────────────────────────────────────
 * The CMS is the source everywhere, but production answers 제주 (W006–W008)
 * with zero rows until its subtitles are published, and a display with no rows
 * cannot follow the touch screen at all. So on a 제주 kiosk, when the API
 * answers with NO rows, the venue's VideoSubtitle tab is read from the 제주
 * content spreadsheet instead (see JejuSubtitleSheet). The API still wins the
 * moment it has rows — nothing needs switching off.
 *
 * ── 인사동: the sheet is the source ─────────────────────────────────────────
 * The reverse order. The CMS still names the pre-refresh footage
 * (`M=hanbok01=7.2-02=…`), none of which is on the kiosks now, so its rows would
 * resolve no clip at all. VideoSubtitle_Insa_v2 is the ONLY source for now: its
 * `파일명 (개발)` names (already `…=FIN`) are what the files on disk are called
 * (see INSA_PARSE). If the sheet cannot be read the last sheet data is kept —
 * the API is never consulted, so a network blip cannot swap working rows for
 * names that match nothing.
 *
 * An UNREACHABLE API is a different case from an empty one: if what is cached
 * came from the API, it is kept rather than replaced by the sheet, so a network
 * blip can never swap real CMS data for the sheet's.
 */
export class SubtitleService {
  private entries: VideoEntry[] | null = null;
  private source: SubtitleSource | null = null;
  /** The single in-flight (or completed) refresh for this session. */
  private refreshPromise: Promise<void> | null = null;

  constructor(
    private readonly cache: LocalCacheService,
    private readonly kiosk: KioskService,
  ) {}

  /** Hydrate from cache for an instant first paint, then refresh once. */
  start(): void {
    const cached = this.cache.get(CACHE_KEY);
    const data = cached?.data as { entries?: VideoEntry[]; source?: SubtitleSource } | undefined;
    // A cache written before the sheet fallback existed carries no source; it
    // can only have come from the API.
    const source = data?.source ?? 'api';
    // 인사동 never serves API rows (they name footage no longer on the kiosks):
    // served while the sheet was unreadable, 4 of them matched a file and the
    // display played just those few clips, uncaptioned, on every screen.
    const insa = INSA_SUBTITLE_LAYOUTS.has(getKioskLocation(this.kiosk.getConfig().kioskId).layout);
    if (data && Array.isArray(data.entries) && data.entries.length > 0 && !(insa && source === 'api')) {
      this.entries = data.entries;
      this.source = source;
    }
    this.refreshPromise = this.refresh();
  }

  /**
   * Cached entries. Awaits the session's one refresh if it is still in flight,
   * so callers get the freshest available data (API result, sheet fallback, or
   * the hydrated cache if both failed). Returns `null` only when there is none.
   */
  async getEntries(): Promise<VideoEntry[] | null> {
    if (this.refreshPromise) await this.refreshPromise;
    return this.entries;
  }

  private endpoint(): string {
    const base = (process.env['WITTERIA_API_BASE'] ?? DEFAULT_API_BASE).replace(/\/+$/, '');
    // Prefer the per-machine provisioned `shopApiKioskId` from electron-store
    // (set by provision-kiosk.ps1), falling back to the W-code number.
    return `${base}/api/kiosks/${this.kiosk.kioskNum()}/subtitles`;
  }

  private async refresh(): Promise<void> {
    if (INSA_SUBTITLE_LAYOUTS.has(getKioskLocation(this.kiosk.getConfig().kioskId).layout)) {
      const fromSheet = await this.fetchSheet(false);
      if (fromSheet) {
        this.store(fromSheet, 'sheet');
        return;
      }
      // Sheet unavailable: keep what the sheet gave us last time, if anything. The
      // API is deliberately NOT consulted for 인사동 for now (its rows name footage
      // that is no longer on the kiosks); with nothing cached the display simply
      // shows the generic attract wall until the sheet is next reachable.
      log.warn('Insadong subtitle sheet unavailable; not falling back to the API');
      return;
    }
    const fromApi = await this.fetchApi();
    if (fromApi && fromApi.length > 0) {
      this.store(fromApi, 'api');
      log.info('Subtitles loaded from API', { count: fromApi.length });
      return;
    }
    const fromSheet = await this.fetchSheet(fromApi === null);
    if (fromSheet) this.store(fromSheet, 'sheet');
    // Otherwise keep whatever was hydrated. With nothing cached either, the
    // customer display shows the generic uncaptioned attract wall.
  }

  /** The API's entries: `[]` when it answered with no rows, `null` when it could not be reached or read. */
  private async fetchApi(): Promise<VideoEntry[] | null> {
    const url = this.endpoint();
    log.info('Fetching subtitles from API', { url });
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SubtitleApiResponse;
      if (!json.success || !json.data) throw new Error('Unexpected API shape');
      const entries = transformSubtitleResponse(json);
      if (entries.length === 0) log.warn('Subtitle API returned no rows', { url });
      return entries;
    } catch (err) {
      log.warn('Subtitle fetch failed (keeping cached)', { error: String(err) });
      return null;
    }
  }

  /** The 제주 VideoSubtitle tab, or `null` when it does not apply or yields nothing. */
  private async fetchSheet(apiUnreachable: boolean): Promise<VideoEntry[] | null> {
    const layout = getKioskLocation(this.kiosk.getConfig().kioskId).layout;
    const insa = INSA_SUBTITLE_LAYOUTS.has(layout);
    const tab = insa ? INSA_SUBTITLE_TAB : JEJU_SUBTITLE_TABS[layout];
    // Neither 인사동 nor 제주: keep the cache exactly as before.
    if (!tab) return null;
    // Offline with real CMS rows cached — never trade those for the sheet's.
    if (apiUnreachable && this.source === 'api') return null;

    // The service account alone decides this, NOT getGoogleSyncConfig(): that
    // also demands GOOGLE_SHEETS_ID, which is only the night-sync on/off switch.
    // A beta build whose .env left it empty read no sheet at all, and every
    // 인사동 kiosk on it showed uncaptioned footage.
    const serviceAccount = getServiceAccount();
    const sheetId = contentSheetIdFor(layout);
    if (!serviceAccount || !sheetId) {
      log.warn('No Google Sheets access on this machine; subtitle sheet skipped', {
        tab,
        reason: serviceAccountProblem() ?? 'no content sheet for this layout',
      });
      return null;
    }
    try {
      const range = `'${tab.replace(/'/g, "''")}'!A:AZ`;
      const client = new SheetsClient({ sheetId, serviceAccount, contentRange: '', analyticsTab: '' });
      const rows = await client.getValues(range);
      const { entries, noVideo } = parseJejuSubtitleSheet(rows, insa ? INSA_PARSE : {});
      if (entries.length === 0) {
        log.warn('Subtitle sheet has no rows with a video file name', { tab, noVideo });
        return null;
      }
      log.info(insa ? 'Subtitles loaded from the Google Sheet' : 'Subtitles loaded from the Google Sheet (the API has none)', {
        tab,
        count: entries.length,
        noVideo,
      });
      return entries;
    } catch (err) {
      log.warn('Subtitle sheet fallback failed (keeping cached)', { tab, error: String(err) });
      return null;
    }
  }

  private store(entries: VideoEntry[], source: SubtitleSource): void {
    this.entries = entries;
    this.source = source;
    this.cache.upsert(CACHE_KEY, { entries, source }, source === 'api' ? 'subtitles' : 'subtitles_sheet');
  }
}
