import type { KioskScreenId } from '@shared/types/kiosk';
import type { Rect } from '@layouts/components/KioskScreenImage';
import { ARTBOARD_HEIGHT, ARTBOARD_WIDTH } from '@layouts/components/KioskScreenImage';
import type { KadaLang } from './kadaText';

/**
 * The five KADA (W202) partner screens.
 *
 * Each is a finished full-bleed 2160×3840 export rather than a component tree:
 * the body copy, the partner logo and the photographs are all painted into the
 * artwork, and there is no live data on any of them. What IS live is which
 * artwork shows — every page ships twice, English and Vietnamese, because the
 * translated copy is part of the image (see {@link KadaPage.asset}).
 *
 * Navigation is a hub and spokes, not a sequence: the home screen's five
 * orbiting badges open these pages ({@link KADA_HOME_BADGES}), and every page
 * carries a rail down its left edge listing the other four ({@link KadaPage.rail}).
 *
 * ── Figma ─────────────────────────────────────────────────────────────────
 *   AKCF  4586:90452 (vi) · 4586:90462 (en)      NIPA  4556:672  (vi) · 4586:90461 (en)
 *   PTIT  4586:90454 (vi) · 4586:90460 (en)      SKU   4586:90455 (vi) · 4586:90459 (en)
 *   WIT   4586:90457 (vi) · 4586:90458 (en)
 */

export type KadaPartner = 'akcf' | 'nipa' | 'ptit' | 'sku' | 'wit';

/**
 * A tap target measured in ARTBOARD PIXELS — the same 2160×3840 numbers Figma
 * reports, so a rect can be checked against the design by reading it, with no
 * arithmetic in between. {@link toRect} converts to the percentages Hotspot wants.
 */
export interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One entry in a page's left-hand partner rail. */
export interface KadaRailLink extends PxRect {
  to: KadaPartner;
}

export interface KadaPage {
  screen: KioskScreenId;
  partner: KadaPartner;
  /** Wordmark as drawn in the rail — also the accessible name of its hotspots. */
  label: string;
  /** Artwork base name in assets/kada, per language. */
  asset: Record<KadaLang, string>;
  /**
   * Languages whose artwork does NOT carry the partner logo bar, so the page
   * has to draw it itself.
   *
   * Nine of the ten frames bake the bar in at (170,3535); Figma node 4586:90458
   * (Page_WITGLOBAL, English) has no such group at all — verified against the
   * node, so this is a gap in the design rather than a bad export. Rather than
   * ship one page that ends differently from its own Vietnamese twin, that
   * variant gets the bar as an overlay, positioned exactly where the other
   * nine paint it. Drop the entry if the frame is ever fixed and re-exported —
   * leaving it would draw the bar twice.
   */
  missingPartnerBar?: readonly KadaLang[];
  /** The OTHER four partners, at their positions in this page's rail. */
  rail: readonly KadaRailLink[];
}

/** Artboard px → the percentage-of-artboard Rect that Hotspot positions with. */
export function toRect(r: PxRect): Rect {
  return {
    x: (r.x / ARTBOARD_WIDTH) * 100,
    y: (r.y / ARTBOARD_HEIGHT) * 100,
    w: (r.w / ARTBOARD_WIDTH) * 100,
    h: (r.h / ARTBOARD_HEIGHT) * 100,
  };
}

/**
 * The rail is NOT the same on every page — which is why these rects are
 * authored per page instead of shared.
 *
 * Figma lays the five partners along an arc down the left edge and lifts the
 * ACTIVE one out to a larger disc at ~y1200. Partners listed before it stack
 * above (y740 · y885 · y1028); partners after it drop to the bottom of the arc
 * (y2870-3230). So AKCF sits at the top of every page except its own, WIT at
 * the bottom of every page except its own, and each page's rail is a different
 * arrangement of the same five names.
 *
 * Every rect below is the union of a partner's dot and its wordmark, taken from
 * that page's Figma node. They are deliberately NOT padded: on the AKCF page the
 * SKU and WIT entries are exactly adjacent (SKU ends at y3168, WIT starts at
 * y3168), so any padding would overlap them and the wrong page would open.
 */
export const KADA_PAGES: readonly KadaPage[] = [
  {
    screen: 'kada_akcf',
    partner: 'akcf',
    label: 'AKCF',
    asset: { en: 'akcf-en', vi: 'akcf-vi' },
    rail: [
      { to: 'nipa', x: 405, y: 2711, w: 305, h: 87 },
      { to: 'ptit', x: 318, y: 2876, w: 258, h: 113 },
      { to: 'sku', x: 205, y: 3039, w: 219, h: 129 },
      { to: 'wit', x: 73, y: 3168, w: 431, h: 147 },
    ],
  },
  {
    screen: 'kada_nipa',
    partner: 'nipa',
    label: 'NIPA',
    asset: { en: 'nipa-en', vi: 'nipa-vi' },
    rail: [
      { to: 'akcf', x: 69, y: 740, w: 278, h: 87 },
      { to: 'ptit', x: 314, y: 2870, w: 258, h: 113 },
      { to: 'sku', x: 201, y: 3033, w: 219, h: 129 },
      { to: 'wit', x: 69, y: 3162, w: 431, h: 147 },
    ],
  },
  {
    screen: 'kada_ptit',
    partner: 'ptit',
    label: 'PTIT',
    asset: { en: 'ptit-en', vi: 'ptit-vi' },
    rail: [
      { to: 'akcf', x: 65, y: 740, w: 285, h: 87 },
      { to: 'nipa', x: 204, y: 885, w: 283, h: 87 },
      { to: 'sku', x: 204, y: 3033, w: 219, h: 129 },
      { to: 'wit', x: 72, y: 3162, w: 431, h: 147 },
    ],
  },
  {
    screen: 'kada_sku',
    partner: 'sku',
    label: 'SKU',
    asset: { en: 'sku-en', vi: 'sku-vi' },
    rail: [
      { to: 'akcf', x: 71, y: 740, w: 276, h: 87 },
      { to: 'nipa', x: 199, y: 885, w: 283, h: 87 },
      { to: 'ptit', x: 314, y: 1028, w: 258, h: 87 },
      { to: 'wit', x: 69, y: 3162, w: 431, h: 147 },
    ],
  },
  {
    screen: 'kada_wit',
    partner: 'wit',
    label: 'WITGLOBAL',
    asset: { en: 'wit-en', vi: 'wit-vi' },
    missingPartnerBar: ['en'],
    rail: [
      { to: 'akcf', x: 78, y: 740, w: 272, h: 87 },
      { to: 'nipa', x: 204, y: 885, w: 283, h: 87 },
      { to: 'ptit', x: 322, y: 1028, w: 264, h: 87 },
      { to: 'sku', x: 415, y: 1194, w: 246, h: 87 },
    ],
  },
];

/**
 * The five orbiting badges on the home screen, and the page each one opens.
 *
 * These are the discs from Figma group 4492:276 — the same boxes the composite
 * orbit artwork draws, so the tap target is exactly the circle the visitor sees.
 * Each wordmark is painted INSIDE its disc, so the disc alone is the whole
 * target; none of the five overlap, and none reaches the camera button below.
 */
export interface KadaHomeBadge extends PxRect {
  partner: KadaPartner;
  label: string;
}

export const KADA_HOME_BADGES: readonly KadaHomeBadge[] = [
  { partner: 'ptit', label: 'PTIT', x: 275, y: 2971, w: 250.921, h: 250.921 },
  { partner: 'akcf', label: 'AKCF', x: 603, y: 2717, w: 285.037, h: 285.037 },
  { partner: 'sku', label: 'SKU', x: 956, y: 2917, w: 250.921, h: 250.921 },
  { partner: 'nipa', label: 'NIPA', x: 1275, y: 2752, w: 285.037, h: 285.037 },
  { partner: 'wit', label: 'WIT GLOBAL', x: 1695, y: 2842, w: 250.921, h: 250.921 },
];

/** The page for a partner. Total over KadaPartner, so this cannot miss. */
export function screenForPartner(partner: KadaPartner): KioskScreenId {
  return (KADA_PAGES.find((p) => p.partner === partner) as KadaPage).screen;
}

/** Look up a page by screen id — undefined for `home` and the photo overlay. */
export function kadaPage(screen: KioskScreenId): KadaPage | undefined {
  return KADA_PAGES.find((p) => p.screen === screen);
}
