/**
 * 제주 달리기's runner: the kiosk's character photo, cut up and puppeted.
 *
 * ══ WHAT THIS IS ═════════════════════════════════════════════════════
 * Classic cutout (paper-doll) rigging. One photograph of her standing still is
 * sliced into head, torso, forearm, thigh and shin; each slice is rotated about
 * a joint; the slices are drawn in order down a small bone hierarchy. Four
 * hand-authored keyframes are interpolated to make a run cycle, and separate
 * poses cover the crouch, the jump and the crash.
 *
 * It replaces a hand-drawn pixel figure, which is kept as the fallback below —
 * the pixel one animates more freely, but it can only ever be A girl in a blue
 * top. This one is HER, which is the entire point.
 *
 * ── Why the photo is not simply blitted ───────────────────────────────
 * Because the source is a standing side profile and the game needs poses. A
 * whole-image sprite slides along the ground without moving its legs, which
 * reads as a broken game rather than a character, and no photograph of her
 * crouching under a seagull exists.
 *
 * ══ THE THREE THINGS THAT MAKE A CUTOUT RIG LOOK WRONG ════════════════
 * All three are dealt with here, and all three come straight back if the
 * numbers below are edited casually.
 *
 *  1. TEARING AT THE JOINTS. Slices that merely meet will separate the moment
 *     one rotates, opening a transparent wound at the knee. Every cut in
 *     {@link SLICES} therefore OVERLAPS its neighbour by 60–100 photo px, and
 *     the child is drawn over the parent so the seam is always hidden inside
 *     solid pixels.
 *
 *  2. THE HOLE THE ARM LEAVES. Her forearm hangs over her thigh. Cut it out and
 *     swing it and you see straight through her leg. So the body is drawn from
 *     a CLEAN PLATE — a copy of the photo with the forearm erased and the denim
 *     behind it reconstructed (see {@link buildCleanPlate}) — while the forearm
 *     itself is cut with a skin mask from the untouched original.
 *
 *  3. FEET THAT FLOAT OR SINK. Bending the legs makes the figure shorter, so a
 *     rig pinned at the hip pumps up and down through the floor. Instead the
 *     pose is solved first and the whole figure is then dropped so that its
 *     LOWEST foot rests exactly on the ground line — see {@link solve}. The
 *     vertical bob of the run is a consequence of that, not an animation
 *     channel somebody has to keep in sync.
 *
 * ── Privacy and weight ────────────────────────────────────────────────
 * One 640 KB asset, bundled. Nothing is fetched at runtime. The work canvases
 * are built once per renderer and shared by every run.
 */
import runnerPhoto from '@renderer/assets/photos/jeju/runner/runner-side.png';

/**
 * Joints, measured off the photo in its own pixels.
 *
 * ══ THESE ARE MEASUREMENTS, NOT PREFERENCES ═══════════════════════════
 * They were read off the image — the silhouette's per-row extent for the
 * crown, hem and sole, a skin-colour pass for the forearm, and a gridded crop
 * for the rest. If the asset is ever re-exported, re-measure; nudging these to
 * "look right" against a different photo is how a rig quietly stops matching
 * its own artwork.
 *
 * `crown` and `ground` are the figure's true extent, and the ratio between them
 * is what sets the scale — she is drawn DINO_H tall from sole to hair.
 */
const PHOTO = {
  w: 937,
  h: 1678,
  /** Topmost opaque pixel: the top of her hair. */
  crown: 68,
  /** Bottommost opaque pixel: the sole of the front trainer. */
  ground: 1661,
  neck: { x: 505, y: 336 },
  /** Where the forearm is treated as hinging. See the note in SLICES.fore. */
  elbow: { x: 455, y: 752 },
  hip: { x: 455, y: 790 },
  knee: { x: 452, y: 1175 },
  ankle: { x: 450, y: 1558 },
} as const;

/**
 * Horizontal cuts, in photo px, with the overlap that stops joints tearing.
 *
 * Only horizontal cuts, deliberately: a hand-traced outline per limb would be
 * more accurate and is not worth it at the size she is drawn, and every hand
 * cut is a silhouette that can go wrong on a re-export. The one exception is
 * the forearm, which is masked by skin colour because it has to be lifted off
 * the denim behind it.
 */
const SLICES = {
  /** Crown to below the jaw. Overlaps the torso's collar. */
  head: { y0: 0, y1: 380 },
  /** Shoulders to below the seat, so a leg swing never exposes the hip. */
  torso: { y0: 300, y1: 900 },
  /** Hip to below the knee. */
  thigh: { y0: 770, y1: 1250 },
  /** Knee to the floor, trainer included. */
  shin: { y0: 1140, y1: 1678 },
  /**
   * Below the waistband to her fingertips.
   *
   * It starts at the waistband rather than at the true elbow on purpose. Above
   * that line the sleeve is the same pale blue as the top and cannot be
   * separated from it by colour, and her bare MIDRIFF sits immediately beside
   * the arm — a skin mask taken any higher erases her waist. So the sleeve
   * stays welded to the torso, the bare forearm is the part that swings, and it
   * hinges at the top edge of its own slice, which is also why swinging it
   * cannot open a gap.
   */
  fore: { y0: 745, y1: 1035 },
} as const;

/**
 * How far down her leg the replacement denim is cloned from, in photo px.
 *
 * Far enough that the donor is entirely BELOW the arm — otherwise the patch
 * would copy the arm onto itself — and not so far that it reaches the hem,
 * where the fabric breaks over her trainers. Her fingertips end at 1035 and the
 * turn-up starts around 1560, so a 300px drop lands the donor for every row
 * squarely in clean thigh.
 */
const CLONE_DROP = 300;

/**
 * Figure height at the working resolution, in px.
 *
 * Twice the size she is finally drawn. Rotating a 1593px-tall photograph seven
 * times a frame is real work on a kiosk with no discrete GPU, and none of that
 * resolution survives being drawn at 330px — so the plate is built once at 2×
 * and every transform afterwards is cheap. 2× rather than 1× because the parts
 * are rotated, and rotation of an already-final-size bitmap is visibly soft.
 */
const WORK_H = 660;

/** Photo px → work px. */
const K = WORK_H / (PHOTO.ground - PHOTO.crown);

/** A joint in work-canvas coordinates. */
interface Point {
  x: number;
  y: number;
}

const w = (p: { x: number; y: number }): Point => ({ x: p.x * K, y: p.y * K });

/** Everything the draw path needs, built once. */
export interface RunnerRig {
  /** The body, with the forearm erased and the denim behind it rebuilt. */
  plate: HTMLCanvasElement;
  /** The same, darkened — the far arm and far leg are drawn from this. */
  plateFar: HTMLCanvasElement;
  /** The bare forearm and hand, lifted off the denim by a skin mask. */
  fore: HTMLCanvasElement;
  /** The forearm again, darkened, for her far arm. */
  foreFar: HTMLCanvasElement;
  /** Work-space height of the whole figure. */
  height: number;
}

let rigPromise: Promise<RunnerRig | null> | null = null;

/**
 * Is this pixel unmistakably the denim behind her arm?
 *
 * ══ THE MASK ASKS THE OPPOSITE QUESTION ON PURPOSE ════════════════════
 * Two attempts at "is this skin?" both failed, and they failed the same way.
 * Skin has an enormous range inside one photograph — her lit forearm is near
 * white, her fingers are in shadow, and every pixel along the arm's edge is
 * some blend of skin and denim. Any threshold tight enough to exclude denim
 * excluded half the arm as well, and the leftovers were catastrophic: the
 * unmasked rim became the nearest "background" pixel beside the hole, so the
 * patch sampled it and smeared dark skin across her thigh, and the shadowed
 * fingers survived as a brown blob on her leg.
 *
 * DENIM, by contrast, has one reliable property that nothing on her arm shares:
 * it is blue-dominant. Every shade of it, lit or shadowed, has more blue than
 * red. So the region is found by flooding OUT from the arm and stopping at
 * anything clearly blue — which lets shadow, highlight and every anti-aliased
 * in-between pixel come along for free, because none of them has to pass a test
 * of its own.
 *
 * The flood also cannot escape: the band is bounded above by the waistband and
 * below by her fingertips, denim walls it on both sides, and transparency walls
 * the outside of her leg.
 */
function isDenim(r: number, b: number, a: number): boolean {
  return a > 120 && b > r + 6;
}

/**
 * Build the body plate: the photo with her forearm removed and the denim behind
 * it reconstructed, plus the forearm itself on its own transparent canvas.
 *
 * ══ HOW THE HOLE IS FILLED, AND TWO WAYS THAT DID NOT WORK ════════════
 * It is CLONED from the same trouser leg, {@link CLONE_DROP} px further down,
 * and relit to match the row it lands on.
 *
 * The two rejected attempts are worth recording, because both look correct
 * described in a sentence and both were obvious on the sprite:
 *
 *  · A colour RAMP between the denim on the left of the hole and the denim on
 *    the right. Perfectly denim-coloured, and unmistakably a blurred rectangle
 *    pasted onto her thigh — because denim is texture, and a smooth gradient
 *    has none.
 *  · A MIRROR of the fabric either side, folded inward. That carries texture,
 *    but the hole is as wide as her hand, so reflecting it that far to the left
 *    reaches her back POCKET and folds the pocket and its stitching into the
 *    middle of her thigh. It traded a blur for a dark blob.
 *
 * Both failed the same way: they looked for replacement fabric ACROSS the leg,
 * where a trouser leg changes fastest — seam, pocket, and the shading from back
 * to front all happen horizontally. Along the leg it barely changes at all. So
 * the clone comes from straight below, where the denim is the same weave, the
 * same wash and the same distance around the leg; only the lighting drifts, and
 * that is corrected per row against the fabric actually bordering the hole.
 */
function buildCleanPlate(
  img: HTMLImageElement,
): { plate: HTMLCanvasElement; fore: HTMLCanvasElement } | null {
  const cw = Math.round(PHOTO.w * K);
  const ch = Math.round(PHOTO.h * K);

  const plate = document.createElement('canvas');
  plate.width = cw;
  plate.height = ch;
  const pctx = plate.getContext('2d', { willReadFrequently: true });

  const fore = document.createElement('canvas');
  fore.width = cw;
  fore.height = ch;
  const fctx = fore.getContext('2d');
  if (!pctx || !fctx) return null;

  pctx.drawImage(img, 0, 0, cw, ch);

  const y0 = Math.max(0, Math.round(SLICES.fore.y0 * K));
  const y1 = Math.min(ch, Math.round(SLICES.fore.y1 * K));
  const rows = y1 - y0;
  if (rows <= 0) return null;

  const band = pctx.getImageData(0, y0, cw, rows);
  const src = band.data;

  // ── 1. Seed: the warmest, brightest pixel in the band ──
  // Found rather than hard-coded, so a re-exported asset that shifts by a few
  // pixels still seeds inside the arm instead of inside her jeans.
  let seed = -1;
  let bestWarmth = 12;
  for (let n = 0; n < cw * rows; n += 1) {
    const i = n * 4;
    if (src[i + 3]! < 200) continue;
    const warmth = src[i]! - src[i + 2]!;
    if (warmth > bestWarmth) {
      bestWarmth = warmth;
      seed = n;
    }
  }
  if (seed < 0) return null;

  // ── 2. Flood the arm ──
  const mask = new Uint8Array(cw * rows);
  const stack = [seed];
  mask[seed] = 1;
  while (stack.length > 0) {
    const n = stack.pop()!;
    const x = n % cw;
    const y = (n / cw) | 0;
    for (let k = 0; k < 4; k += 1) {
      const nx = x + (k === 0 ? -1 : k === 1 ? 1 : 0);
      const ny = y + (k === 2 ? -1 : k === 3 ? 1 : 0);
      if (nx < 0 || ny < 0 || nx >= cw || ny >= rows) continue;
      const m = ny * cw + nx;
      if (mask[m]) continue;
      const i = m * 4;
      if (src[i + 3]! < 110) continue;
      if (isDenim(src[i]!, src[i + 2]!, src[i + 3]!)) continue;
      mask[m] = 1;
      stack.push(m);
    }
  }

  // ── 3. Lift the arm before the plate is disturbed ──
  const armBand = fctx.createImageData(cw, rows);
  const arm = armBand.data;
  for (let n = 0; n < cw * rows; n += 1) {
    if (!mask[n]) continue;
    const i = n * 4;
    arm[i] = src[i]!;
    arm[i + 1] = src[i + 1]!;
    arm[i + 2] = src[i + 2]!;
    arm[i + 3] = src[i + 3]!;
  }

  // ── 4. Widen the mask for the ERASE only ──
  // The lift wants the arm's true edge; the patch wants to cover one ring more
  // than that, because the outermost blended pixels are half denim and reading
  // them as background is what leaves a pink halo where the arm used to be.
  const wide = new Uint8Array(mask);
  const R = 2;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cw; x += 1) {
      if (!mask[y * cw + x]) continue;
      for (let dy = -R; dy <= R; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= rows) continue;
        for (let dx = -R; dx <= R; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= cw) continue;
          wide[yy * cw + xx] = 1;
        }
      }
    }
  }

  // ── 5. Clone clean denim over each run, relit to match ──
  //
  // The donor is read from the FULL plate, not the band, because it lives below
  // the band entirely. It is sampled before any patching so a later row can
  // never clone a patch of its own.
  const donor = pctx.getImageData(0, 0, cw, ch).data;
  const drop = Math.round(CLONE_DROP * K);

  for (let row = 0; row < rows; row += 1) {
    const base = row * cw;
    const donorRow = Math.min(ch - 1, y0 + row + drop);

    let x = 0;
    while (x < cw) {
      if (!wide[base + x]) {
        x += 1;
        continue;
      }
      let end = x;
      while (end < cw && wide[base + end]) end += 1;

      // ── Relight ──
      // The donor is a hand's length further down her leg and is lit slightly
      // differently. Comparing the two at the pixels immediately bordering the
      // hole gives the correction, so the clone arrives already the right
      // brightness and leaves no step at the seam.
      let gain = 1;
      let nTarget = 0;
      let tSum = 0;
      let dSum = 0;
      for (const probe of [x - 1, end]) {
        if (probe < 0 || probe >= cw) continue;
        const ti = (base + probe) * 4;
        const di = (donorRow * cw + probe) * 4;
        if (src[ti + 3]! < 120 || donor[di + 3]! < 120) continue;
        tSum += src[ti]! + src[ti + 1]! + src[ti + 2]!;
        dSum += donor[di]! + donor[di + 1]! + donor[di + 2]!;
        nTarget += 1;
      }
      if (nTarget > 0 && dSum > 1) {
        // Clamped: a wild correction means the probe landed on a seam or a
        // shadow, and a plausible patch beats a faithful one.
        gain = Math.max(0.75, Math.min(1.33, tSum / dSum));
      }

      for (let k = x; k < end; k += 1) {
        const i = (base + k) * 4;
        const di = (donorRow * cw + k) * 4;
        if (donor[di + 3]! > 120) {
          src[i] = donor[di]! * gain;
          src[i + 1] = donor[di + 1]! * gain;
          src[i + 2] = donor[di + 2]! * gain;
          src[i + 3] = 255;
          continue;
        }
        // The donor row is off the edge of her leg here — fall back to the
        // nearest fabric on this row, which is always denim of some sort.
        const fi =
          x > 0 && src[(base + x - 1) * 4 + 3]! > 120
            ? (base + x - 1) * 4
            : end < cw && src[(base + end) * 4 + 3]! > 120
              ? (base + end) * 4
              : -1;
        if (fi < 0) {
          src[i + 3] = 0;
          continue;
        }
        src[i] = src[fi]!;
        src[i + 1] = src[fi + 1]!;
        src[i + 2] = src[fi + 2]!;
        src[i + 3] = 255;
      }
      x = end;
    }
  }

  pctx.putImageData(band, 0, y0);
  fctx.putImageData(armBand, 0, y0);
  return { plate, fore };
}

/** Copy onto a plain canvas, leaving any readback hint behind. */
function detach(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  out.getContext('2d')?.drawImage(source, 0, 0);
  return out;
}

/** A darkened copy, for the limbs on her far side. */
function darken(source: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
  // Multiply keeps the garment's own texture and only removes light, which is
  // what a limb behind a body actually looks like. `source-atop` confines it to
  // the pixels that exist, so the transparent surround stays transparent.
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = `rgba(46, 50, 60, ${amount})`;
  ctx.fillRect(0, 0, out.width, out.height);
  return out;
}

/**
 * Load and cut the photo. Resolves null if anything fails — the caller draws
 * the pixel runner instead, which is why nothing here throws.
 *
 * Cached at module level: a visitor who plays, exits and plays again must not
 * pay for the decode and the plate twice.
 */
export function loadRunnerRig(): Promise<RunnerRig | null> {
  rigPromise ??= new Promise<RunnerRig | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const built = buildCleanPlate(img);
        if (!built) {
          resolve(null);
          return;
        }
        resolve({
          // Copied off the readback canvas: `willReadFrequently` is what makes
          // getImageData cheap during the build and what would make this a
          // SOFTWARE surface for the sixty drawImages a second that follow.
          plate: detach(built.plate),
          plateFar: darken(built.plate, 0.22),
          fore: detach(built.fore),
          // Lighter than the far LEG: an arm swung clear of her body catches
          // the same light her near one does, and a heavily shaded one reads as
          // a smudge rather than a limb.
          foreFar: darken(built.fore, 0.13),
          height: WORK_H,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = runnerPhoto;
  });
  return rigPromise;
}

// ── Poses ─────────────────────────────────────────────────────────────

/**
 * One pose, in degrees.
 *
 * ══ THE SIGN DEPENDS ON WHICH WAY THE PART HANGS ══════════════════════
 * Positive is clockwise on the canvas, always. What that MEANS flips with the
 * part, because rotation is about a joint and the part is either above it or
 * below it:
 *
 *   · `torso` and `head` extend UPWARD from their joints, so positive pitches
 *     them FORWARD, into the run.
 *   · the thighs, shins and forearm hang DOWNWARD, so positive swings them
 *     BACKWARD.
 *
 * Getting this backwards is not subtle and it is not obvious from the numbers:
 * the first crouch here had a negative torso and she reclined into an invisible
 * armchair, feet forward, while every leg angle was correct.
 *
 * Every angle is relative to its parent, so a shin of 0 is a straight leg and
 * +40 is a heel tucked up behind the knee.
 */
interface Pose {
  torso: number;
  head: number;
  /** Her near forearm, and her far one — they swing in opposition. */
  fore: number;
  foreFar: number;
  nearThigh: number;
  nearShin: number;
  farThigh: number;
  farShin: number;
}

/**
 * The run cycle, as four keyframes interpolated continuously.
 *
 * Four rather than the two the pixel sprite used, because a photograph cannot
 * hide behind stylisation: a two-frame flip of a real person reads as a
 * glitch, where the same two-frame flip of a blocky figure reads as a style.
 *
 * The cycle is the standard one — contact, passing, contact, passing — with the
 * legs half a cycle apart, and the arms in opposition to the legs on the same
 * side, which is what human running does and what makes it read even at this
 * size.
 */
const RUN: Pose[] = [
  // 0.00 — near foot strikes, far leg trailing behind.
  {
    torso: 17,
    head: -12,
    fore: 42,
    foreFar: -34,
    nearThigh: -24,
    nearShin: 12,
    farThigh: 28,
    farShin: 46,
  },
  // 0.25 — near leg drives under her, far knee swinging through.
  {
    torso: 19,
    head: -13,
    fore: 8,
    foreFar: 6,
    nearThigh: 6,
    nearShin: 42,
    farThigh: -6,
    farShin: 14,
  },
  // 0.50 — mirror of 0: far foot strikes.
  {
    torso: 17,
    head: -12,
    fore: -34,
    foreFar: 42,
    nearThigh: 28,
    nearShin: 46,
    farThigh: -24,
    farShin: 12,
  },
  // 0.75 — mirror of 0.25.
  {
    torso: 19,
    head: -13,
    fore: 6,
    foreFar: 8,
    nearThigh: -6,
    nearShin: 14,
    farThigh: 6,
    farShin: 42,
  },
];

/**
 * The crouch.
 *
 * The hardest pose to reach from a standing photograph, and the one the game
 * most needs to be unmistakable: a visitor has a fraction of a second to see
 * that she got under the gull. Hips dropped, thighs swung right forward, shins
 * folded back under her, torso pitched down over the knees.
 *
 * Her crown has to finish clear of the `bird_duck` band — see the note on
 * DUCK_H in runEngine. That is checked by where the head ENDS UP, so changing
 * any of the three leg angles below changes it.
 */
const DUCK: Pose = {
  torso: 74,
  head: -52,
  fore: -46,
  foreFar: -38,
  nearThigh: -104,
  nearShin: 118,
  farThigh: -96,
  farShin: 126,
};

/** Airborne: legs tucked, torso open. */
const JUMP: Pose = {
  torso: 20,
  head: -14,
  fore: -24,
  foreFar: 18,
  nearThigh: -34,
  nearShin: 54,
  farThigh: 22,
  farShin: 62,
};

/** Crashed: both feet down, everything still. Nothing here may read as motion. */
const DEAD: Pose = {
  torso: -5,
  head: 3,
  fore: 4,
  foreFar: -2,
  nearThigh: 0,
  nearShin: 0,
  farThigh: -3,
  farShin: 0,
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function blend(a: Pose, b: Pose, t: number): Pose {
  return {
    torso: lerp(a.torso, b.torso, t),
    head: lerp(a.head, b.head, t),
    fore: lerp(a.fore, b.fore, t),
    foreFar: lerp(a.foreFar, b.foreFar, t),
    nearThigh: lerp(a.nearThigh, b.nearThigh, t),
    nearShin: lerp(a.nearShin, b.nearShin, t),
    farThigh: lerp(a.farThigh, b.farThigh, t),
    farShin: lerp(a.farShin, b.farShin, t),
  };
}

export type RunnerState = 'run' | 'duck' | 'jump' | 'dead';

function poseFor(state: RunnerState, phase: number): Pose {
  if (state === 'duck') return DUCK;
  if (state === 'jump') return JUMP;
  if (state === 'dead') return DEAD;
  const p = ((phase % 1) + 1) % 1;
  const scaled = p * RUN.length;
  const i = Math.floor(scaled) % RUN.length;
  return blend(RUN[i]!, RUN[(i + 1) % RUN.length]!, scaled - i);
}

const RAD = Math.PI / 180;

/** Rotate `point` about `pivot` by `deg`. */
function turn(point: Point, pivot: Point, deg: number): Point {
  const a = deg * RAD;
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return {
    x: pivot.x + dx * Math.cos(a) - dy * Math.sin(a),
    y: pivot.y + dx * Math.sin(a) + dy * Math.cos(a),
  };
}

/**
 * Heel, arch and toe, in photo x. The sole is not a point.
 *
 * Solving on the ankle alone was not enough: a trainer is 260 photo px long and
 * the ankle sits near its back, so any pose that pitches the foot forward buries
 * the TOE below the ground line while the solver happily reports the arch
 * resting on it. On the crouch that was 14px of shoe through the floor.
 */
const SOLE_X = [392, 450, 612] as const;

/**
 * How low a leg's sole reaches, in work space.
 *
 * Solved rather than drawn, so the figure can be dropped onto the ground line
 * before a single pixel is committed — see the third failure mode in the header.
 */
function soleOf(thigh: number, shin: number): number {
  const hip = w(PHOTO.hip);
  const knee = w(PHOTO.knee);
  let lowest = -Infinity;
  for (const sx of SOLE_X) {
    const sole = { x: sx * K, y: PHOTO.ground * K };
    // Mirrors exactly what the canvas does when the slices are nested: the shin
    // is turned about the UNROTATED knee first, and the thigh's turn about the
    // hip is then applied to the result. Solving it any other way puts her feet
    // somewhere the drawing does not.
    lowest = Math.max(lowest, turn(turn(sole, knee, shin), hip, thigh).y);
  }
  return lowest;
}

/** How far the whole figure must drop so its lowest sole sits on the ground. */
function solve(pose: Pose): number {
  const near = soleOf(pose.nearThigh, pose.nearShin);
  const far = soleOf(pose.farThigh, pose.farShin);
  return PHOTO.ground * K - Math.max(near, far);
}

/**
 * Draw one slice of the plate, rotated about a joint, in the current transform.
 *
 * The slice is drawn at its NATURAL position in the plate, so a part with a zero
 * angle lands exactly where it does in the photograph and the whole figure
 * reassembles seamlessly. Rotation is applied about the joint first, and the
 * canvas transform is left in place for the caller to nest children in.
 */
function slice(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  cut: { y0: number; y1: number },
  pivot: Point,
  deg: number,
): void {
  ctx.translate(pivot.x, pivot.y);
  ctx.rotate(deg * RAD);
  ctx.translate(-pivot.x, -pivot.y);
  const sy = cut.y0 * K;
  const sh = (cut.y1 - cut.y0) * K;
  const sw = PHOTO.w * K;
  ctx.drawImage(source, 0, sy, sw, sh, 0, sy, sw, sh);
}

/**
 * Draw her.
 *
 * @param x Left edge of the collision box, in game px.
 * @param bottomY The ground line.
 * @param boxW Width of the collision box, so she can be centred in it.
 * @param height How tall she should stand, sole to crown, in game px.
 * @param phase 0..1 through the run cycle. Ignored by the static poses.
 */
export function drawRiggedRunner(
  ctx: CanvasRenderingContext2D,
  rig: RunnerRig,
  x: number,
  bottomY: number,
  boxW: number,
  height: number,
  state: RunnerState,
  phase: number,
): void {
  const pose = poseFor(state, phase);
  const drop = solve(pose);

  const hip = w(PHOTO.hip);
  const knee = w(PHOTO.knee);
  const neck = w(PHOTO.neck);
  const elbow = w(PHOTO.elbow);

  // Work space → game space. Her hip column is put at the middle of the box and
  // her soles on the ground line; `drop` is what the pose solve asked for.
  const scale = height / WORK_H;

  ctx.save();
  ctx.translate(x + boxW / 2, bottomY);
  ctx.scale(scale, scale);
  // The lowest sole after the solve sits at `PHOTO.ground * K - drop`; putting
  // THAT on the ground line is the whole trick. (Subtracting the drop instead
  // of adding it double-counts, and she hovers.)
  ctx.translate(-hip.x, drop - PHOTO.ground * K);

  const leg = (source: CanvasImageSource, thigh: number, shin: number): void => {
    ctx.save();
    slice(ctx, source, SLICES.thigh, hip, thigh);
    slice(ctx, source, SLICES.shin, knee, shin);
    ctx.restore();
  };

  // ══ ORDER IS THE WHOLE ILLUSION ══════════════════════════════════
  //
  // Back to front, and the near ARM is the one that is easy to get wrong: in
  // the photograph her hand hangs IN FRONT of her thigh, so it has to be drawn
  // after the near leg. Nesting it with the torso — which is where it belongs
  // logically, since a lean has to carry it — buried it behind her own leg, and
  // the only arm left visible was the darkened far one, reading as a grey blob
  // stuck to her hip.
  //
  // So it inherits the torso's rotation explicitly instead, and is drawn last.
  leg(rig.plateFar, pose.farThigh, pose.farShin);

  // Her far arm, behind her body. Mostly hidden by design; what shows is the
  // part swung clear of her silhouette, which is what sells the counter-swing.
  ctx.save();
  slice(ctx, rig.foreFar, SLICES.fore, elbow, pose.foreFar);
  ctx.restore();

  // Torso, with the head hanging off it so a lean carries them together.
  ctx.save();
  slice(ctx, rig.plate, SLICES.torso, hip, pose.torso);
  ctx.save();
  slice(ctx, rig.plate, SLICES.head, neck, pose.head);
  ctx.restore();
  ctx.restore();

  leg(rig.plate, pose.nearThigh, pose.nearShin);

  // Her near arm, in front of everything, carrying the torso's lean.
  ctx.save();
  ctx.translate(hip.x, hip.y);
  ctx.rotate(pose.torso * RAD);
  ctx.translate(-hip.x, -hip.y);
  slice(ctx, rig.fore, SLICES.fore, elbow, pose.fore);
  ctx.restore();

  ctx.restore();
}
