/**
 * 제주 달리기 — the endless runner played while the AI renders the photo.
 *
 * ── Where this came from ──────────────────────────────────────────────
 * Ported from the `test` branch's `features/game/dinoEngine.ts`, a Chrome
 * offline-dinosaur clone that was already authored for this exact surface: the
 * customer display's 2160×3840 board, played with the body, tuned for the ~100ms
 * of pose latency that costs. Only the ENGINE came across — its React screen,
 * control panel and pose hook were left behind, because this repo already has
 * better-integrated versions of all three (MotionStage, MotionRemote,
 * useMotionTracking).
 *
 * ── What was changed, and what deliberately was not ───────────────────
 * The theme is 제주: the ground obstacles are 돌하르방 and 현무암, the birds are
 * 갈매기, and the runner is the kiosk's own character. All of that is COLOUR
 * AND PIXEL SHAPE ONLY.
 *
 * ══ WHO THE RUNNER IS ════════════════════════════════════════════════
 * The kiosk's character, as a rigged photograph — see runnerRig. The flat
 * pixel figure in {@link drawPixelRunner} is the FALLBACK, drawn only if the
 * photo or its cut-up fails: a game that renders no runner at all is far worse
 * than one that renders a stylised one, and on a kiosk the asset pipeline is
 * exactly the thing that breaks silently after a bad build.
 *
 * Both are drawn to the same boxes and the same ground line, so the fallback is
 * a change of appearance and never a change of game.
 *
 * ══ THE NUMBERS THAT MOVED, AND WHY THEY ARE SAFE ═════════════════════
 * Every VERTICAL number is untouched, and that is the important half: the
 * obstacle Y-bands, DINO_H and DUCK_H are tuned against each other and against
 * the forgiveness inset, and they are the entire duck-or-jump distinction. Move
 * any of them and an obstacle silently becomes decorative — see obstacleFor.
 * The crouched sprite is drawn to respect that too: her highest pixel sits ~18px
 * below the bottom of the `bird_duck` band, so a gull that the box says she
 * ducked visibly passes over her head.
 *
The two that moved are the WIDTHS, {@link DINO_W} (88 → 52 units) and
 * {@link DUCK_W} (118 → 76), because the runner stopped being a long stocky
 * pony and became a person. A person drawn 330px tall is nowhere near 303px
 * wide, and a crouching one is not 406px long. Leaving either box at the pony's
 * width would have killed the player from obstacles a hundred pixels clear of
 * her — the exact "that didn't touch me" that makes a runner feel broken.
 *
 * Narrowing is the safe DIRECTION, which is why it was allowed at all. The jump
 * arc is tuned so the runner outlasts the whole time an obstacle overlaps her,
 * and that overlap is `(obstacle_w + runner_w) / speed`: a narrower runner is
 * overlapped for FEWER steps, so the ~19 steps of timing slack documented on
 * JUMP_V can only grow. Widening either would have needed the arc re-tuned.
 *
 * Deliberately framework-free: the whole thing is one canvas and one rAF loop,
 * so React never re-renders during play (the pose hook updates a ref, not state).
 * Everything is drawn from primitives — no sprite assets to ship or path-resolve.
 *
 * Physics run on fixed 60fps steps fed by a real-time accumulator, so the game
 * plays identically whether the kiosk paints at 60fps or drops frames under the
 * MediaPipe load.
 *
 * It fills Monitor 2 edge to edge (portrait 2160×3840), so the sprite geometry
 * below is authored in the original 96-unit dino height and multiplied by
 * {@link S}. Keeping the authored units means the proportions stay the ones that
 * were actually tuned, and only one number changes if the artboard ever does.
 */

import { drawRiggedRunner, loadRunnerRig, type RunnerRig, type RunnerState } from './runnerRig';

/** Logical play field — the full customer-display artboard. */
export const GAME_W = 2160;
export const GAME_H = 3840;

/** Sprite scale: the sprite is authored 96 units tall and stands 330px here. */
const S = 3.4375;

/** Ground line — everything stands on it. Low enough to leave a tall sky. */
const GROUND_Y = 2750;

const DINO_X = 380;
/**
 * 52 units, not the pony's 88 — a person is not as wide as she is tall.
 *
 * This is the only tuned number in the file that moved, and the header says at
 * length why narrowing (and only narrowing) is safe against the jump arc.
 *
 * The drawing deliberately reaches PAST this box: her leading hand and front
 * shoe extend to ~50 units against a forgiveness-inset right edge at 42. That
 * is the inset doing its job — a leading toe clipping an obstacle should read
 * as the near miss it is, not as a death.
 */
const DINO_W = Math.round(52 * S); // 179
const DINO_H = Math.round(96 * S); // 330
/** 76 units, not the pony's 118 — a crouching person is not 406px long. */
const DUCK_W = Math.round(76 * S); // 261
const DUCK_H = Math.round(56 * S); // 193

/**
 * Jump arc: ~61 steps of airtime (about a second) and ~705px of lift.
 *
 * Deliberately floatier than the browser original, because the timing window is
 * what makes this fair. The dino must stay airborne for the whole time an
 * obstacle overlaps it: at the slowest speed the widest obstacle (the cluster)
 * takes ~26 steps to pass, and the dino spends ~45 steps above its height — so
 * the player has ~19 steps (~0.31s) of slack to time the jump. A tighter arc
 * dropped that to ~0.17s, which is not playable when pose detection alone costs
 * ~100ms on top of human reaction time.
 */
const JUMP_V = -46;
const GRAVITY = 1.5;

/**
 * Speeds are deliberately gentler than the browser original. Body control costs
 * ~100ms of pose latency on top of human reaction time, so an obstacle needs to
 * stay visible for well over a second: at 24px/step it crosses the 1780px
 * between the spawn edge and the dino in ~1.24s.
 */
const START_SPEED = 24;
const MAX_SPEED = 52;
const SPEED_RAMP = 0.0035;

/**
 * Physics steps in one full stride cycle (left foot down to left foot down).
 *
 * 24 steps is 0.4s at 60fps — about two strides a second, which is a jog rather
 * than a sprint and is what her posture in the photograph can carry. Faster and
 * the interpolation between four keyframes starts to strobe.
 */
const RUN_CYCLE_STEPS = 24;

/** Score ticks up per pixel travelled. */
const SCORE_PER_PX = 0.011;

/** Collision boxes are inset this much — near-misses should feel like misses. */
const FORGIVENESS = Math.round(10 * S); // 34

/**
 * Grace at the start of a run before anything can be hit, so the player is
 * never killed by an obstacle that was already on screen when they began.
 */
const INTRO_GRACE_STEPS = 45;

/**
 * 제주 palette. The ground obstacles are the island's black basalt and the birds
 * are 갈매기 — white against a dark sky, so they read at the top of a 3840px
 * board from across a concourse.
 */
/**
 * A 제주 day, not a night: pale sea-sky, 한라산 on the horizon, sand underfoot,
 * a basalt ground line with 유채꽃 yellow in the speckle. The board used to be
 * drawn on a near-black purple, which read as a generic arcade and nothing
 * like the island the rest of the kiosk is dressed as.
 */
const COLORS = {
  sky: '#d7ecee',
  /** 한라산 silhouette — soft, so it never competes with an obstacle. */
  hallasan: '#bcd8cc',
  /** Sand below the ground line. */
  sand: '#efe4d0',
  /** 현무암 ground line. */
  ground: '#4f4842',
  /** 유채꽃 — every other speckle. */
  canola: '#e8b823',
  /** 돌하르방 / basalt. */
  cactus: '#3f3a36',
  /** 갈매기: white body, grey wing, orange beak — legible on a light sky. */
  bird: '#ffffff',
  birdWing: '#6d7a86',
  beak: '#f08c1a',
  cloud: '#ffffff',
} as const;

/**
 * The runner: the kiosk's own character, in her light-blue crop top and
 * wide-leg denim.
 *
 * ── Pulled apart on purpose ───────────────────────────────────────────
 * On the reference she is wearing almost exactly the same pale blue on top and
 * bottom, which is lovely on a person and unreadable as a 330px sprite seen
 * from across a concourse: the whole figure collapses into one blue smear with
 * a dark blob on top. So the top is lifted and the denim dropped until the two
 * separate, and the bare midriff between them — which is the thing that
 * actually makes the silhouette hers — sits between two clearly different
 * blues rather than inside one.
 *
 * Each garment also carries a shade one step down, used on her FAR side. A
 * side-on figure with no shading reads as a paper cut-out; one stripe of
 * shadow down the back half is enough to make her solid.
 */
const RUNNER = {
  hair: '#1b1b26',
  /** The streaming tail of hair, lifted so the motion reads separately. */
  hairLo: '#343546',
  skin: '#f0cdb4',
  /** Crop top. Lifted off the denim — see above. */
  top: '#cfe0f0',
  topLo: '#a9c3dc',
  /** Wide-leg denim. Dropped away from the top — see above. */
  denim: '#8bafd3',
  denimLo: '#7093ba',
  shoe: '#f8fafc',
  shoeLo: '#d3d9e2',
  eye: '#241a12',
} as const;

/**
 * Every part of her in one flat grey, for the death frame.
 *
 * The original greyed the pony by swapping one fill. She is eleven fills, so
 * the swap happens on the palette rather than at each call site — which also
 * means a colour added to RUNNER cannot forget to die.
 */
type RunnerPalette = Record<keyof typeof RUNNER, string>;

const RUNNER_DEAD: RunnerPalette = {
  hair: '#5f574e',
  hairLo: '#6f675e',
  skin: '#a09488',
  top: '#9a9188',
  topLo: '#8a8178',
  denim: '#7d7167',
  denimLo: '#6d6259',
  shoe: '#b0a89f',
  shoeLo: '#989087',
  eye: '#3a332d',
};

type ObstacleKind = 'cactus_s' | 'cactus_l' | 'cactus_cluster' | 'bird_duck' | 'bird_jump';

interface Obstacle {
  kind: ObstacleKind;
  x: number;
  /** Top edge. */
  y: number;
  w: number;
  h: number;
  /** Wing phase for birds. */
  frame: number;
}

interface Cloud {
  x: number;
  y: number;
  scale: number;
}

export interface RunEngineCallbacks {
  /** Fired when the live score changes (whole numbers only). */
  onScore?: (score: number, best: number) => void;
  /** Fired exactly once per run, the moment the player crashes. */
  onGameOver?: (score: number, best: number) => void;
}

export interface RunEngineHandle {
  /** Begin a fresh run. Safe to call again to restart. */
  start: () => void;
  /** Halt the loop entirely and release the frame callback. */
  stop: () => void;
  /** Request a jump. Ignored while airborne, paused, or dead. */
  jump: () => void;
  /** Hold the dino down. */
  setDucking: (ducking: boolean) => void;
  /**
   * Practice mode: she runs, jumps and ducks, but nothing spawns, the speed
   * does not ramp and nothing scores.
   *
   * This is the tutorial's floor. A visitor who has never steered anything with
   * a hand learns the two moves by doing them against an empty track, where
   * getting it wrong costs nothing — rather than by crashing into the first
   * 돌하르방 and being shown GAME OVER before they understood there was a game.
   * Turning it off starts the real run from a score of zero with a clear gap
   * before the first obstacle.
   */
  setPractice: (practice: boolean) => void;
  /**
   * Freeze the world without ending the run — used for the pre-run countdown,
   * and when the player steps out of the camera's view so walking away is never
   * scored as a crash.
   */
  setPaused: (paused: boolean) => void;
  /** Best score seen so far, for handing back to the control panel. */
  getBest: () => number;
}

/**
 * Obstacle bands are tuned against the FORGIVENESS inset, which is what actually
 * decides a hit. With the dino standing its inset box is 2454–2716 and crouched
 * it is 2591–2716, so:
 *   - `bird_duck` sits at 2470–2566: it bites the standing box by ~96px and
 *     clears the crouched one by ~25px. Crouch (or clear it with a jump).
 *   - `bird_jump` sits at 2534–2666: it catches BOTH stances, so only a jump
 *     saves you.
 * Move these and the duck/jump distinction silently stops working — an obstacle
 * that overlaps neither box is simply decorative.
 */
function obstacleFor(kind: ObstacleKind): Pick<Obstacle, 'y' | 'w' | 'h'> {
  switch (kind) {
    case 'cactus_s':
      return { y: GROUND_Y - 309, w: 158, h: 309 };
    case 'cactus_l':
      return { y: GROUND_Y - 440, w: 213, h: 440 };
    case 'cactus_cluster':
      return { y: GROUND_Y - 330, w: 454, h: 330 };
    case 'bird_duck':
      return { y: GROUND_Y - 314, w: 316, h: 164 };
    case 'bird_jump':
      return { y: GROUND_Y - 250, w: 316, h: 200 };
  }
}

/** Draw a filled rect — every sprite is built from these. */
function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/**
 * The FALLBACK runner: her likeness as flat rectangles.
 *
 * ══ WHY A HAND-DRAWN FIGURE EXISTS AT ALL ═════════════════════════════
 * She is normally the rigged photograph (see runnerRig). This draws when that
 * cannot: a missing or corrupt asset, a decode failure, a browser that refuses
 * the canvas readback the cut-up needs. A runner game with no runner is not
 * degraded, it is broken — and an asset failing quietly after a bad build is
 * the most ordinary thing that can go wrong on a kiosk.
 *
 * So it is authored in the idiom of everything it shares the screen with — the
 * 돌하르방, the 갈매기, the clouds are all flat rects — and readable by
 * SILHOUETTE first: long dark hair streaming back, a cropped pale top, bare
 * midriff, wide-leg denim, white trainers. At 330px on a 3840px board seen
 * across a concourse, that silhouette is the whole likeness.
 *
 * Authored in units within a 52 × 96 box, origin at her top-left. Half-units are
 * fine — `r` takes floats — which is what gives human proportions inside a grid
 * that was laid out for a pony.
 */
function drawPixelRunner(
  ctx: CanvasRenderingContext2D,
  x: number,
  bottomY: number,
  ducking: boolean,
  runFrame: number,
  dead: boolean,
): void {
  const c: RunnerPalette = dead ? RUNNER_DEAD : RUNNER;
  const top = bottomY - (ducking ? DUCK_H : DINO_H);
  const r = (dx: number, dy: number, dw: number, dh: number, color: string): void =>
    px(ctx, x + dx * S, top + dy * S, dw * S, dh * S, color);

  // ── Ducking: a deep crouch ──
  //
  // This was a forward slide first, to fill the pony's 118-unit box. It read as
  // a pile of loose blocks: flat out and side-on, a head, an arm and a torso at
  // the same height are one skin-and-blue smear, and nothing in it said "person"
  // at a glance. Narrowing DUCK_W (see the header) bought the room to draw the
  // pose a player actually expects instead — folded down over her knees, which
  // is compact, unmistakably human, and unmistakably DUCKING.
  //
  // Her highest pixel is the crown at 8 units, ~27px below the top of the box,
  // which leaves ~18px of daylight under the `bird_duck` band. That clearance is
  // the whole reason the duck input exists, so check it against obstacleFor
  // before moving anything in here upward.
  //
  // Every block overlaps its neighbour. With a figure this compressed, rects
  // that merely touch read as a row of boxes rather than a body.
  if (ducking) {
    r(3, 20, 15, 12, c.hairLo); // hair, still carrying her speed
    r(8, 13, 20, 17, c.hair);
    r(20, 7, 18, 14, c.hair); // crown, tipped forward over the knees
    r(30, 11, 16, 16, c.skin); // face, looking ahead down the track
    r(33, 10, 11, 5, c.hair); // fringe, or she reads as bald from the front
    r(41, 19, 3, 3, c.eye);
    r(45, 20, 2, 3, c.skin); // nose
    r(24, 23, 22, 17, c.top); // torso, folded forward
    r(24, 23, 7, 17, c.topLo);
    r(42, 26, 6, 11, c.topLo); // arm tucked in front of her
    r(44, 32, 9, 8, c.skin);
    r(28, 37, 15, 8, c.skin); // midriff
    r(19, 41, 23, 15, c.denim); // hips, dropped low and back
    r(19, 41, 5, 15, c.denimLo);
    r(35, 39, 23, 14, c.denim); // thigh, folded forward
    r(51, 45, 15, 11, c.denim); // shin, down to the leading foot
    r(17, 48, 16, 8, c.shoe); // trailing foot
    r(17, 54, 16, 2, c.shoeLo);
    r(60, 47, 16, 9, c.shoe); // leading foot
    r(60, 54, 16, 2, c.shoeLo);
    return;
  }

  // ── Hair, behind everything, tapering as it streams back ──
  //
  // Three pieces, not one. A single tall rectangle was the first attempt and it
  // swallowed her: at 18 units wide it was as broad as her whole body, so the
  // silhouette read as a dark cape with a face stuck to the front rather than a
  // head with hair behind it. The crown is now its own small block over the
  // skull, the length is a NARROWER column down her back, and the two streaming
  // wisps taper — which is also the only part of the sprite that says "moving"
  // during the frames when both feet happen to be down.
  r(2, 22, 9, 8, c.hairLo); // far wisp
  r(7, 16, 13, 13, c.hairLo);
  r(19, 15, 13, 29, c.hair); // the length, neck to mid-back
  r(24, 4, 10, 14, c.hair); // back of the skull

  // ── Head ──
  // Drawn AFTER the hair so the face sits in front of it. The face is a full
  // 15 units — a sixth of her height — because a smaller one disappears into
  // the hair at this scale, which is what the first pass got wrong.
  r(30, 5, 14, 15, c.skin);
  r(27, 3, 13, 6, c.hair); // fringe, forehead only
  r(39, 12, 2.5, 2.5, c.eye);
  r(43.5, 13, 2, 3, c.skin); // nose — the pixel that fixes which way she faces
  r(31, 19, 7, 4, c.skin); // neck

  // ── Crop top ──
  r(26, 22, 16, 19, c.top);
  r(26, 22, 5, 19, c.topLo); // her far side, in shade

  // A last strand falling OVER the top, so the hair belongs to her rather than
  // stopping at the collar.
  r(20, 22, 7, 17, c.hair);

  // ── Arms, counter-swinging with the legs ──
  // Sleeves in the top's colour and forearms in skin: that is the three-quarter
  // sleeve on the reference, and also the only way an arm reads as an arm at
  // this size, because two tones tell you where the elbow is. The forearm block
  // overlaps the upper arm rather than butting against it — see the slide.
  //
  // Both arms stay ON her: an earlier pass swung the far one out to x17, which
  // at this scale is a hand floating in her hair rather than an arm.
  if (runFrame === 0) {
    r(40, 23, 6, 10, c.topLo); // near arm, elbow bent up in front
    r(43, 18, 6, 9, c.skin);
    r(22, 23, 5, 11, c.topLo); // far arm, swung down and back
    r(19, 31, 6, 9, c.skin);
  } else {
    r(40, 23, 6, 11, c.topLo); // near arm, driven down and back
    r(39, 31, 6, 9, c.skin);
    r(23, 23, 5, 10, c.topLo); // far arm, coming through in front
    r(24, 17, 6, 9, c.skin);
  }

  r(29, 40, 12, 8, c.skin); // midriff

  // ── Denim ──
  r(25, 47, 17, 14, c.denim);
  r(25, 47, 5, 14, c.denimLo); // far side
  r(25, 47, 17, 2, c.denimLo); // waistband

  // ── Two-frame stride ──
  //
  // ══ A BENT KNEE IS WHAT MAKES HER RUN ═════════════════════════════
  // The pony's gallop this replaces was two vertical legs of different lengths,
  // and inheriting that was the first attempt here. On a quadruped it reads as
  // a stride; on a person it reads as standing still with one leg shorter than
  // the other, which is worse than no animation at all.
  //
  // So the planted leg runs straight down and the lifted one is drawn in TWO
  // pieces — a thigh, then a shin displaced along the direction of travel. The
  // step in the middle is the knee, and one stepped rect is the whole
  // difference between a person running and a person standing.
  //
  // Whichever leg is planted is always drawn to y=96, which is what makes the
  // sprite's bottom edge equal DINO_H — and therefore what keeps her standing
  // ON the ground line rather than in it.
  const planted = (dx: number, color: string, shoeDx: number): void => {
    r(dx, 59, 11, 29, color);
    r(shoeDx, 88, 15, 8, c.shoe);
    r(shoeDx, 94, 15, 2, c.shoeLo);
  };
  const lifted = (thighDx: number, shinDx: number, color: string, shoeDx: number): void => {
    r(thighDx, 59, 12, 13, color);
    r(shinDx, 70, 11, 12, color);
    r(shoeDx, 81, 14, 8, c.shoe);
    r(shoeDx, 87, 14, 2, c.shoeLo);
  };

  if (dead) {
    // Both feet down. Nothing about a crash should look like a stride.
    planted(25, c.denimLo, 23);
    planted(36, c.denim, 34);
  } else if (runFrame === 0) {
    planted(25, c.denimLo, 23); // far leg carries her
    lifted(35, 39, c.denim, 38); // near leg driving forward
  } else {
    planted(36, c.denim, 34); // near leg carries her
    lifted(25, 20, c.denimLo, 18); // far leg trailing behind
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle): void {
  if (o.kind === 'bird_duck' || o.kind === 'bird_jump') {
    // 갈매기. Same fill-the-band construction as the original — see below.
    const c = COLORS.bird;
    const { w, h } = o;
    // The bird is drawn to FILL its collision band. An earlier version drew a
    // small bird floating inside a much taller hitbox, so players were clipped
    // by empty air; the flapping wing is what reaches the top and bottom edges,
    // while the body holds a constant band in the middle so the silhouette
    // never disappears between frames.
    px(ctx, o.x, o.y + 0.34 * h, 0.3 * w, 0.28 * h, c); // tail
    px(ctx, o.x + 0.2 * w, o.y + 0.3 * h, 0.58 * w, 0.4 * h, c); // body
    px(ctx, o.x + 0.66 * w, o.y + 0.16 * h, 0.28 * w, 0.34 * h, c); // head
    px(ctx, o.x + 0.9 * w, o.y + 0.3 * h, 0.1 * w, 0.1 * h, COLORS.beak); // beak
    // Wing in its own shade so the flap reads; still fills the band exactly.
    if (o.frame < 1) px(ctx, o.x + 0.28 * w, o.y, 0.44 * w, 0.34 * h, COLORS.birdWing);
    else px(ctx, o.x + 0.28 * w, o.y + 0.66 * h, 0.44 * w, 0.34 * h, COLORS.birdWing);
    return;
  }

  const c = COLORS.cactus;

  // A 밭담 — the dry basalt field wall. Three stones of differing height, drawn
  // into the cluster's exact box.
  if (o.kind === 'cactus_cluster') {
    px(ctx, o.x, o.y + 76, 117, o.h - 76, c);
    px(ctx, o.x + 158, o.y, 131, o.h, c);
    px(ctx, o.x + 337, o.y + 103, 117, o.h - 103, c);
    px(ctx, o.x + 117, o.y + 151, 48, 55, c);
    return;
  }

  // 돌하르방: a stone pillar with the wide hat and the two hands on the belly.
  // Built from the SAME rectangles the cactus used — trunk plus two side pieces
  // — so the silhouette still fills its tuned box exactly.
  const armY = o.h > 350 ? 151 : 103;
  const trunk = 76;
  px(ctx, o.x + (o.w - trunk) / 2, o.y + 41, trunk, o.h - 41, c); // body
  px(ctx, o.x + 8, o.y, o.w - 16, 48, c); // hat brim, full width
  px(ctx, o.x + (o.w - trunk) / 2, o.y + 20, trunk, 34, c); // crown
  px(ctx, o.x, o.y + armY, 41, 117, c); // left arm down the side
  px(ctx, o.x + o.w - 41, o.y + armY, 41, 117, c); // right arm
  // The two hands folded on the belly — the detail that makes it a 돌하르방.
  px(ctx, o.x + (o.w - trunk) / 2 + 12, o.y + armY + 58, 24, 20, COLORS.ground);
  px(ctx, o.x + (o.w - trunk) / 2 + 42, o.y + armY + 58, 24, 20, COLORS.ground);
}

function drawCloud(ctx: CanvasRenderingContext2D, cloud: Cloud): void {
  const { x, y, scale } = cloud;
  const u = scale * S;
  px(ctx, x, y, 66 * u, 14 * u, COLORS.cloud);
  px(ctx, x + 14 * u, y - 12 * u, 40 * u, 14 * u, COLORS.cloud);
}

export function createRunEngine(
  canvas: HTMLCanvasElement,
  callbacks: RunEngineCallbacks = {},
): RunEngineHandle {
  const ctx = canvas.getContext('2d');
  canvas.width = GAME_W;
  canvas.height = GAME_H;

  // The rig is a module-level singleton behind this call: the first game pays
  // for the decode and the cut-up, every later one gets it for nothing. Not
  // awaited — the loop starts immediately and draws the fallback for the frame
  // or two before it arrives, which is also exactly what happens for good if it
  // never does.
  let rig: RunnerRig | null = null;
  void loadRunnerRig().then((loaded) => {
    rig = loaded;
  });

  let raf: number | null = null;
  let running = false;
  let lastTime = 0;
  /** Leftover real time not yet consumed by a fixed physics step. */
  let accumulator = 0;

  let dinoY = 0; // Offset above the ground line (0 = standing on it).
  let velocity = 0;
  let ducking = false;
  let dead = false;
  let paused = false;
  let practice = false;
  let runTick = 0;

  let speed = START_SPEED;
  let distance = 0;
  /** Distance covered while it COUNTS — practice scrolls the world but not this. */
  let scored = 0;
  let score = 0;
  let best = 0;
  let reportedScore = -1;

  let obstacles: Obstacle[] = [];
  let clouds: Cloud[] = [];
  let nextSpawnIn = 0;

  function resetRun(): void {
    dinoY = 0;
    velocity = 0;
    ducking = false;
    dead = false;
    paused = false;
    practice = false;
    runTick = 0;
    speed = START_SPEED;
    distance = 0;
    scored = 0;
    score = 0;
    reportedScore = -1;
    obstacles = [];
    nextSpawnIn = 1600;
    clouds = [
      { x: 400, y: 700, scale: 1.1 },
      { x: 1250, y: 1150, scale: 0.85 },
      { x: 1800, y: 480, scale: 1 },
      { x: 800, y: 1750, scale: 0.7 },
    ];
  }

  function spawn(): void {
    // Birds only join once the run has warmed up, so the first seconds are
    // readable for someone who has never played with their body before.
    const pool: ObstacleKind[] =
      score < 120
        ? ['cactus_s', 'cactus_l', 'cactus_s', 'cactus_cluster']
        : ['cactus_s', 'cactus_l', 'cactus_cluster', 'bird_jump', 'bird_duck'];
    const kind = pool[Math.floor(Math.random() * pool.length)] ?? 'cactus_s';
    obstacles.push({ kind, x: GAME_W + 120, frame: 0, ...obstacleFor(kind) });

    // Gap scales with speed, so the reaction window stays constant in FRAMES no
    // matter how fast the world is moving, with jitter so the rhythm never
    // becomes fully predictable.
    //
    // The floor of 85 frames is load-bearing: a jump is airborne for ~61 frames
    // and needs ~9 more to rise clear of the next obstacle. At the old floor of
    // 60 the game could deal a pair you physically could not clear — you were
    // still coming down from the first when the second arrived.
    nextSpawnIn = speed * (85 + Math.random() * 45);
  }

  /**
   * Crouching only counts with both feet down — the same condition the sprite is
   * drawn with, so the hitbox can never disagree with what the player sees.
   *
   * This matters more than it looks for body control: landing from a real jump
   * means bending your knees, which the pose hook reads as a crouch. If that
   * shrank the box (or pulled the dino down) mid-air, jumping properly would get
   * you killed.
   */
  function crouched(): boolean {
    return ducking && dinoY === 0;
  }

  function hits(o: Obstacle): boolean {
    const w = crouched() ? DUCK_W : DINO_W;
    const h = crouched() ? DUCK_H : DINO_H;
    const dx = DINO_X + FORGIVENESS;
    const dy = GROUND_Y - dinoY - h + FORGIVENESS;
    const dw = w - FORGIVENESS * 2;
    const dh = h - FORGIVENESS * 2;
    return (
      dx < o.x + o.w - FORGIVENESS &&
      dx + dw > o.x + FORGIVENESS &&
      dy < o.y + o.h - FORGIVENESS &&
      dy + dh > o.y + FORGIVENESS
    );
  }

  /** One fixed 60fps physics step. */
  function step(): void {
    if (dead) return;

    runTick += 1;
    // The scenery always moves, so practice still LOOKS like running.
    distance += speed;
    if (!practice) {
      speed = Math.min(MAX_SPEED, speed + SPEED_RAMP);
      scored += speed;
    }

    const next = Math.floor(scored * SCORE_PER_PX);
    if (next !== score) {
      score = next;
      if (score > best) best = score;
    }

    // Vertical motion. A jump always plays out its full arc — nothing the
    // player does mid-air can cut it short (see `crouched`).
    if (dinoY > 0 || velocity !== 0) {
      velocity += GRAVITY;
      dinoY -= velocity;
      if (dinoY <= 0) {
        dinoY = 0;
        velocity = 0;
      }
    }

    for (const cloud of clouds) {
      cloud.x -= speed * 0.22;
      if (cloud.x < -700) {
        cloud.x = GAME_W + Math.random() * 900;
        cloud.y = 400 + Math.random() * 1500;
      }
    }

    if (!practice) {
      nextSpawnIn -= speed;
      if (nextSpawnIn <= 0) spawn();
    }

    for (const o of obstacles) {
      o.x -= speed;
      if (o.kind === 'bird_duck' || o.kind === 'bird_jump') {
        o.frame = (o.frame + 0.09) % 2;
      }
    }
    obstacles = obstacles.filter((o) => o.x + o.w > -200);

    // Opening grace: never die to something that was already on screen.
    if (runTick > INTRO_GRACE_STEPS) {
      for (const o of obstacles) {
        if (hits(o)) {
          dead = true;
          callbacks.onGameOver?.(score, best);
          break;
        }
      }
    }
  }

  function draw(): void {
    if (!ctx) return;
    // Sky, then 한라산 on the horizon (static — it is far away), then clouds.
    px(ctx, 0, 0, GAME_W, GROUND_Y, COLORS.sky);
    ctx.fillStyle = COLORS.hallasan;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y - 230);
    ctx.lineTo(460, GROUND_Y - 330);
    ctx.lineTo(900, GROUND_Y - 540);
    ctx.lineTo(1180, GROUND_Y - 600);
    ctx.lineTo(1470, GROUND_Y - 545);
    ctx.lineTo(1880, GROUND_Y - 330);
    ctx.lineTo(GAME_W, GROUND_Y - 250);
    ctx.lineTo(GAME_W, GROUND_Y);
    ctx.lineTo(0, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    for (const cloud of clouds) drawCloud(ctx, cloud);

    // Ground: sand, a solid basalt line, and a scrolling speckle so speed is
    // legible — alternating basalt and 유채꽃.
    px(ctx, 0, GROUND_Y, GAME_W, GAME_H - GROUND_Y, COLORS.sand);
    px(ctx, 0, GROUND_Y, GAME_W, 16, COLORS.ground);
    const offset = distance % 413;
    for (let x = -offset; x < GAME_W; x += 413) {
      px(ctx, x, GROUND_Y + 48, 117, 16, COLORS.ground);
      px(ctx, x + 213, GROUND_Y + 89, 62, 16, COLORS.canola);
    }

    for (const o of obstacles) drawObstacle(ctx, o);

    // ── The runner ──
    // `runTick` counts physics steps, so the cycle is tied to distance covered
    // rather than to wall-clock: she takes the same number of strides per metre
    // however fast the board is painting, and her feet do not skate when the
    // speed ramps.
    const crouching = crouched();
    const state: RunnerState = dead ? 'dead' : crouching ? 'duck' : dinoY > 0 ? 'jump' : 'run';
    if (rig) {
      drawRiggedRunner(
        ctx,
        rig,
        DINO_X,
        GROUND_Y - dinoY,
        crouching ? DUCK_W : DINO_W,
        DINO_H,
        state,
        runTick / RUN_CYCLE_STEPS,
      );
    } else {
      drawPixelRunner(ctx, DINO_X, GROUND_Y - dinoY, crouching, Math.floor(runTick / 6) % 2, dead);
    }

    // No score or GAME OVER text on the canvas: the stage header carries the
    // score and the result card carries the ending, and a second monospace
    // counter in the sky was a duplicate of both.
  }

  function frame(now: number): void {
    if (!running) return;
    raf = requestAnimationFrame(frame);

    const elapsed = Math.min(now - lastTime, 100); // Clamp after a stall.
    lastTime = now;
    accumulator += elapsed;

    const STEP_MS = 1000 / 60;
    while (accumulator >= STEP_MS) {
      // Paused (counting in, or nobody in frame) still burns the accumulator,
      // so resuming doesn't fast-forward the world by however long we waited.
      if (!paused) step();
      accumulator -= STEP_MS;
    }

    draw();

    if (score !== reportedScore) {
      reportedScore = score;
      callbacks.onScore?.(score, best);
    }
  }

  return {
    start(): void {
      resetRun();
      if (!running) {
        running = true;
        lastTime = performance.now();
        accumulator = 0;
        raf = requestAnimationFrame(frame);
      }
    },
    stop(): void {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    },
    jump(): void {
      if (dead || paused || dinoY > 0) return;
      velocity = JUMP_V;
      dinoY = 1; // Leave the ground so the physics branch takes over.
    },
    setDucking(next: boolean): void {
      ducking = next;
    },
    setPaused(next: boolean): void {
      paused = next;
    },
    setPractice(next: boolean): void {
      if (practice && !next) {
        // Leaving practice: the same readable gap a fresh run opens with, so the
        // first obstacle never arrives the instant the tutorial says "go".
        nextSpawnIn = 1600;
        obstacles = [];
      }
      practice = next;
    },
    getBest(): number {
      return best;
    },
  };
}
