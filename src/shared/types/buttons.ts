/**
 * A kiosk home button as returned by the button-layout API
 * (`GET /api/kiosks/{kioskId}/buttons`).
 *
 * The renderer only needs `id` + `line`/`position` to place the home tiles by
 * ordering (icons stay local, labels stay sheet-driven). The layout response is
 * lean — `id`, `line`, `position`, `span` — and identifies each button by its DB
 * `id`. The richer fields below appear in the fuller admin variant of the
 * response and are kept optional so either shape parses.
 */
export interface KioskButton {
  /** DB `buttons.id` — the stable join key to a home tile (via buttonCatalog). */
  id: number;
  /** Grid row (1-based: line 1 = the info/weather row, 2 = the search row, …). */
  line: number;
  /** Grid column within the row (1-based). */
  position: number;
  /** Column span (2 = the wide tile); may be null in some responses. */
  span: number | null;

  // ── Optional (present only in the fuller admin response shape) ──
  buttonType?: string;
  buttonName?: string;
  kioskName?: string;
  iconKey?: string | null;
  status?: string;
  placement?: string;
  imageUrl?: string | null;
  totalClicks?: number;
  totalDuration?: number;
}
