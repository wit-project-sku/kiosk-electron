/**
 * Build the direction-fe save URL from the kiosk detail view.
 *
 * Sparse QR (screen key first — direction-fe hosts multiple kiosk pages):
 *   https://host/?shopdirection&id={shopId}&lang=ko
 *   (+ optional from / s / f / fl — route numbers come from shop-route API on phone)
 *
 * Phone loads photos from GET /api/shops/{id}, and route from
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
  /** Kept for call-site compatibility; not encoded into the QR (API supplies route). */
  route?: ShopRoute | null;
}

export const DETAIL_SAVE_ORIGIN =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.['VITE_DETAIL_SAVE_ORIGIN'] ||
  'http://localhost:5174';

/** Short query-only URL — no hash, no Korean text, no route payload. */
export function buildDetailCardSaveUrlForQr(
  input: DetailCardSaveInput,
  origin = DETAIL_SAVE_ORIGIN,
): string | null {
  if (!Number.isFinite(input.shopId)) return null;

  const root = origin.replace(/\/+$/, '');
  const q = new URLSearchParams({
    id: String(input.shopId),
    lang: input.lang,
  });

  // Default entry is eat — omit to keep the QR sparse.
  const from = (input.from || 'eat').trim();
  if (from && from !== 'eat') q.set('from', from);

  if (input.showShuttle) q.set('s', '1');
  if (input.showFerry) {
    q.set('f', '1');
    if (input.ferryModeLabel) q.set('fl', String(input.ferryModeLabel).slice(0, 20));
  }

  return `${root}/?shopdirection&${q.toString()}`;
}
