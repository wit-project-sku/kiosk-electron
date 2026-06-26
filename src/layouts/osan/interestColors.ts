import { AI_CATEGORIES_OSAEK } from '@renderer/data/aiCategories-osaek.generated';

/**
 * 즐길거리 chip/dot colours — taken POSITIONALLY from the Osaek Figma
 * (node 5395:129249), which colours the 6-column grid row by row:
 *   row1 #f59993×6 · row2 #f59993×3 #ffa37e×2 #82caa8×1 · row3 #82caa8×1 #a9a3d9×4 #6ea8eb×1
 *   row4 #6ea8eb×4 #6375bf×2 · row5 #6375bf×2 #c89b7b×4
 * Applied in order to our real categories so the colour pattern matches the
 * design (e.g. the green #82caa8 falls at the end of row 2 / start of row 3).
 */
const PALETTE_SEQUENCE = [
  '#f59993', '#f59993', '#f59993', '#f59993', '#f59993', '#f59993', // row 1
  '#f59993', '#f59993', '#f59993', '#ffa37e', '#ffa37e', '#82caa8', // row 2
  '#82caa8', '#a9a3d9', '#a9a3d9', '#a9a3d9', '#a9a3d9', '#6ea8eb', // row 3
  '#6ea8eb', '#6ea8eb', '#6ea8eb', '#6ea8eb', '#6375bf', '#6375bf', // row 4
  '#6375bf', '#6375bf', '#c89b7b', '#c89b7b', '#c89b7b', '#c89b7b', // row 5
];

export const DEFAULT_INTEREST_COLOR = '#6ea8eb';

/** Rendered category order (blank sheet rows dropped) — must match OsanAiSearch. */
const CATEGORIES = AI_CATEGORIES_OSAEK.filter((c) => c.ko.trim() !== '');

/** Canonical KO category name → its positional colour from the Figma sequence. */
export const INTEREST_COLOR_BY_KO: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c, i) => [c.ko, PALETTE_SEQUENCE[i] ?? DEFAULT_INTEREST_COLOR]),
);

/** Chip/dot colour for a KO category name, falling back to the default accent. */
export const interestColor = (ko: string): string =>
  INTEREST_COLOR_BY_KO[ko.trim()] ?? DEFAULT_INTEREST_COLOR;
