import { createLogger } from '@main/core/logger';
import type { VideoEntry, SubtitleApiResponse } from '@shared/types/subtitle';
import { transformSubtitleResponse } from '@shared/types/subtitle';
import type { KioskService } from './KioskService';
import type { LocalCacheService } from './LocalCacheService';

const log = createLogger('subtitle-service');
const DEFAULT_API_BASE = 'https://api-v3.witteria.com';

/** local_cache key for offline-first persistence of the entry list. */
const CACHE_KEY = 'subtitles';

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
 *    enough. A close+reopen is what refreshes it.
 */
export class SubtitleService {
  private entries: VideoEntry[] | null = null;
  /** The single in-flight (or completed) refresh for this session. */
  private refreshPromise: Promise<void> | null = null;

  constructor(
    private readonly cache: LocalCacheService,
    private readonly kiosk: KioskService,
  ) {}

  /** Hydrate from cache for an instant first paint, then refresh once. */
  start(): void {
    const cached = this.cache.get(CACHE_KEY);
    const data = cached?.data as { entries?: VideoEntry[] } | undefined;
    if (data && Array.isArray(data.entries) && data.entries.length > 0) {
      this.entries = data.entries;
    }
    this.refreshPromise = this.refresh();
  }

  /**
   * Cached entries. Awaits the session's one refresh if it is still in flight,
   * so callers get the freshest available data (API result, or the hydrated
   * cache if the network failed). Returns `null` only when there is neither.
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
    const url = this.endpoint();
    log.info('Fetching subtitles from API', { url });
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SubtitleApiResponse;
      if (!json.success || !json.data) throw new Error('Unexpected API shape');
      const entries = transformSubtitleResponse(json);
      if (entries.length === 0) throw new Error('API returned no subtitle entries');
      this.entries = entries;
      this.cache.upsert(CACHE_KEY, { entries }, 'subtitles');
      log.info('Subtitles loaded from API', { count: entries.length });
    } catch (err) {
      // Keep whatever we hydrated from cache; renderer falls back to bundled
      // static data only if there is nothing cached either.
      log.warn('Subtitle fetch failed (keeping cached/static)', { error: String(err) });
    }
  }
}
