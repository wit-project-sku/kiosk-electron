/**
 * Build the direction-fe save URL from the kiosk detail view.
 *
 * Sparse QR:
 *   https://host/?id={shopId}&lang=ko&from=eat&r=36.7,56,t52,3008,20,40,w3
 *
 * Phone loads photos from GET /api/shops/{id}, and bus stop names from
 * GET /api/shop-route?id=&kioskId=. Korean text must not go in the QR.
 */
import type { ShopRoute } from '@shared/types/shop';
import type { Lang } from '@renderer/lib/i18n';

export interface DetailCardSaveInput {
  lang: Lang;
  from: string;
  shopId: number;
  showShuttle?: boolean;
  showFerry?: boolean;
  ferryModeLabel?: string;
  route?: ShopRoute | null;
}

export const DETAIL_SAVE_ORIGIN =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.['VITE_DETAIL_SAVE_ORIGIN'] ||
  'http://localhost:5174';

/** Compact ASCII route (numbers only). Keep in sync with direction-fe `parseRouteParam`. */
function encodeRouteParam(route: ShopRoute | null | undefined): string | null {
  if (!route || typeof route.distanceKm !== 'number' || !Number.isFinite(route.distanceKm)) {
    return null;
  }

  const parts: string[] = [
    String(Number(route.distanceKm.toFixed(1))),
    String(Math.round(route.durationMin ?? 0)),
  ];

  if (typeof route.bikeMin === 'number' && Number.isFinite(route.bikeMin)) {
    parts.push(`b${Math.round(route.bikeMin)}`);
  }
  if (typeof route.walkMin === 'number' && Number.isFinite(route.walkMin)) {
    parts.push(`p${Math.round(route.walkMin)}`);
  }

  const transit = route.transit;
  if (transit?.status === 'FOUND' && typeof transit.totalMin === 'number') {
    parts.push(`t${Math.round(transit.totalMin)}`);
    for (const leg of (transit.legs ?? []).slice(0, 2)) {
      const num = String(leg.routeNum ?? '').replace(/[^0-9A-Za-z-]/g, '').slice(0, 8);
      if (!num) continue;
      parts.push(num, String(Math.round(leg.rideStops ?? 0)), String(Math.round(leg.rideMin ?? 0)));
    }
  }

  const walk = route.busStop?.walkMin;
  if (typeof walk === 'number' && Number.isFinite(walk)) {
    parts.push(`w${Math.round(walk)}`);
  }

  return parts.join(',');
}

/** Short query-only URL — no hash, no Korean text. */
export function buildDetailCardSaveUrlForQr(
  input: DetailCardSaveInput,
  origin = DETAIL_SAVE_ORIGIN,
): string | null {
  if (!Number.isFinite(input.shopId)) return null;

  const root = origin.replace(/\/+$/, '');
  const q = new URLSearchParams({
    id: String(input.shopId),
    lang: input.lang,
    from: input.from || 'eat',
  });

  const r = encodeRouteParam(input.route);
  if (r) q.set('r', r);

  if (input.showShuttle) q.set('s', '1');
  if (input.showFerry) {
    q.set('f', '1');
    if (input.ferryModeLabel) q.set('fl', String(input.ferryModeLabel).slice(0, 20));
  }

  return `${root}/?${q.toString()}`;
}
