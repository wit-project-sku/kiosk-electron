/**
 * T-Rex runner — the wait-time mini game played while the AI renders the photo.
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
 * below is authored in the original 88×96 dino units and multiplied by {@link S}.
 * Keeping the authored units means the proportions stay the ones that were
 * actually tuned, and only one number changes if the artboard ever does.
 */

/** Logical play field — the full customer-display artboard. */
export const GAME_W = 2160;
export const GAME_H = 3840;

/** Sprite scale: the dino was authored 88×96, and stands 330px tall here. */
const S = 3.4375;

/** Ground line — everything stands on it. Low enough to leave a tall sky. */
const GROUND_Y = 2750;

const DINO_X = 380;
const DINO_W = Math.round(88 * S); // 303
const DINO_H = Math.round(96 * S); // 330
const DUCK_W = Math.round(118 * S); // 406
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

/** Score ticks up per pixel travelled. */
const SCORE_PER_PX = 0.011;

/** Collision boxes are inset this much — near-misses should feel like misses. */
const FORGIVENESS = Math.round(10 * S); // 34

/**
 * Grace at the start of a run before anything can be hit, so the player is
 * never killed by an obstacle that was already on screen when they began.
 */
const INTRO_GRACE_STEPS = 45;

const COLORS = {
  ground: '#8a9099',
  dino: '#3c4148',
  dinoDead: '#9aa1a9',
  cactus: '#5c6b5a',
  bird: '#4a5058',
  cloud: '#e4e8ed',
  score: '#a2a9b1',
  accent: '#fe6c50',
  eye: '#f4f6f8',
} as const;

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

export interface DinoEngineCallbacks {
  /** Fired when the live score changes (whole numbers only). */
  onScore?: (score: number, best: number) => void;
  /** Fired exactly once per run, the moment the player crashes. */
  onGameOver?: (score: number, best: number) => void;
}

export interface DinoEngineHandle {
  /** Begin a fresh run. Safe to call again to restart. */
  start: () => void;
  /** Halt the loop entirely and release the frame callback. */
  stop: () => void;
  /** Request a jump. Ignored while airborne, paused, or dead. */
  jump: () => void;
  /** Hold the dino down. */
  setDucking: (ducking: boolean) => void;
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

function drawDino(
  ctx: CanvasRenderingContext2D,
  x: number,
  bottomY: number,
  ducking: boolean,
  runFrame: number,
  dead: boolean,
): void {
  const c = dead ? COLORS.dinoDead : COLORS.dino;
  const top = bottomY - (ducking ? DUCK_H : DINO_H);
  // Authored in 88×96 dino units; scaled to the artboard.
  const r = (dx: number, dy: number, dw: number, dh: number, color: string = c): void =>
    px(ctx, x + dx * S, top + dy * S, dw * S, dh * S, color);

  if (ducking) {
    r(0, 14, 26, 14); // tail
    r(20, 8, 58, 30); // body
    r(74, 6, 34, 22); // head
    r(70, 22, 24, 8); // jaw
    r(96, 11, 8, 8, COLORS.eye); // eye
    r(30, 38, 12, 18); // tucked legs
    r(54, 38, 12, 18);
    return;
  }

  r(0, 40, 22, 16); // tail
  r(14, 36, 46, 34); // body
  r(50, 18, 20, 30); // neck
  r(58, 4, 30, 26); // head
  r(52, 24, 26, 10); // jaw
  r(76, 11, 8, 8, COLORS.eye); // eye
  r(52, 44, 13, 7); // arm

  // Two-frame run cycle; both legs plant while airborne or dead.
  const stride = dead ? 0 : runFrame;
  r(20, 68, 13, stride === 1 ? 20 : 28);
  r(40, 68, 13, stride === 1 ? 28 : 20);
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle): void {
  if (o.kind === 'bird_duck' || o.kind === 'bird_jump') {
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
    px(ctx, o.x + 0.9 * w, o.y + 0.3 * h, 0.1 * w, 0.1 * h, c); // beak
    if (o.frame < 1) px(ctx, o.x + 0.28 * w, o.y, 0.44 * w, 0.34 * h, c); // wing up
    else px(ctx, o.x + 0.28 * w, o.y + 0.66 * h, 0.44 * w, 0.34 * h, c); // wing down
    return;
  }

  const c = COLORS.cactus;
  if (o.kind === 'cactus_cluster') {
    // Three stalks of differing height.
    px(ctx, o.x, o.y + 76, 117, o.h - 76, c);
    px(ctx, o.x + 158, o.y, 131, o.h, c);
    px(ctx, o.x + 337, o.y + 103, 117, o.h - 103, c);
    px(ctx, o.x + 117, o.y + 151, 48, 55, c);
    return;
  }

  const armY = o.h > 350 ? 151 : 103;
  const trunk = 76;
  px(ctx, o.x + (o.w - trunk) / 2, o.y, trunk, o.h, c);
  px(ctx, o.x, o.y + armY, 41, 117, c); // left arm
  px(ctx, o.x + o.w - 41, o.y + armY + 48, 41, 117, c); // right arm
  px(ctx, o.x, o.y + armY, trunk, 41, c);
  px(ctx, o.x + o.w - trunk, o.y + armY + 48, trunk, 41, c);
}

function drawCloud(ctx: CanvasRenderingContext2D, cloud: Cloud): void {
  const { x, y, scale } = cloud;
  const u = scale * S;
  px(ctx, x, y, 66 * u, 14 * u, COLORS.cloud);
  px(ctx, x + 14 * u, y - 12 * u, 40 * u, 14 * u, COLORS.cloud);
}

export function createDinoEngine(
  canvas: HTMLCanvasElement,
  callbacks: DinoEngineCallbacks = {},
): DinoEngineHandle {
  const ctx = canvas.getContext('2d');
  canvas.width = GAME_W;
  canvas.height = GAME_H;

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
  let runTick = 0;

  let speed = START_SPEED;
  let distance = 0;
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
    runTick = 0;
    speed = START_SPEED;
    distance = 0;
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
    speed = Math.min(MAX_SPEED, speed + SPEED_RAMP);
    distance += speed;

    const next = Math.floor(distance * SCORE_PER_PX);
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

    nextSpawnIn -= speed;
    if (nextSpawnIn <= 0) spawn();

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
    ctx.clearRect(0, 0, GAME_W, GAME_H);

    for (const cloud of clouds) drawCloud(ctx, cloud);

    // Ground: solid line plus a scrolling speckle so speed is legible.
    px(ctx, 0, GROUND_Y, GAME_W, 16, COLORS.ground);
    const offset = distance % 413;
    ctx.globalAlpha = 0.55;
    for (let x = -offset; x < GAME_W; x += 413) {
      px(ctx, x, GROUND_Y + 48, 117, 16, COLORS.ground);
      px(ctx, x + 213, GROUND_Y + 89, 62, 16, COLORS.ground);
    }
    ctx.globalAlpha = 1;

    for (const o of obstacles) drawObstacle(ctx, o);
    drawDino(ctx, DINO_X, GROUND_Y - dinoY, crouched(), Math.floor(runTick / 6) % 2, dead);

    // Score, top-right, monospace for a stable width.
    ctx.font = '600 132px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.score;
    if (best > 0) ctx.fillText(`HI ${String(best).padStart(5, '0')}`, GAME_W - 700, 150);
    ctx.fillStyle = COLORS.dino;
    ctx.fillText(String(score).padStart(5, '0'), GAME_W - 150, 150);

    if (dead) {
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.accent;
      ctx.font = '800 190px ui-monospace, "SF Mono", Menlo, monospace';
      ctx.fillText('G A M E   O V E R', GAME_W / 2, GROUND_Y - 1500);
    }
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
    getBest(): number {
      return best;
    },
  };
}
