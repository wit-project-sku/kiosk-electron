import { createLogger } from '@main/core/logger';
import { AppError } from '@main/core/AppError';
import type { KioskService } from '@main/services/KioskService';
import type {
  JejuCourse,
  JejuCourseDay,
  JejuCourseKey,
  JejuCourseRecommendQuery,
  JejuCourseSpot,
} from '@shared/types/jejuCourse';

const log = createLogger('jeju-course-service');
const DEFAULT_API_BASE = 'https://api-v3.witteria.com';
/**
 * The visitor is standing at the kiosk watching a spinner, and the renderer has
 * a client-side course to fall back on — so give up early rather than hold the
 * screen. Same budget as the events grid.
 */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * 제주 AI 코스 추천 — a live pass-through to `POST /api/jeju/courses/recommend`.
 *
 * NOT cached, unlike banners/backgrounds/outfits: the answer depends on the
 * questionnaire, on today's date and on what the visitor already saw, so there
 * is nothing stable to cache. Each submission is one request, the same way
 * EventsService serves its paginated grid.
 *
 * The service supplies `kioskId` itself from KioskService — the renderer never
 * sends one, so a screen cannot ask on another kiosk's behalf. The API supports
 * 6 / 7 / 8 and answers 400 for the rest; that 400 arrives here as a
 * VALIDATION AppError, which the AI course screen treats like any other failure
 * and falls back to its own client-side itinerary.
 *
 * Env:
 *   JEJU_COURSE_API_URL — full endpoint override (wins if set)
 *   WITTERIA_API_BASE   — shared API base, default https://api-v3.witteria.com
 */
export class JejuCourseService {
  constructor(private readonly kiosk: KioskService) {}

  private endpoint(): string {
    if (process.env['JEJU_COURSE_API_URL']) return process.env['JEJU_COURSE_API_URL'];
    const base = (process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE).replace(/\/+$/, '');
    return `${base}/api/jeju/courses/recommend`;
  }

  /**
   * Schedule one course. Throws AppError on network, HTTP or shape failure —
   * including the API's own 400s, whose Korean message is passed through so the
   * log says which rule was broken (unsupported kiosk, bad course letter, bad
   * 이동수단) rather than just "400".
   */
  async recommend(query: JejuCourseRecommendQuery): Promise<JejuCourse> {
    const url = this.endpoint();
    const body = {
      kioskId: this.kiosk.kioskNum(),
      course: query.course,
      transport: query.transport,
      party: query.party,
      nights: query.nights,
      interests: query.interests,
      visitDate: query.visitDate,
      // Omitted rather than sent empty: this is the re-recommendation lever and
      // an empty list is the same as not asking for a different combination.
      ...(query.excludeShops && query.excludeShops.length > 0
        ? { excludeShops: query.excludeShops }
        : {}),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        // charset spelled out because the interests are Korean and travel in
        // the body — a mis-declared encoding turns "22-섬 여행" into a category
        // that matches nothing and comes back in `unmetInterests`.
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string; data?: unknown }
        | null;

      if (!res.ok || !json?.success || !json.data) {
        // The API states its refusals in Korean ("코스 추천을 지원하지 않는
        // 키오스크입니다"), which is the useful half of the failure.
        throw new Error(json?.message ?? `HTTP ${res.status}`);
      }

      const course = normalizeCourse(json.data);
      if (!course) throw new Error('Unexpected API shape');
      return course;
    } catch (error) {
      log.warn('Jeju course recommendation failed', {
        url,
        kioskId: this.kiosk.kioskNum(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw new AppError('UNKNOWN', 'Failed to build the Jeju course.');
    } finally {
      clearTimeout(timer);
    }
  }
}

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' ? v : fallback);
const text = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
};

/**
 * One stop.
 *
 * A spot without a `shopId` is unusable — the whole card is built from the
 * catalogue row it points at — so it is dropped rather than drawn empty. Every
 * other field has a sane zero: a missing `dwellMinutes` shows no duration, and
 * `difficulty: 0` falls through to no label.
 */
function normalizeSpot(row: unknown, index: number): JejuCourseSpot | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const shopId = typeof r['shopId'] === 'number' ? r['shopId'] : null;
  if (shopId === null) return null;

  return {
    shopId,
    order: num(r['order'], index + 1),
    travelMinutes: num(r['travelMinutes']),
    arriveMin: num(r['arriveMin']),
    leaveMin: num(r['leaveMin']),
    dwellMinutes: num(r['dwellMinutes']),
    difficulty: num(r['difficulty']),
    // Both are documented as null-carrying, and null MEANS something here (an
    // estimated opening time is not to be shown), so an empty string is
    // normalized to null rather than kept as a blank label.
    openTimeText: text(r['openTimeText']),
    viewAnchor: text(r['viewAnchor']),
  };
}

/** One day. Days with no usable spots are kept — the pager must still count them. */
function normalizeDay(row: unknown, index: number): JejuCourseDay | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const rows = Array.isArray(r['spots']) ? (r['spots'] as unknown[]) : [];
  const spots = rows
    .map((s, i) => normalizeSpot(s, i))
    .filter((s): s is JejuCourseSpot => s !== null)
    .sort((a, b) => a.order - b.order);

  return {
    day: num(r['day'], index + 1),
    // Trust the spots we could actually use over the server's own count, so a
    // dropped row cannot leave the header promising a stop that is not drawn.
    spotCount: spots.length,
    minutes: num(r['minutes']),
    difficulty: num(r['difficulty']),
    spots,
  };
}

function normalizeCourse(data: unknown): JejuCourse | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  const raw = typeof d['course'] === 'string' ? d['course'].toUpperCase() : '';
  const course: JejuCourseKey = raw === 'B' || raw === 'C' ? raw : 'A';

  const rows = Array.isArray(d['schedule']) ? (d['schedule'] as unknown[]) : [];
  const schedule = rows
    .map((r, i) => normalizeDay(r, i))
    .filter((r): r is JejuCourseDay => r !== null)
    .sort((a, b) => a.day - b.day);
  if (schedule.length === 0) return null;

  return {
    course,
    // Same reasoning as spotCount: the day pager is driven by what came back,
    // never by a count that could outrun it.
    days: schedule.length,
    totalSpots: schedule.reduce((n, day) => n + day.spots.length, 0),
    totalMinutes: num(d['totalMinutes']),
    difficulty: num(d['difficulty']),
    unmetInterests: Array.isArray(d['unmetInterests'])
      ? (d['unmetInterests'] as unknown[]).filter((v): v is string => typeof v === 'string')
      : [],
    schedule,
  };
}
