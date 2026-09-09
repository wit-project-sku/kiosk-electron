/**
 * Canvas drawing for 화산석 피하기.
 *
 * Same reasoning as `tangerine-catch/catchRender`: one canvas element and one
 * clear-and-draw pass per frame, rather than a DOM node per rock and a React
 * reconciliation per frame. Drawn rather than emoji so the rocks are genuinely
 * 현무암 — the porous black basalt 제주 is built from — instead of whatever grey
 * lozenge the machine's emoji font happens to ship.
 *
 * Everything is drawn around a LOCAL origin (0,0 = the object's centre) and
 * positioned by the caller's transform.
 */

/**
 * The play field, in artboard px — MotionStage's field on the customer display.
 *
 * Nearly the whole 2160×3840 board, because the big screen has no header or
 * banner to share it with. The height is what makes the game readable: a rock
 * needs long enough in the air for a visitor to see it, decide, and take a step.
 */
export const FIELD_W = 1980;
export const FIELD_H = 3120;

/** Where the player figure stands. Low, so rocks have the full field to fall. */
export const PLAYER_Y = FIELD_H - 420;
/** Half-width of the player's collision circle. Forgiving — see the engine. */
export const PLAYER_R = 105;

export interface Rock {
  id: number;
  x: number;
  y: number;
  /** px per second, downward. */
  vy: number;
  /** px per second sideways — the "different trajectories" of later levels. */
  vx: number;
  r: number;
  spin: number;
  spinRate: number;
  /** Deterministic shape seed, so a rock does not shimmer between frames. */
  seed: number;
  /** Set once the rock has passed the player and been scored. */
  scored: boolean;
}

export interface Smoke {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
}

/**
 * One volcanic rock.
 *
 * The silhouette is built from the seed so each rock is a different lump of
 * basalt but the SAME lump every frame — recomputing random vertices per frame
 * would make every rock boil, which at eight rocks on screen looks like a
 * rendering fault rather than texture.
 */
export function drawRock(ctx: CanvasRenderingContext2D, rock: Rock): void {
  ctx.save();
  ctx.translate(rock.x, rock.y);
  ctx.rotate(rock.spin);

  const r = rock.r;
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r);
  g.addColorStop(0, '#6b6b6b');
  g.addColorStop(0.6, '#454545');
  g.addColorStop(1, '#252525');

  // Seven vertices at seeded radii — enough to read as irregular, few enough
  // to stay cheap when the storm is on screen.
  ctx.beginPath();
  const points = 7;
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    // Cheap deterministic hash of (seed, i) → 0.78…1.0
    const wobble = 0.78 + (((rock.seed * 37 + i * 91) % 23) / 23) * 0.22;
    const px = Math.cos(angle) * r * wobble;
    const py = Math.sin(angle) * r * wobble;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();

  // The vesicles that make 현무암 look like 현무암.
  ctx.fillStyle = 'rgba(15, 15, 15, 0.55)';
  for (let i = 0; i < 4; i += 1) {
    const a = ((rock.seed * 17 + i * 53) % 360) * (Math.PI / 180);
    const d = r * (0.15 + ((i * 29) % 40) / 100);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * (0.09 + ((i * 13) % 7) / 100), 0, Math.PI * 2);
    ctx.fill();
  }

  // A warm rim on the upper-left: these came out of a volcano, and the hint of
  // heat is what stops them reading as generic grey asteroids.
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.35, r * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 130, 40, 0.13)';
  ctx.fill();

  ctx.restore();
}

/**
 * The player.
 *
 * A stylised figure rather than a basket: the brief's whole framing for this
 * game is "rocks fly toward YOU", and a person on screen is what makes a near
 * miss feel like a near miss. `flash` is a 0..1 hit reaction the caller decays.
 */
export function drawPlayer(ctx: CanvasRenderingContext2D, x: number, flash: number): void {
  ctx.save();
  ctx.translate(x, PLAYER_Y);

  // Contact shadow, so the figure stands on the ground rather than floating.
  ctx.beginPath();
  ctx.ellipse(0, 150, 92, 26, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(40, 25, 10, 0.28)';
  ctx.fill();

  // Hit flash — a red halo that fades over the invulnerability window, which is
  // also the visual timer for it.
  if (flash > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_R + 40, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(229, 72, 77, ${0.36 * flash})`;
    ctx.fill();
  }

  // Body — a rounded 한복-ish shape in the venue's orange.
  const body = ctx.createLinearGradient(0, -60, 0, 150);
  body.addColorStop(0, '#ffa447');
  body.addColorStop(1, '#ef7010');
  ctx.beginPath();
  ctx.moveTo(-40, -50);
  ctx.quadraticCurveTo(-96, 60, -86, 150);
  ctx.lineTo(86, 150);
  ctx.quadraticCurveTo(96, 60, 40, -50);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();

  // Arms, out slightly — reads as "ready to dodge" rather than standing still.
  ctx.lineCap = 'round';
  ctx.lineWidth = 26;
  ctx.strokeStyle = '#ef7010';
  ctx.beginPath();
  ctx.moveTo(-48, -20);
  ctx.lineTo(-104, 46);
  ctx.moveTo(48, -20);
  ctx.lineTo(104, 46);
  ctx.stroke();

  // Head.
  ctx.beginPath();
  ctx.arc(0, -104, 56, 0, Math.PI * 2);
  ctx.fillStyle = '#f7d7ae';
  ctx.fill();
  // Hair, so the figure has a front and reads as facing the player.
  ctx.beginPath();
  ctx.arc(0, -114, 56, Math.PI, Math.PI * 2);
  ctx.fillStyle = '#3b2a1c';
  ctx.fill();

  ctx.restore();
}

/** Volcanic smoke — drifting, fading, and capped by the caller's pool. */
export function drawSmoke(ctx: CanvasRenderingContext2D, s: Smoke): void {
  const t = s.life / s.maxLife;
  ctx.globalAlpha = Math.max(0, t * 0.45);
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r * (1.6 - t * 0.6), 0, Math.PI * 2);
  ctx.fillStyle = '#8a8a8a';
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** "+10" over a rock the player just slipped past. */
export function drawDodgePop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  life: number,
  maxLife: number,
): void {
  ctx.globalAlpha = Math.min(1, (life / maxLife) * 3);
  // A literal font stack: the 2D context resolves no CSS custom properties, and
  // a var() here silently falls back to 10px sans-serif.
  ctx.font = "800 66px 'Noto Sans KR', 'Noto Sans', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeText('+10', x, y);
  ctx.fillStyle = '#3ddc84';
  ctx.fillText('+10', x, y);
  ctx.globalAlpha = 1;
}
