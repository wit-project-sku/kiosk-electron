/**
 * Canvas drawing for 감귤 받기. Pure functions — no state, no side effects
 * beyond the 2D context they are handed.
 *
 * ── Why canvas, and why drawn rather than emoji ───────────────────────
 * Canvas because a dozen objects, their particles and their score pops as DOM
 * nodes means a dozen React re-renders per frame; here it is one element and one
 * clear+draw pass, which is what actually holds 60fps on kiosk hardware.
 *
 * Drawn, rather than `fillText('🍊')`, because the emoji font is a system
 * dependency we do not control: the kiosk images have shipped with different
 * Segoe UI Emoji versions, and at 160px the difference between them is the
 * difference between a fruit and a blob. Gradients and arcs render identically
 * on every machine, take the venue's own orange, and let the golden one actually
 * glow — which an emoji cannot.
 *
 * Everything here is drawn around a LOCAL origin (0,0 = the object's centre) and
 * positioned by the caller's transform, so the same routine serves the falling
 * object, the catch burst and the basket preview.
 */
import type { FallingItem, Particle, ScorePop } from '../gameTypes';

/** The play field, in artboard px — matches GameShell's `.field` box. */
export const FIELD_W = 1900;
export const FIELD_H = 2060;

/** Basket geometry. The mouth is the catch line; the body just hangs below it. */
export const BASKET_W = 430;
export const BASKET_H = 260;
/**
 * y of the basket's mouth (rim) in the TOUCH game's field. Well clear of the
 * bottom so it reads as held.
 *
 * The motion version of this game plays on the customer display, whose field is
 * far taller (no header, no banner to share the board with), so it passes its
 * own base line to {@link drawBasket} rather than using this one. Everything
 * else here is position-agnostic and shared verbatim.
 */
export const BASKET_Y = FIELD_H - 330;

/** Radii by kind — the golden one is bigger, so a rare spawn is unmissable. */
export const RADIUS: Record<FallingItem['kind'], number> = {
  normal: 76,
  golden: 94,
  rock: 62,
};

/** A tangerine, centred on the current origin. */
function drawTangerine(ctx: CanvasRenderingContext2D, r: number, golden: boolean): void {
  if (golden) {
    // The glow is the whole point of the golden one — it has to read as special
    // from across the concourse, not just score more.
    ctx.shadowColor = 'rgba(255, 190, 40, 0.9)';
    ctx.shadowBlur = 46;
  }

  const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.15, 0, 0, r);
  if (golden) {
    body.addColorStop(0, '#fff3c4');
    body.addColorStop(0.45, '#ffce4a');
    body.addColorStop(1, '#f0930a');
  } else {
    body.addColorStop(0, '#ffc16b');
    body.addColorStop(0.45, '#ff9526');
    body.addColorStop(1, '#ee6d05');
  }

  ctx.beginPath();
  // Very slightly wider than tall — a citrus, not a ball.
  ctx.ellipse(0, 0, r, r * 0.94, 0, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Rind pit: one soft dimple, enough to stop it reading as a plastic sphere.
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.32, r * 0.3, r * 0.22, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.fill();

  // Navel.
  ctx.beginPath();
  ctx.arc(0, r * 0.72, r * 0.14, 0, Math.PI * 2);
  ctx.fillStyle = golden ? 'rgba(180, 110, 0, 0.35)' : 'rgba(150, 70, 0, 0.28)';
  ctx.fill();

  // Stem + leaf.
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.9);
  ctx.lineTo(0, -r * 1.08);
  ctx.lineWidth = r * 0.13;
  ctx.strokeStyle = '#7a5230';
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(r * 0.36, -r * 1.02, r * 0.38, r * 0.19, -0.42, 0, Math.PI * 2);
  const leaf = ctx.createLinearGradient(0, -r * 1.2, r * 0.7, -r * 0.8);
  leaf.addColorStop(0, '#6fbf5a');
  leaf.addColorStop(1, '#2f8f4e');
  ctx.fillStyle = leaf;
  ctx.fill();

  if (golden) {
    // Four-point sparkle, so the glow has a shape and not just a halo.
    ctx.save();
    ctx.translate(-r * 0.55, -r * 0.6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    const s = r * 0.34;
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(0, 0, s, 0);
    ctx.quadraticCurveTo(0, 0, 0, s);
    ctx.quadraticCurveTo(0, 0, -s, 0);
    ctx.quadraticCurveTo(0, 0, 0, -s);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * The penalty object — a basalt stone, the 제주 material 돌하르방 and the field
 * walls are cut from. Deliberately dull and grey next to the fruit: the visitor
 * has to be able to decide in the fraction of a second it is falling, and that
 * decision has to be legible by COLOUR, not by shape detail they cannot resolve.
 */
function drawStone(ctx: CanvasRenderingContext2D, r: number): void {
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.2, 0, 0, r);
  g.addColorStop(0, '#8d8d8d');
  g.addColorStop(1, '#4f4f4f');

  ctx.beginPath();
  // A few flattened facets rather than a circle, so it reads as rock.
  ctx.moveTo(-r, -r * 0.2);
  ctx.lineTo(-r * 0.55, -r * 0.9);
  ctx.lineTo(r * 0.4, -r);
  ctx.lineTo(r, -r * 0.1);
  ctx.lineTo(r * 0.6, r * 0.85);
  ctx.lineTo(-r * 0.5, r);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();

  // The pockmarks that make 현무암 look like 현무암.
  ctx.fillStyle = 'rgba(30, 30, 30, 0.35)';
  const holes: [number, number, number][] = [
    [-r * 0.3, -r * 0.3, r * 0.16],
    [r * 0.25, r * 0.1, r * 0.12],
    [-r * 0.1, r * 0.45, r * 0.1],
  ];
  for (const [hx, hy, hr] of holes) {
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** One falling object, tumbling. */
export function drawItem(ctx: CanvasRenderingContext2D, item: FallingItem): void {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.spin);
  if (item.kind === 'rock') drawStone(ctx, item.r);
  else drawTangerine(ctx, item.r, item.kind === 'golden');
  ctx.restore();
}

/**
 * The basket. `lift` is a 0…1 catch reaction the caller decays — the basket
 * squashes and rises a little on every catch, which is most of what makes the
 * game feel responsive rather than merely correct.
 */
export function drawBasket(
  ctx: CanvasRenderingContext2D,
  x: number,
  lift: number,
  /** Mouth line. Defaults to the touch game's; the motion game has a taller field. */
  baseY: number = BASKET_Y,
): void {
  const halfTop = BASKET_W / 2;
  const halfBottom = BASKET_W / 2 - 52;
  const squash = 1 + lift * 0.12;
  const h = BASKET_H * (1 - lift * 0.08);
  const y = baseY - lift * 22;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(squash, 1);

  // Contact shadow, so the basket sits in the scene instead of on it.
  ctx.beginPath();
  ctx.ellipse(0, h + 26, halfBottom * 1.15, 26, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(90, 60, 30, 0.18)';
  ctx.fill();

  // Body — a tapered basket.
  const body = ctx.createLinearGradient(0, 0, 0, h);
  body.addColorStop(0, '#d79a52');
  body.addColorStop(0.55, '#bd7b35');
  body.addColorStop(1, '#96591f');
  ctx.beginPath();
  ctx.moveTo(-halfTop, 0);
  ctx.lineTo(halfTop, 0);
  ctx.lineTo(halfBottom, h - 30);
  ctx.quadraticCurveTo(halfBottom, h, halfBottom - 30, h);
  ctx.lineTo(-halfBottom + 30, h);
  ctx.quadraticCurveTo(-halfBottom, h, -halfBottom, h - 30);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();

  // Weave. Clipped to the body so the lines follow the taper.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(90, 55, 20, 0.28)';
  ctx.lineWidth = 7;
  for (let i = 1; i < 5; i += 1) {
    const ly = (h / 5) * i;
    ctx.beginPath();
    ctx.moveTo(-halfTop, ly);
    ctx.lineTo(halfTop, ly);
    ctx.stroke();
  }
  for (let i = -3; i <= 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * 60, 0);
    ctx.lineTo(i * 46, h);
    ctx.stroke();
  }
  ctx.restore();

  // Rim last, so it sits over the weave.
  ctx.beginPath();
  ctx.ellipse(0, 0, halfTop, 30, 0, 0, Math.PI * 2);
  const rim = ctx.createLinearGradient(-halfTop, 0, halfTop, 0);
  rim.addColorStop(0, '#e8b070');
  rim.addColorStop(0.5, '#f6cf9c');
  rim.addColorStop(1, '#c98b44');
  ctx.fillStyle = rim;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, 0, halfTop - 34, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(70, 40, 12, 0.5)';
  ctx.fill();

  ctx.restore();
}

const PARTICLE_COLORS: Record<Particle['hue'], string> = {
  orange: '#ff9526',
  gold: '#ffd049',
  grey: '#8d8d8d',
};

export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  const t = p.life / p.maxLife;
  ctx.globalAlpha = Math.max(0, t);
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.6), 0, Math.PI * 2);
  ctx.fillStyle = PARTICLE_COLORS[p.hue];
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawScorePop(ctx: CanvasRenderingContext2D, pop: ScorePop): void {
  const t = pop.life / pop.maxLife;
  // Fade only over the last third — a pop that starts fading immediately reads
  // as a rendering glitch rather than a reward.
  ctx.globalAlpha = Math.min(1, t * 3);
  // A literal stack, not var(--kiosk-font): the canvas font string is parsed by
  // the 2D context, which resolves no custom properties — a var() here silently
  // leaves the font at the 10px sans-serif default.
  ctx.font = `800 ${pop.golden ? 96 : 72}px 'Noto Sans KR', 'Noto Sans', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeText(pop.text, pop.x, pop.y);
  ctx.fillStyle = pop.golden ? '#e88c00' : '#ff7f0f';
  ctx.fillText(pop.text, pop.x, pop.y);
  ctx.globalAlpha = 1;
}
