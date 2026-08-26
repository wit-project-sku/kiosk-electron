/**
 * Generated 틀린그림찾기 art — the round the kiosk plays when the CMS has no
 * content for it (API not wired yet, endpoint down, or a cold machine that has
 * never synced).
 *
 * ── Why generate instead of bundling two PNGs ─────────────────────────
 * A bundled pair would be ONE round: every visitor that day sees the same five
 * differences, and the second player at the kiosk already knows the answers.
 * A seeded generator gives a different scene per session for the same handful
 * of bytes, and — the part that actually matters — the spot coordinates are
 * DERIVED from the shapes that were mutated, so the hit boxes cannot drift out
 * of sync with the art the way hand-measured coordinates on a bundled image do.
 *
 * The output is two SVG data URIs. `img-src` in the production CSP already
 * allows `data:` (see core/security.ts), and SVG in an <img> cannot execute
 * script, so this adds no surface.
 *
 * This is deliberately plain geometry, not an illustration: it is a stand-in
 * that must read clearly at 2160px on a kiosk, and it flags itself in the UI
 * via `placeholder: true` so nobody mistakes it for finished artwork.
 */
import type { SpotDiffRound, SpotDiffSpot } from '@shared/types/spotDiff';

/**
 * SVG user units — deliberately the exact size of the grey plate the design
 * draws (Figma 6258:78631, 1730×872). A CMS puzzle of any ratio is letterboxed
 * inside that plate, which is correct; but the fallback is ours to choose, so
 * it is drawn to fill the plate edge to edge rather than sitting in a margin.
 */
const W = 1730;
const H = 872;

/** Keeps decorations clear of the plate's rounded corners. */
const MARGIN = 130;

/** Jitter applied to a grid cell, as a fraction of the cell. See `scatter`. */
const JITTER = 0.1;

/** How many differences a generated round carries. */
const SPOT_COUNT = 5;

/**
 * Hit radius, as a fraction of image width. 0.055 → 66 user units here, and
 * ~119 physical px on the 2160-wide artboard: comfortably bigger than a
 * fingertip, which is the whole point on a touch kiosk.
 */
const SPOT_RADIUS = 0.055;

/** Deterministic PRNG — same seed, same scene, on every process and monitor. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 제주 palette — sea/sky blues, 감귤 orange, 현무암 basalt grey. */
const TANGERINE = ['#ff9f1c', '#ffb703', '#f97316'];
const LEAF = ['#2a9d8f', '#3d8b6b', '#48a37a'];
const BASALT = ['#4a4a4a', '#5c5c5c', '#3f3f3f'];

interface Decor {
  /** Centre, in SVG user units. */
  cx: number;
  cy: number;
  svg: (mutated: boolean) => string;
}

/**
 * One scattered decoration. `mutated` renders the "wrong" variant used in the
 * bottom panel — every kind changes in a way that survives a 2160px downscale
 * (colour swap, size jump, or gone entirely); subtle rotations do not.
 */
function tangerine(rnd: () => number, cx: number, cy: number): Decor {
  const r = 50 + Math.floor(rnd() * 20);
  const fill = TANGERINE[Math.floor(rnd() * TANGERINE.length)];
  const altFill = LEAF[Math.floor(rnd() * LEAF.length)];
  const mode = Math.floor(rnd() * 3);
  return {
    cx,
    cy,
    svg: (mutated) => {
      // 0 = disappears, 1 = changes colour, 2 = changes size.
      if (mutated && mode === 0) return '';
      const rr = mutated && mode === 2 ? Math.round(r * 1.55) : r;
      const f = mutated && mode === 1 ? altFill : fill;
      return (
        `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="${f}"/>` +
        `<path d="M${cx} ${cy - rr} q ${rr * 0.5} ${-rr * 0.45} ${rr * 0.85} ${-rr * 0.1} ` +
        `q ${-rr * 0.45} ${rr * 0.5} ${-rr * 0.85} ${rr * 0.1} z" fill="#2a9d8f"/>`
      );
    },
  };
}

function stone(rnd: () => number, cx: number, cy: number): Decor {
  const w = 66 + Math.floor(rnd() * 36);
  const h = 42 + Math.floor(rnd() * 28);
  const fill = BASALT[Math.floor(rnd() * BASALT.length)];
  const gone = rnd() < 0.5;
  return {
    cx,
    cy,
    svg: (mutated) => {
      if (mutated && gone) return '';
      const hh = mutated && !gone ? Math.round(h * 1.7) : h;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${w}" ry="${hh}" fill="${fill}"/>`;
    },
  };
}

function cloud(rnd: () => number, cx: number, cy: number): Decor {
  const s = 1.15 + rnd() * 0.5;
  const gone = rnd() < 0.4;
  return {
    cx,
    cy,
    svg: (mutated) => {
      if (mutated && gone) return '';
      const k = mutated && !gone ? s * 1.45 : s;
      return (
        `<g fill="#ffffff" opacity="0.94">` +
        `<ellipse cx="${cx}" cy="${cy}" rx="${Math.round(64 * k)}" ry="${Math.round(30 * k)}"/>` +
        `<ellipse cx="${cx - 44 * k}" cy="${cy + 8 * k}" rx="${Math.round(40 * k)}" ry="${Math.round(22 * k)}"/>` +
        `<ellipse cx="${cx + 46 * k}" cy="${cy + 9 * k}" rx="${Math.round(38 * k)}" ry="${Math.round(21 * k)}"/>` +
        `</g>`
      );
    },
  };
}

function sail(rnd: () => number, cx: number, cy: number): Decor {
  const fill = rnd() < 0.5 ? '#e63946' : '#ffffff';
  const alt = fill === '#e63946' ? '#ffffff' : '#e63946';
  const gone = rnd() < 0.35;
  return {
    cx,
    cy,
    svg: (mutated) => {
      if (mutated && gone) return '';
      const f = mutated && !gone ? alt : fill;
      return (
        `<path d="M${cx} ${cy - 66} L${cx + 57} ${cy + 37} L${cx - 57} ${cy + 37} z" fill="${f}"/>` +
        `<rect x="${cx - 77}" y="${cy + 37}" width="154" height="24" rx="11" fill="#264653"/>`
      );
    },
  };
}

const BUILDERS = [tangerine, stone, cloud, sail];

/** Horizon, in user units. The sea starts here. */
const SEA_Y = 545;

/** The fixed backdrop — 하늘 / 바다 / 한라산. Identical in both panels. */
function backdrop(): string {
  return (
    `<rect width="${W}" height="${H}" fill="#bfe6f5"/>` +
    `<circle cx="${W - 215}" cy="140" r="86" fill="#ffd166"/>` +
    `<path d="M0 ${SEA_Y} L430 250 L680 400 L925 205 L1300 ${SEA_Y} z" fill="#7fa88f"/>` +
    `<path d="M925 205 L1010 255 L838 255 z" fill="#f1faee"/>` +
    `<rect y="${SEA_Y}" width="${W}" height="${H - SEA_Y}" fill="#4a90b8"/>` +
    `<path d="M0 ${SEA_Y} h${W} v34 H0 z" fill="#5aa3c9"/>`
  );
}

/**
 * Minimum gap between two MUTATED shapes, in user units, measured centre to
 * centre. Two hit circles that touch make the round feel broken — the tap in
 * the overlap goes to whichever difference the code prefers, and the player
 * gets no feedback on the other. 15% clearance on top of the two radii.
 */
const MIN_SPOT_GAP = SPOT_RADIUS * 2 * 1.05 * W;

/**
 * Scatter positions on a jittered grid rather than pure random.
 *
 * ★ The grid is DERIVED, not hardcoded. An earlier fixed 4×3 grid with ±25%
 * jitter let two neighbouring cells close to inside `MIN_SPOT_GAP`, and about
 * 1 seed in 200 produced a pair of touching differences — a difference you
 * cannot cleanly claim once its neighbour is found. Sizing the cell so that
 * even worst-case jitter leaves `MIN_SPOT_GAP` between neighbours makes that
 * structural instead of lucky, and it re-derives itself if the canvas, the
 * radius or the spot count ever change. `pickSpotCells` still re-checks.
 */
function scatter(rnd: () => number, wanted: number): Array<{ x: number; y: number }> {
  const usableW = W - MARGIN * 2;
  const usableH = H - MARGIN * 2;
  // Worst case, two neighbours are cell * (1 - 2*JITTER) apart.
  const minCell = MIN_SPOT_GAP / (1 - 2 * JITTER);
  const cols = Math.max(1, Math.floor(usableW / minCell));
  const rows = Math.max(1, Math.floor(usableH / minCell));
  const cellW = usableW / cols;
  const cellH = usableH / rows;

  const cells: Array<{ x: number; y: number }> = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lo = 0.5 - JITTER;
      cells.push({
        x: Math.round(MARGIN + c * cellW + cellW * (lo + rnd() * JITTER * 2)),
        y: Math.round(MARGIN + r * cellH + cellH * (lo + rnd() * JITTER * 2)),
      });
    }
  }
  const count = Math.min(wanted, cells.length);
  // Fisher–Yates so the mutated shapes aren't always the top-left ones.
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const a = cells[i];
    const b = cells[j];
    if (a && b) {
      cells[i] = b;
      cells[j] = a;
    }
  }
  return cells.slice(0, count);
}

/**
 * Choose which decorations get mutated, rejecting any candidate that sits within
 * `MIN_SPOT_GAP` of one already chosen.
 *
 * The tightened jitter in `scatter` already guarantees the spacing, so this
 * normally accepts the first SPOT_COUNT it sees. It stays because it is the
 * thing that makes the guarantee CHECKED rather than argued: change the grid,
 * the count or the radius, and a bad round is silently dropped to four
 * differences instead of shipping two the player cannot tell apart.
 */
function pickSpotCells(decor: Decor[]): Set<number> {
  const chosen = new Set<number>();
  for (let i = 0; i < decor.length && chosen.size < SPOT_COUNT; i += 1) {
    const cand = decor[i];
    if (!cand) continue;
    let clear = true;
    for (const j of chosen) {
      const other = decor[j];
      if (!other) continue;
      const dx = cand.cx - other.cx;
      const dy = cand.cy - other.cy;
      if (Math.sqrt(dx * dx + dy * dy) < MIN_SPOT_GAP) {
        clear = false;
        break;
      }
    }
    if (clear) chosen.add(i);
  }
  return chosen;
}

function toDataUri(body: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    body +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Build one playable round. `seed` makes it reproducible — the service passes a
 * per-session value so consecutive visitors get different scenes.
 */
export function buildPlaceholderRound(seed: number): SpotDiffRound {
  const rnd = mulberry32(seed);

  // More decorations than differences: if every shape changed, the player could
  // win by tapping anything, and the round would stop being a game.
  const decorCount = SPOT_COUNT + 7;
  const positions = scatter(rnd, decorCount);
  const decor = positions.map((p) => {
    const build = BUILDERS[Math.floor(rnd() * BUILDERS.length)] ?? tangerine;
    return build(rnd, p.x, p.y);
  });

  // `scatter` already shuffled, so walking it in order is an unbiased pick; the
  // spacing guard is what decides whether a candidate is usable.
  const mutatedIdx = pickSpotCells(decor);

  const original = backdrop() + decor.map((d) => d.svg(false)).join('');
  const modified =
    backdrop() + decor.map((d, i) => d.svg(mutatedIdx.has(i))).join('');

  const spots: SpotDiffSpot[] = [...mutatedIdx].flatMap((i) => {
    const d = decor[i];
    if (!d) return [];
    return [{ id: `spot-${i}`, x: d.cx / W, y: d.cy / H, r: SPOT_RADIUS }];
  });

  return {
    id: `placeholder-${seed}`,
    title: null,
    originalUrl: toDataUri(original),
    modifiedUrl: toDataUri(modified),
    aspect: W / H,
    spots,
    placeholder: true,
  };
}
