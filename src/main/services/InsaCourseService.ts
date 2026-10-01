import { createLogger } from '@main/core/logger';
import { AppError } from '@main/core/AppError';
import { getKioskLocation } from '@shared/config/kioskLocations';
import type { KioskService } from '@main/services/KioskService';
import {
  INSA_DURATIONS,
  type InsaCourse,
  type InsaCourseQuery,
  type InsaCourseSet,
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
 * 인사동 AI 코스 추천 — a live pass-through to `POST /api/insa/courses/recommend/v2`,
 * which answers with both a 실시간 코스 and a 일반 코스. The request is v1's, so a
 * server that has not shipped v2 yet (404 / 405) is asked the v1 route instead
 * and its single route stands in for both.
 *
 * NOT cached: the answer depends on the interests, on the clock (opening hours,
 * meal windows) and on today's date, so there is nothing stable to keep.
 *
 * The service supplies `kioskId` and the kiosk's own `lat` / `lon` itself — the
 * renderer never sends them, so a screen cannot ask on another kiosk's behalf
 * and every route starts from where the visitor is standing.
 *
 * Env:
 *   INSA_COURSE_API_URL — full endpoint override (wins if set); v1 or v2, either
 *                         shape is understood
 *   WITTERIA_API_BASE   — shared API base, default https://api-v3.witteria.com
 */
export class InsaCourseService {
  constructor(private readonly kiosk: KioskService) {}

  private endpoint(version: 'v1' | 'v2'): string {
    if (process.env['INSA_COURSE_API_URL']) return process.env['INSA_COURSE_API_URL'];
    const base = (process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE).replace(/\/+$/, '');
    return `${base}/api/insa/courses/recommend${version === 'v2' ? '/v2' : ''}`;
  }

  /**
   * Both routes. Throws AppError on network, HTTP or shape failure; the API's own
   * refusals are in Korean and are logged as the reason.
   */
  async recommend(query: InsaCourseQuery): Promise<InsaCourseSet> {
    const here = getKioskLocation(this.kiosk.getConfig().kioskId).coordinates;
    const body = {
      kioskId: this.kiosk.kioskNum(),
      interests: query.interests,
      duration: query.duration,
      numberOfPeople: query.numberOfPeople,
      startAt: query.startAt,
      lat: here.lat,
      lon: here.lon,
    };

    try {
      const first = await this.post(this.endpoint('v2'), body, query);
      if (first.ok) return first.set;
      // v2 not deployed on this server yet — fall back to the single v1 route.
      if (first.status === 404 || first.status === 405) {
        const second = await this.post(this.endpoint('v1'), body, query);
        if (second.ok) return second.set;
        throw new Error(second.message);
      }
      throw new Error(first.message);
    } catch (error) {
      log.warn('Insa course recommendation failed', {
        kioskId: this.kiosk.kioskNum(),
        duration: query.duration,
        interests: query.interests.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new AppError('UNKNOWN', 'Failed to build the Insadong course.');
    }
  }

  private async post(
    url: string,
    body: unknown,
    query: InsaCourseQuery,
  ): Promise<{ ok: true; set: InsaCourseSet } | { ok: false; status: number; message: string }> {
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
        return { ok: false, status: res.status, message: json?.message ?? `HTTP ${res.status}` };
      }
      const set = normalizeSet(json.data, query);
      if (!set) return { ok: false, status: 0, message: 'Unexpected API shape' };
      return { ok: true, set };
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
    arriveElapsedMinutes: num(r['arriveElapsedMinutes']),
    leaveElapsedMinutes: num(r['leaveElapsedMinutes']),
    name: str(r['name']),
    reservationRequired: r['reservationRequired'] === true,
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
    // A 실시간 block that says nothing about `available` is a v1 answer: it is available.
    available: d['available'] !== false,
    unavailableReason: str(d['unavailableReason']),
    sameAsRealtime: d['sameAsRealtime'] === true,
  };
}

/**
 * v2 → `{ realtime, general }`. A v1 answer (a bare route) is accepted too and
 * stands in for both, flagged `sameAsRealtime` so a screen shows it once.
 */
function normalizeSet(data: unknown, query: InsaCourseQuery): InsaCourseSet | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const duration = INSA_DURATIONS.includes(d['duration'] as InsaDuration) ? (d['duration'] as InsaDuration) : query.duration;
  const numberOfPeople = num(d['numberOfPeople'], query.numberOfPeople);
  if (d['realtime'] || d['general']) {
    const realtime = normalizeCourse(d['realtime'], duration);
    const general = normalizeCourse(d['general'], duration);
    if (!realtime || !general) return null;
    return { duration, numberOfPeople, realtime, general };
  }
  const only = normalizeCourse(data, duration);
  if (!only) return null;
  return { duration, numberOfPeople, realtime: only, general: { ...only, sameAsRealtime: true } };
}
