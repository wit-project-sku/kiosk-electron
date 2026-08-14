/**
 * 틀린그림찾기 (spot-the-difference) — the mini-game 제주공항 (W006) plays on the
 * touch screen while the AR 한복 photo is generating.
 *
 * ── Why the coordinates are normalized ────────────────────────────────
 * The two panels are laid out by the kiosk, not by the CMS: the artboard is a
 * fixed 2160px wide but the round's images can be any size. Storing hit spots
 * in IMAGE PIXELS would make every tap test depend on the natural size of a
 * file the renderer may not have decoded yet. So spots are stored as fractions
 * of the image box and multiplied by the rendered panel rect at tap time —
 * correct at any resolution, and testable without loading a single image.
 *
 * `r` is a fraction of the image WIDTH on purpose (not of height, and not a
 * separate rx/ry): the hit area must stay a CIRCLE, and a radius expressed
 * against height would go elliptical on any non-square image.
 */

/** One difference the player has to find. */
export interface SpotDiffSpot {
  id: string;
  /** Centre X — 0 = image left edge, 1 = image right edge. */
  x: number;
  /** Centre Y — 0 = image top edge, 1 = image bottom edge. */
  y: number;
  /** Hit radius as a fraction of the image WIDTH. See the note above. */
  r: number;
}

/** One playable round: the two pictures plus where they differ. */
export interface SpotDiffRound {
  id: string;
  /** Optional caption drawn above the panels. Null → the generic title. */
  title?: string | null;
  /** The unaltered picture (top panel). */
  originalUrl: string;
  /** The altered picture (bottom panel). */
  modifiedUrl: string;
  /**
   * width / height of BOTH images. The panels reserve their box from this
   * before the images decode, so the layout never jumps mid-game.
   */
  aspect: number;
  spots: SpotDiffSpot[];
  /**
   * True when this round is the built-in generated placeholder rather than CMS
   * content — the UI draws a small 샘플 marker so a kiosk running on fallback
   * art is obvious on site instead of looking like a design choice.
   */
  placeholder?: boolean;
}
