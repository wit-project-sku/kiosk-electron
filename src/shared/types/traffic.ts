/**
 * 고속도로 교통 현황 near 화성휴게소 — GET /api/traffic/expressway (no auth, no
 * params; 화성휴게소 only). The server filters and sorts (nearby by distance →
 * 서해안선 by recency → 서해안선 notices) and caches 3 minutes; the kiosk only
 * picks which item to show and when to rotate.
 *
 * road / direction / location / message are Korean source text.
 */
export interface ExpresswayTrafficItem {
  id: string;
  scope: 'NEARBY' | 'ROUTE';
  /** CONGESTION, ACCIDENT, WORK, OBSTACLE, NOTICE … — translated in the kiosk. */
  type: string;
  /** Korean label for `type` (e.g. 차량증가/정체). */
  typeName: string;
  road: string;
  direction: string | null;
  /** null for NOTICE — show `message` instead. */
  location: string | null;
  closedLanes: number[];
  shoulderClosed: boolean;
  congestionKm: number | null;
  message: string | null;
  distanceKm: number | null;
  occurredAt: string;
}

export interface ExpresswayTrafficSnapshot {
  /** Empty = 특이사항 없음. */
  items: ExpresswayTrafficItem[];
  /** When the server last reached upstream — older than 3 min on an upstream outage. */
  fetchedAt: string;
}
