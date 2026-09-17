import { createLogger } from '@main/core/logger';
import { getGoogleSyncConfig } from '@main/core/GoogleSyncConfig';
import { getKioskLocation } from '@shared/config/kioskLocations';
import type { VideoEntry, SubtitleApiResponse } from '@shared/types/subtitle';
import { transformSubtitleResponse } from '@shared/types/subtitle';
import type { KioskService } from './KioskService';
import type { LocalCacheService } from './LocalCacheService';
import { JEJU_SUBTITLE_TABS, parseJejuSubtitleSheet } from './JejuSubtitleSheet';
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
    if (data && Array.isArray(data.entries) && data.entries.length > 0) {
      this.entries = data.entries;
      // A cache written before the sheet fallback existed carries no source; it
      // can only have come from the API.
      this.source = data.source ?? 'api';
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
    const tab = JEJU_SUBTITLE_TABS[layout];
    // Not a 제주 kiosk: keep the cache exactly as before.
    if (!tab) return null;
    // Offline with real CMS rows cached — never trade those for the sheet's.
    if (apiUnreachable && this.source === 'api') return null;

    const config = getGoogleSyncConfig();
    const sheetId = contentSheetIdFor(layout);
    if (!config || !sheetId) {
      log.warn('No Google Sheets access on this machine; 제주 subtitle sheet fallback skipped', { tab });
      return null;
    }
    try {
      const range = `'${tab.replace(/'/g, "''")}'!A:AZ`;
      const rows = await new SheetsClient({ ...config, sheetId }).getValues(range);
      const { entries, noVideo } = parseJejuSubtitleSheet(rows);
      if (entries.length === 0) {
        log.warn('Subtitle sheet has no rows with a video file name', { tab, noVideo });
        return null;
      }
      log.info('Subtitles loaded from the Google Sheet (the API has none)', {
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
