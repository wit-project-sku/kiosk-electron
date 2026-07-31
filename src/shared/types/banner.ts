/**
 * A bottom promo banner as returned by the banner API
 * (`GET /api/kiosks/{kioskId}/banners`).
 *
 * Banners rotate along the bottom of every screen. The renderer shows each
 * banner's remote `imageUrl` directly (Chromium's disk cache keeps it offline
 * after the first paint, exactly as the shop images do), ordered by `sortOrder`
 * and filtered to those whose `[startDate, endDate]` window contains today.
 */
export interface KioskBanner {
  /** DB `banners.id` — stable identity for the banner. */
  bannerId: number;
  /** Remote banner image URL (shown directly via <img src>). */
  imageUrl: string;
  /** Ascending display order within the active set. */
  sortOrder: number;
  /** First day the banner is active, `YYYY-MM-DD` (inclusive). */
  startDate: string;
  /** Last day the banner is active, `YYYY-MM-DD` (inclusive). */
  endDate: string;
}
