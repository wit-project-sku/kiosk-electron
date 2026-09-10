/**
 * The one 베리어프리 (♿ low-reach) measurement every 제주 screen shares.
 *
 * ── Why this is a module and not three CSS literals ─────────────────────────
 * The orange "지금은 배리어프리 모드입니다." bar is drawn by THREE different files
 * — JejuHome, JejuPageFrame (15 sub-pages) and JejuHanbokSelect — and it had
 * drifted: 191px on the home screen against 113px everywhere else, which is the
 * mismatch this replaces. Worse, the bar's height is not just its own: it is the
 * origin every low-reach page stacks off, so each of those files ALSO carried
 * the number a second time, baked into a derived offset (`113 + 573 = 686`,
 * `113 + 959 = 1072`, a header at a flush `113`). Changing the height without
 * changing those in step slides the bar over the header underneath it.
 *
 * So the height lives here once, and everything that touches the bar derives
 * from it — the CSS through {@link modeBarVars} (`--jeju-mode-bar`, read by the
 * three `.modeBar` rules and their `calc()` neighbours), the per-page header and
 * body offsets through {@link belowModeBar}. Re-measure the bar and the whole
 * low-reach stack follows.
 *
 * These are Figma px on the 2160×3840 artboard, where 1 CSS px = 1 Figma px
 * (see KioskArtboard) — so the fraction is not spurious precision, it is the
 * frame's own number and it survives the artboard scale.
 */
import type { CSSProperties } from 'react';

/** Height of the 베리어프리 mode bar. Full-bleed 2160 wide, pinned to y0. */
export const MODE_BAR_HEIGHT = 145.759;

/** The 573px promo banner some low-reach pages keep, flush under the bar. */
export const LOW_REACH_BANNER_HEIGHT = 573;

/** The 959px 제주모하지 hero, flush under the bar on the AI-search shape. */
export const LOW_REACH_HERO_HEIGHT = 959;

/**
 * A y coordinate `gap` px below the bottom edge of the mode bar.
 *
 * Every low-reach `lowReachShift` / `lowReachBodyShift` that sits ON the bar
 * goes through here, so the offsets stay welded to the bar's height instead of
 * being independently-measured numbers that agree by luck. The `gap` is what
 * the page's own frame draws between the two — usually 0 (flush), and the
 * banner/hero heights for the pages that keep one.
 */
export const belowModeBar = (gap = 0): number => MODE_BAR_HEIGHT + gap;

/**
 * `--jeju-mode-bar` for a low-reach root, so the CSS modules can size the bar
 * and place what sits under it without repeating the number.
 *
 * Spread onto the root element's `style`; inline beats every class, which is
 * the same way JejuPageFrame already lands its `--jeju-shift`.
 */
export const modeBarVars = { '--jeju-mode-bar': `${MODE_BAR_HEIGHT}px` } as CSSProperties;
