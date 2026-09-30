import { createLogger } from '@main/core/logger';
import { AppError } from '@main/core/AppError';
import { getKioskLocation } from '@shared/config/kioskLocations';
import type { KioskService } from '@main/services/KioskService';
import {
  INSA_DURATIONS,
  type InsaCourse,
  type InsaCourseQuery,
  type InsaCourseSpot,
  type InsaDuration,
} from '@shared/types/insaCourse';

const log = createLogger('insa-course-service');
const DEFAULT_API_BASE = 'https://api-v3.witteria.com';
/**
 * The visitor is watching a spinner (or a total that updates as they tap), so
 * give up early rather than hold the screen — same budget as the events grid.
 */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * 인사동 AI 코스 추천 — a live pass-through to `POST /api/insa/courses/recommend`.
 *
 * NOT cached: the answer depends on the interests, on the clock (opening hours,
 * meal windows) and on today's date, so there is nothing stable to keep.
 *
 * The service supplies `kioskId` and the kiosk's own `lat` / `lon` itself — the
 * renderer never sends them, so a screen cannot ask on another kiosk's behalf
 * and every route starts from where the visitor is standing.
 *
 * Env:
 *   INSA_COURSE_API_URL — full endpoint override (wins if set)
 *   WITTERIA_API_BASE   — shared API base, default https://api-v3.witteria.com
 */
export class InsaCourseService {
  constructor(private readonly kiosk: KioskService) {}

  private endpoint(): string {
    if (process.env['INSA_COURSE_API_URL']) return process.env['INSA_COURSE_API_URL'];
    const base = (process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE).replace(/\/+$/, '');
    return `${base}/api/insa/courses/recommend`;
  }

  /**
   * One route. Throws AppError on network, HTTP or shape failure; the API's own
   * refusals are in Korean and are logged as the reason.
   */
  async recommend(query: InsaCourseQuery): Promise<InsaCourse> {
    const url = this.endpoint();
    const here = getKioskLocation(this.kiosk.getConfig().kioskId).coordinates;
    const body = {
      kioskId: this.kiosk.kioskNum(),
      interests: query.interests,
      duration: query.duration,
      startAt: query.startAt,
      lat: here.lat,
      lon: here.lon,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        // charset spelled out: the interests are Korean and travel in the body.
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string; data?: unknown }
        | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.message ?? `HTTP ${res.status}`);
      }
      const course = normalizeCourse(json.data, query.duration);
      if (!course) throw new Error('Unexpected API shape');
      return course;
    } catch (error) {
      log.warn('Insa course recommendation failed', {
        url,
        kioskId: this.kiosk.kioskNum(),
        duration: query.duration,
        interests: query.interests.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new AppError('UNKNOWN', 'Failed to build the Insadong course.');
    } finally {
      clearTimeout(timer);
    }
  }
}

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

/** A stop without a `shopId` cannot be drawn — the card is built from the catalogue row. */
function normalizeSpot(row: unknown, index: number): InsaCourseSpot | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (typeof r['shopId'] !== 'number') return null;
  return {
    shopId: r['shopId'],
    stayMinutes: num(r['dwellMinutes'], num(r['stayMinutes'])),
    order: num(r['order'], index + 1),
    arriveAt: str(r['arriveAt']),
    leaveAt: str(r['leaveAt']),
    walkMinutes: num(r['walkMinutes']),
    walkMeters: num(r['walkMeters']),
    secondCategory: str(r['secondCategory']),
    hoursMethod: str(r['hoursMethod']),
  };
}

function normalizeCourse(data: unknown, asked: InsaDuration): InsaCourse | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const rows = Array.isArray(d['spots']) ? (d['spots'] as unknown[]) : [];
  const spots = rows
    .map((r, i) => normalizeSpot(r, i))
    .filter((s): s is InsaCourseSpot => s !== null)
    .sort((a, b) => a.order - b.order);
  const duration = INSA_DURATIONS.includes(d['duration'] as InsaDuration) ? (d['duration'] as InsaDuration) : asked;
  return {
    duration,
    // Trust the stops we could actually use over the server's own count, so a
    // dropped row cannot leave the summary promising a stop that is not drawn.
    totalSpots: spots.length,
    totalMinutes: num(d['totalMinutes']),
    totalWalkMeters: num(d['totalWalkMeters']),
    startAt: str(d['startAt']),
    endAt: str(d['endAt']),
    unmetInterests: Array.isArray(d['unmetInterests'])
      ? (d['unmetInterests'] as unknown[]).filter((v): v is string => typeof v === 'string')
      : [],
    spots,
  };
}
