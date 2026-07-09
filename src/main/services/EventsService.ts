import { createLogger } from '@main/core/logger';
import { AppError } from '@main/core/AppError';
import type {
  EventDetail,
  EventDetailApiResponse,
  EventRecommendation,
  EventsApiResponse,
  EventsPage,
  EventsQuery,
  EventsRecommendApiResponse,
  EventsRecommendQuery,
} from '@shared/types/events';

const log = createLogger('events-service');
const DEFAULT_API_BASE = 'https://api-v3.witteria.com';
/** Give up on a slow/offline network rather than hang the events grid. */
const REQUEST_TIMEOUT_MS = 8000;

/** The API stores HTML-encoded text (e.g. `&middot;`, `&amp;`); decode for display. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&middot;/g, '·')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Nullable-safe decodeEntities. */
function decodeOrNull(s: string | null): string | null {
  return s === null ? null : decodeEntities(s);
}

/**
 * Live pass-through to the witteria events API (GET /api/events).
 *
 * Unlike buttons/subtitles (fetched once and cached in SQLite), events are
 * paginated and filtered per user interaction (region/category/keyword/page),
 * so each request hits the network directly. The service only normalizes the
 * envelope and resolves each `mainImage` to an absolute URL; on any failure it
 * throws an AppError which the IPC registry serializes for the renderer.
 *
 * Env:
 *   EVENTS_API_URL    — full endpoint override (wins if set)
 *   WITTERIA_API_BASE — shared API base, default https://api-v3.witteria.com
 */
export class EventsService {
  private endpoint(): string {
    if (process.env['EVENTS_API_URL']) return process.env['EVENTS_API_URL'];
    const base = (process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE).replace(/\/+$/, '');
    return `${base}/api/events`;
  }

  private base(): string {
    return (process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE).replace(/\/+$/, '');
  }

  /** Resolve a possibly-relative `mainImage` into an absolute URL. */
  private resolveImage(mainImage: string | null | undefined): string {
    if (!mainImage) return '';
    if (/^https?:\/\//i.test(mainImage)) return mainImage;
    return `${this.base()}/${mainImage.replace(/^\/+/, '')}`;
  }

  /** Fetch one page of events. Throws AppError on network / shape failure. */
  async get(query: EventsQuery): Promise<EventsPage> {
    const params = new URLSearchParams({
      eventRegion: query.eventRegion,
      eventCategory: query.eventCategory,
      pageNum: String(query.pageNum),
      pageSize: String(query.pageSize),
    });
    if (query.keyword && query.keyword.trim()) params.set('keyword', query.keyword.trim());
    const url = `${this.endpoint()}?${params.toString()}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as EventsApiResponse;
      if (!json.success || !json.data) throw new Error('Unexpected API shape');
      const data = json.data;
      // Stage (api-stage-v3) returns `data` as the FULL filtered list (no
      // pagination envelope, pageNum/pageSize ignored); prod returns a
      // paginated { content, totalPages, ... } page. Normalize both here so
      // the renderer always gets a proper page.
      if (Array.isArray(data)) {
        const all = data.map((e) => ({
          ...e,
          title: decodeEntities(e.title),
          location: decodeEntities(e.location),
          mainImage: this.resolveImage(e.mainImage),
        }));
        const totalPages = Math.max(1, Math.ceil(all.length / query.pageSize));
        const start = (query.pageNum - 1) * query.pageSize;
        return {
          content: all.slice(start, start + query.pageSize),
          totalElements: all.length,
          totalPages,
          pageNum: query.pageNum,
          pageSize: query.pageSize,
          last: query.pageNum >= totalPages,
        };
      }
      const content = Array.isArray(data.content)
        ? data.content.map((e) => ({
            ...e,
            title: decodeEntities(e.title),
            location: decodeEntities(e.location),
            mainImage: this.resolveImage(e.mainImage),
          }))
        : [];
      return { ...data, content };
    } catch (error) {
      log.warn('Events fetch failed', { url, error: error instanceof Error ? error.message : String(error) });
      throw new AppError('UNKNOWN', 'Failed to load events.');
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Fetch one event's full record (GET /api/events/{eventId}) — same shape on
   * stage and prod; nullable extended fields are passed through so the detail
   * UI can hide empty rows. Throws AppError on network / shape failure.
   */
  async getDetail(eventId: number): Promise<EventDetail> {
    const url = `${this.endpoint()}/${eventId}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as EventDetailApiResponse;
      if (!json.success || !json.data) throw new Error('Unexpected API shape');
      const d = json.data;
      return {
        ...d,
        title: decodeEntities(d.title),
        location: decodeEntities(d.location),
        orgName: decodeOrNull(d.orgName),
        recruitTarget: decodeOrNull(d.recruitTarget),
        price: decodeOrNull(d.price),
        description: decodeOrNull(d.description),
        mainImage: this.resolveImage(d.mainImage),
      };
    } catch (error) {
      log.warn('Event detail fetch failed', { url, error: error instanceof Error ? error.message : String(error) });
      throw new AppError('UNKNOWN', 'Failed to load event detail.');
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * MBTI-based recommendation (GET /api/events/recommend) — returns ~2 events
   * for a region + MBTI string. Throws AppError on network / shape failure.
   */
  async recommend(query: EventsRecommendQuery): Promise<EventRecommendation[]> {
    const base = (process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE).replace(/\/+$/, '');
    const params = new URLSearchParams({ region: query.region, mbti: query.mbti });
    const url = `${base}/api/events/recommend?${params.toString()}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as EventsRecommendApiResponse;
      if (!json.success || !Array.isArray(json.data)) throw new Error('Unexpected API shape');
      return json.data.map((e) => ({ ...e, mainImage: this.resolveImage(e.mainImage) }));
    } catch (error) {
      log.warn('Events recommend failed', { url, error: error instanceof Error ? error.message : String(error) });
      throw new AppError('UNKNOWN', 'Failed to load recommendations.');
    } finally {
      clearTimeout(timer);
    }
  }
}
