import { createLogger } from '@main/core/logger';
import { witteriaApiBase } from '@main/core/apiBase';
import type {
  LotteMovie,
  LotteMovieShareSummary,
  LotteShowing,
  LotteShowtimes,
  LotteStory,
  LotteStoryType,
} from '@shared/types/lotte';
import type { KioskService } from './KioskService';

const log = createLogger('lotte-service');
/** Give up on a slow/offline network rather than hold a screen. */
const REQUEST_TIMEOUT_MS = 8000;
/** The server caches showtimes for a minute; asking more often only re-reads the same value. */
const SHOWTIMES_MIN_REFETCH_MS = 60 * 1000;
/** The kiosk numbers the 롯데 endpoints accept — anything else is a 400 (CINEMA4001 / STORY4002). */
const LOTTE_KIOSKS = new Set([11, 12, 13]);

interface ApiEnvelope {
  success?: boolean;
  code?: number | string;
  data?: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const rec = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

function normalizeShowing(raw: unknown): LotteShowing | null {
  const r = rec(raw);
  if (!r || !str(r['startAt'])) return null;
  return {
    startAt: str(r['startAt']),
    endAt: str(r['endAt']),
    screenName: str(r['screenName']),
    seatsLeft: numOrNull(r['seatsLeft']),
    seatsTotal: numOrNull(r['seatsTotal']),
  };
}

function normalizeMovie(raw: unknown): LotteMovie | null {
  const r = rec(raw);
  if (!r || !str(r['movieTitle'])) return null;
  const showings = Array.isArray(r['showings'])
    ? r['showings'].map(normalizeShowing).filter((s): s is LotteShowing => s !== null)
    : [];
  if (showings.length === 0) return null;
  return {
    title: str(r['movieTitle']),
    rating: strOrNull(r['rating']),
    runtimeMin: numOrNull(r['runningMinutes']),
    posterUrl: strOrNull(r['posterUrl']),
    showings,
  };
}

const STORY_TYPES: readonly LotteStoryType[] = ['TEXT', 'PHOTO', 'VIDEO'];

function normalizeStory(raw: unknown): LotteStory | null {
  const r = rec(raw);
  const id = r ? numOrNull(r['id']) : null;
  if (!r || id === null) return null;
  const type = STORY_TYPES.find((t) => t === r['type']) ?? 'TEXT';
  return {
    id,
    type,
    title: str(r['title']),
    body: strOrNull(r['body']),
    mediaUrl: strOrNull(r['mediaUrl']),
    durationSeconds: numOrNull(r['durationSeconds']),
    displayName: str(r['displayName']) || '여행자',
    approvedAt: str(r['approvedAt']),
  };
}

/**
 * The 롯데-only kiosk endpoints. The shared content (shops, banners, backgrounds, subtitles …)
 * comes through the region-keyed services like every other kiosk; these three are keyed by the
 * kiosk number instead, as the API defines them.
 *
 * Each call keeps its last good answer and returns it when a refresh fails, so a dropped network
 * leaves the screen as it was. `null` means nothing has arrived yet — the screens show their
 * empty/sample state. Never throws.
 */
export class LotteService {
  private showtimes: LotteShowtimes | null = null;
  private showtimesAt = 0;
  private showtimesKiosk = 0;
  private showtimesInflight: Promise<LotteShowtimes | null> | null = null;
  private stories: LotteStory[] | null = null;
  private storiesKiosk = 0;
  private summary: LotteMovieShareSummary | null = null;

  constructor(private readonly kiosk: Pick<KioskService, 'kioskNum'>) {}

  /** This machine's 롯데 kiosk number, or null on any other venue (the endpoints would 400). */
  private lotteNum(): number | null {
    const n = this.kiosk.kioskNum();
    return LOTTE_KIOSKS.has(n) ? n : null;
  }

  async getShowtimes(): Promise<LotteShowtimes | null> {
    const n = this.lotteNum();
    if (n === null) return null;
    if (n !== this.showtimesKiosk) {
      // The test rig can switch site; another cinema's sessions must not linger.
      this.showtimes = null;
      this.showtimesKiosk = n;
    }
    if (this.showtimes && Date.now() - this.showtimesAt < SHOWTIMES_MIN_REFETCH_MS) {
      return this.showtimes;
    }
    this.showtimesInflight ??= this.fetchShowtimes(n).finally(() => {
      this.showtimesInflight = null;
    });
    return this.showtimesInflight;
  }

  private async fetchShowtimes(n: number): Promise<LotteShowtimes | null> {
    const data = rec(await this.get(`/api/cinema/showtimes?kioskId=${n}`));
    if (!data) return this.showtimes;
    const movies = Array.isArray(data['movies'])
      ? data['movies'].map(normalizeMovie).filter((m): m is LotteMovie => m !== null)
      : [];
    this.showtimes = {
      cinemaName: str(data['cinemaName']),
      date: str(data['date']),
      fetchedAt: str(data['fetchedAt']),
      movies,
    };
    this.showtimesAt = Date.now();
    return this.showtimes;
  }

  async getStories(): Promise<LotteStory[] | null> {
    const n = this.lotteNum();
    if (n === null) return null;
    if (n !== this.storiesKiosk) {
      this.stories = null;
      this.storiesKiosk = n;
    }
    const data = await this.get(`/api/stories?kioskId=${n}`);
    if (!Array.isArray(data)) return this.stories;
    this.stories = data.map(normalizeStory).filter((s): s is LotteStory => s !== null);
    return this.stories;
  }

  async getMovieShareSummary(): Promise<LotteMovieShareSummary | null> {
    if (this.lotteNum() === null) return null;
    const data = rec(await this.get('/api/movie-share/summary'));
    const total = data ? numOrNull(data['totalSharedCount']) : null;
    if (total === null) return this.summary;
    this.summary = { totalSharedCount: total };
    return this.summary;
  }

  /** GET the envelope's `data`, or undefined on any failure (logged). */
  private async get(path: string): Promise<unknown> {
    const url = `${witteriaApiBase()}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const json = (await res.json().catch(() => null)) as ApiEnvelope | null;
      if (!res.ok || !json?.success) {
        log.warn('롯데 API returned no data', { url, status: res.status, code: json?.code });
        return undefined;
      }
      return json.data;
    } catch (error) {
      log.warn('롯데 API request failed', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }
}
