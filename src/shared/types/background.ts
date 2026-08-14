/**
 * A 배경 테마 (AR photo background) as returned by the backgrounds API
 * (`GET /api/kiosks/{kioskId}/backgrounds`, no auth).
 *
 * The endpoint returns only the ACTIVE backgrounds assigned to this kiosk, in
 * display order. A branch that does not use backgrounds gets an EMPTY ARRAY —
 * not a 404 — so an empty list is authoritative content, not a failure.
 *
 * `imageUrl` is for the selection screen only and is always 9:16 (webp, ≤1080
 * wide); the renderer shows it directly, exactly as banners and shop images do.
 * The actual compositing happens on a separate server, so the app only ever
 * needs to hand the chosen `backgroundId` onward.
 *
 * Names exist per UI language via a suffix (Kr, En, Jp, Ch, Vn, Id, Th, Ru) —
 * the same convention as {@link Shop}. Every non-Korean field is nullable and
 * is null in practice today, so `backgroundName()` falls back to Korean.
 */
export interface KioskBackground {
  /** DB `backgrounds.id` — this is the ONLY value the compose server needs. */
  backgroundId: number;
  /** Remote 9:16 preview image URL (shown directly via <img src>). */
  imageUrl: string;
  /** Ascending display order within the active set. */
  sortOrder: number;
  /** Lifecycle flag. The API filters to ACTIVE; kept so the app can too. */
  status: string;
  // Korean (always present — the canonical fallback)
  nameKr: string;
  // The other 7 UI languages, null until a translator fills them in.
  nameEn?: string | null;
  nameJp?: string | null;
  nameCh?: string | null;
  nameVn?: string | null;
  nameId?: string | null;
  nameTh?: string | null;
  nameRu?: string | null;
}
