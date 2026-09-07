/**
 * Hyper-Realistic Procedural Texture Engine.
 * Generates photorealistic textures for:
 * - Volumetric clouds with fractal edge erosion and Beer-Lambert light scattering
 * - Refractive convex water droplets with specular highlights and contact shadows
 * - Optical lens flare elements (anamorphic streak, hexagonal iris ghosts, starburst)
 * - Dendritic ice crystals and out-of-focus optical bokeh snowflakes
 * - Screen border frost crystallization
 */

// PRNG for consistent texture generation
function makePrng(seed: number) {
  let s = (seed * 16807 + 11) % 2147483647;
  return (): number => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// 2D Perlin-like smooth noise for organic cloud wisps
function createNoise2D(rand: () => number, size = 128) {
  const table = new Float32Array(size * size);
  for (let i = 0; i < table.length; i++) table[i] = rand();

  return (x: number, y: number): number => {
    const xi = Math.floor(x) % size;
    const yi = Math.floor(y) % size;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const sX = xf * xf * (3 - 2 * xf);
    const sY = yf * yf * (3 - 2 * yf);

    const i00 = (xi + yi * size) % table.length;
    const i10 = ((xi + 1) % size + yi * size) % table.length;
    const i01 = (xi + ((yi + 1) % size) * size) % table.length;
    const i11 = ((xi + 1) % size + ((yi + 1) % size) * size) % table.length;

    const top = table[i00]! * (1 - sX) + table[i10]! * sX;
    const bot = table[i01]! * (1 - sX) + table[i11]! * sX;
    return top * (1 - sY) + bot * sY;
  };
}

/**
 * Photorealistic Volumetric Cloud Sprite.
 * Uses 80+ micro-billow gaussian particles perturbed by fractal noise,
 * with forward sunlight scattering along top crests and Beer-Lambert atmospheric
 * absorption on undersides for authentic photographic cloud realism.
 */
export function createRealisticCloudTexture(size = 768, variant: 0 | 1 | 2 | 3 = 0): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = Math.round(size * 0.56);
  const ctx = c.getContext('2d')!;
  const w = c.width;
  const h = c.height;
  ctx.clearRect(0, 0, w, h);

  const rand = makePrng(variant * 1337 + 7331);
  const noise = createNoise2D(rand, 128);

  type Billow = { x: number; y: number; r: number; opacity: number };
  const billows: Billow[] = [];

  // Generate multi-scale overlapping cloud billows
  const clusterCount = variant === 0 ? 5 : variant === 1 ? 4 : variant === 2 ? 6 : 3;

  for (let cl = 0; cl < clusterCount; cl++) {
    const clX = 0.2 + (cl / (clusterCount - 1)) * 0.6 + (rand() - 0.5) * 0.08;
    const clY = 0.54 + (rand() - 0.5) * 0.12 - (cl === 2 ? 0.08 : 0);
    const clR = (variant === 0 ? 0.22 : 0.19) + (rand() - 0.5) * 0.05;

    // Sub-billows around each cluster center
    const subCount = 14;
    for (let s = 0; s < subCount; s++) {
      const ang = rand() * Math.PI * 2;
      const dist = Math.pow(rand(), 0.7) * clR;
      const bx = clX + Math.cos(ang) * dist * 1.4;
      const by = clY + Math.sin(ang) * dist * 0.8;
      const br = (0.07 + rand() * 0.12) * (1 - dist / (clR * 1.5));
      if (br > 0.02) {
        billows.push({ x: bx, y: by, r: br, opacity: 0.25 + rand() * 0.35 });
      }
    }
  }

  // Edge wisps and micro-puff turbulence (gives authentic photographic frayed perimeter)
  for (let i = 0; i < 45; i++) {
    const parent = billows[Math.floor(rand() * billows.length)]!;
    const ang = rand() * Math.PI * 2;
    const dist = parent.r * (1.1 + rand() * 0.6);
    const n = noise(parent.x * 20, parent.y * 20);
    billows.push({
      x: parent.x + Math.cos(ang) * dist,
      y: parent.y + Math.sin(ang) * dist * 0.7,
      r: parent.r * (0.35 + n * 0.3),
      opacity: 0.1 + rand() * 0.2,
    });
  }

  // 1. Render core volumetric billows with light transport simulation
  for (const b of billows) {
    const cx = b.x * w;
    const cy = b.y * h;
    const r = b.r * w;
    if (r < 2) continue;

    // Sunlight direction: coming from top/top-right
    const lightOffsetX = -r * 0.25;
    const lightOffsetY = -r * 0.35;

    const g = ctx.createRadialGradient(
      cx + lightOffsetX,
      cy + lightOffsetY,
      r * 0.05,
      cx,
      cy,
      r,
    );

    const a = b.opacity;
    g.addColorStop(0, `rgba(255, 255, 255, ${0.98 * a})`);
    g.addColorStop(0.35, `rgba(252, 254, 255, ${0.88 * a})`);
    g.addColorStop(0.70, `rgba(235, 244, 252, ${0.45 * a})`);
    g.addColorStop(0.92, `rgba(215, 230, 245, ${0.12 * a})`);
    g.addColorStop(1, 'rgba(200, 220, 240, 0)');

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Beer-Lambert volumetric absorption on underside (cool slate shadow)
  ctx.globalCompositeOperation = 'source-atop';
  const bellyShade = ctx.createLinearGradient(0, h * 0.28, 0, h * 0.98);
  bellyShade.addColorStop(0, 'rgba(255, 255, 255, 0)');
  bellyShade.addColorStop(0.45, 'rgba(185, 205, 230, 0.06)');
  bellyShade.addColorStop(0.78, 'rgba(135, 160, 195, 0.25)');
  bellyShade.addColorStop(1, 'rgba(105, 132, 170, 0.42)');
  ctx.fillStyle = bellyShade;
  ctx.fillRect(0, 0, w, h);

  // 3. Brilliant forward-scattered silver lining along top crests
  const silverLining = ctx.createRadialGradient(
    w * 0.48,
    h * 0.18,
    0,
    w * 0.48,
    h * 0.32,
    w * 0.45,
  );
  silverLining.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
  silverLining.addColorStop(0.35, 'rgba(255, 253, 245, 0.35)');
  silverLining.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = silverLining;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'source-over';
  return c;
}

export const createCloudTexture = createRealisticCloudTexture;

/**
 * Refractive Convex Water Droplet for Window Glass.
 * Models a real water bead on vertical glass with:
 * - Meniscus contact shadow
 * - Inverted bottom-right caustic refraction
 * - Top-left sharp specular highlight
 */
export function createGlassDropletTexture(size = 96): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const cx = size * 0.5;
  const cy = size * 0.5;
  const r = size * 0.44;
  ctx.clearRect(0, 0, size, size);

  // 1. Soft droplet contact drop shadow
  const shadow = ctx.createRadialGradient(
    cx + r * 0.12,
    cy + r * 0.16,
    r * 0.4,
    cx + r * 0.14,
    cy + r * 0.18,
    r * 1.05,
  );
  shadow.addColorStop(0, 'rgba(20, 38, 60, 0.5)');
  shadow.addColorStop(0.7, 'rgba(20, 38, 60, 0.15)');
  shadow.addColorStop(1, 'rgba(20, 38, 60, 0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(cx + r * 0.12, cy + r * 0.16, r * 1.05, 0, Math.PI * 2);
  ctx.fill();

  // 2. Water droplet body (translucent refractive lens)
  const body = ctx.createRadialGradient(
    cx - r * 0.25,
    cy - r * 0.25,
    r * 0.1,
    cx,
    cy,
    r,
  );
  body.addColorStop(0, 'rgba(255, 255, 255, 0.88)');
  body.addColorStop(0.45, 'rgba(225, 240, 255, 0.35)');
  body.addColorStop(0.85, 'rgba(160, 195, 230, 0.22)');
  body.addColorStop(1, 'rgba(70, 105, 145, 0.7)'); // dark meniscus refraction ring
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // 3. Inverted bottom-right internal caustic refraction
  const caustic = ctx.createRadialGradient(
    cx + r * 0.28,
    cy + r * 0.28,
    0,
    cx + r * 0.28,
    cy + r * 0.28,
    r * 0.45,
  );
  caustic.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
  caustic.addColorStop(0.5, 'rgba(235, 248, 255, 0.45)');
  caustic.addColorStop(1, 'rgba(200, 230, 255, 0)');
  ctx.fillStyle = caustic;
  ctx.beginPath();
  ctx.arc(cx + r * 0.28, cy + r * 0.28, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // 4. Sharp top-left specular highlight (sky reflection glint)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.35, cy - r * 0.35, r * 0.24, r * 0.16, -Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();

  // Secondary tiny pin-glint
  ctx.beginPath();
  ctx.arc(cx - r * 0.18, cy - r * 0.48, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  return c;
}

/**
 * Optical Lens Flare: Anamorphic Horizontal Glare Streak.
 */
export function createAnamorphicStreakTexture(width = 800, height = 96): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  const cx = width / 2;
  const cy = height / 2;
  ctx.clearRect(0, 0, width, height);

  const g = ctx.createLinearGradient(0, cy, width, cy);
  g.addColorStop(0, 'rgba(255, 230, 150, 0)');
  g.addColorStop(0.35, 'rgba(255, 235, 175, 0.25)');
  g.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
  g.addColorStop(0.65, 'rgba(255, 235, 175, 0.25)');
  g.addColorStop(1, 'rgba(255, 230, 150, 0)');

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, width * 0.49, height * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  return c;
}

/**
 * Optical Lens Flare: Hexagonal Iris Aperture Ghost.
 */
export function createHexagonalIrisTexture(size = 160, tint = 'rgba(255, 215, 120, 0.25)'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.44;
  ctx.clearRect(0, 0, size, size);

  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  g.addColorStop(0.6, tint);
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = tint;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  return c;
}

/**
 * Optical Lens Flare: Starburst Diffraction Spike.
 */
export function createStarburstTexture(size = 384): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  ctx.clearRect(0, 0, size, size);

  const spikeCount = 8;
  const R = size * 0.48;

  for (let i = 0; i < spikeCount; i++) {
    const a = (i * Math.PI) / (spikeCount / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);

    const g = ctx.createLinearGradient(0, 0, R, 0);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    g.addColorStop(0.3, 'rgba(255, 240, 180, 0.45)');
    g.addColorStop(1, 'rgba(255, 220, 140, 0)');

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(R, -size * 0.012);
    ctx.lineTo(R, size * 0.012);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  return c;
}

/**
 * Optical Bokeh Defocus Disc (for cinematic snow & sun motes).
 */
export function createBokehDiscTexture(size = 128, rimTint = 'rgba(220, 235, 255, 0.6)'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.46;
  ctx.clearRect(0, 0, size, size);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = rimTint;
  ctx.lineWidth = Math.max(2, size * 0.05);
  ctx.stroke();

  return c;
}

/**
 * Delicate Frost Border Texture for Screen Corners.
 */
export function createFrostBorderTexture(size = 512): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const rand = makePrng(4421);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillStyle = 'rgba(235, 245, 255, 0.7)';
  ctx.lineWidth = 1.8;

  const drawFernBranch = (x: number, y: number, len: number, ang: number, depth: number) => {
    if (depth <= 0 || len < 4) return;
    const ex = x + Math.cos(ang) * len;
    const ey = y + Math.sin(ang) * len;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    const subCount = 3 + Math.floor(rand() * 3);
    for (let i = 1; i <= subCount; i++) {
      const frac = i / (subCount + 1);
      const bx = x + (ex - x) * frac;
      const by = y + (ey - y) * frac;
      const subLen = len * (0.45 + rand() * 0.2);

      drawFernBranch(bx, by, subLen, ang + 0.65 + (rand() - 0.5) * 0.2, depth - 1);
      drawFernBranch(bx, by, subLen, ang - 0.65 + (rand() - 0.5) * 0.2, depth - 1);
    }
  };

  for (let i = 0; i < 7; i++) {
    const ang = (i / 6) * (Math.PI / 2);
    const len = size * (0.55 + rand() * 0.35);
    drawFernBranch(0, 0, len, ang, 3);
  }

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.9);
  g.addColorStop(0, 'rgba(235, 248, 255, 0.45)');
  g.addColorStop(0.5, 'rgba(215, 235, 255, 0.15)');
  g.addColorStop(1, 'rgba(200, 225, 255, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.9, 0, Math.PI / 2);
  ctx.lineTo(0, 0);
  ctx.fill();

  return c;
}

export function createRaindropTexture(size = 128): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const w = c.width;
  const h = c.height;
  const cx = w * 0.5;
  const headY = h * 0.84;
  const headR = w * 0.36;
  ctx.clearRect(0, 0, w, h);

  const tail = ctx.createLinearGradient(cx, 0, cx, headY);
  tail.addColorStop(0, 'rgba(200, 225, 250, 0)');
  tail.addColorStop(0.4, 'rgba(215, 235, 255, 0.25)');
  tail.addColorStop(0.75, 'rgba(235, 245, 255, 0.65)');
  tail.addColorStop(1, 'rgba(255, 255, 255, 0.95)');
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.35, headY);
  ctx.lineTo(cx - headR * 0.12, 0);
  ctx.lineTo(cx + headR * 0.12, 0);
  ctx.lineTo(cx + headR * 0.35, headY);
  ctx.closePath();
  ctx.fill();

  const head = ctx.createRadialGradient(cx, headY, headR * 0.1, cx, headY, headR);
  head.addColorStop(0, 'rgba(255, 255, 255, 1)');
  head.addColorStop(0.45, 'rgba(230, 245, 255, 0.9)');
  head.addColorStop(0.85, 'rgba(195, 225, 250, 0.4)');
  head.addColorStop(1, 'rgba(180, 210, 240, 0)');
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(cx - headR * 0.3, headY - headR * 0.3, headR * 0.32, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

export function createSplashTexture(size = 128): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = Math.round(size * 0.55);
  const ctx = c.getContext('2d')!;
  const cx = c.width / 2;
  const cy = c.height / 2;
  ctx.clearRect(0, 0, c.width, c.height);

  for (let i = 0; i < 3; i++) {
    const rx = size * (0.16 + i * 0.14);
    const ry = rx * 0.42;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(225, 240, 255, ${0.75 - i * 0.22})`;
    ctx.lineWidth = size * (0.038 - i * 0.008);
    ctx.stroke();
  }

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.2);
  core.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  core.addColorStop(0.5, 'rgba(215, 235, 255, 0.5)');
  core.addColorStop(1, 'rgba(190, 220, 250, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(cx, cy, size * 0.22, size * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

export function createSunTexture(size = 512): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  ctx.clearRect(0, 0, size, size);

  const bloom = ctx.createRadialGradient(cx, cy, size * 0.15, cx, cy, size * 0.49);
  bloom.addColorStop(0, 'rgba(255, 245, 210, 0.45)');
  bloom.addColorStop(0.35, 'rgba(255, 220, 140, 0.22)');
  bloom.addColorStop(0.70, 'rgba(255, 185, 90, 0.07)');
  bloom.addColorStop(1, 'rgba(255, 160, 60, 0)');
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.49, 0, Math.PI * 2);
  ctx.fill();

  const corona = ctx.createRadialGradient(cx, cy, size * 0.08, cx, cy, size * 0.32);
  corona.addColorStop(0, 'rgba(255, 255, 240, 0.95)');
  corona.addColorStop(0.25, 'rgba(255, 235, 165, 0.75)');
  corona.addColorStop(0.60, 'rgba(255, 200, 100, 0.32)');
  corona.addColorStop(1, 'rgba(255, 170, 60, 0)');
  ctx.fillStyle = corona;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.32, 0, Math.PI * 2);
  ctx.fill();

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.16);
  core.addColorStop(0, 'rgba(255, 255, 255, 1)');
  core.addColorStop(0.40, 'rgba(255, 252, 230, 0.98)');
  core.addColorStop(0.75, 'rgba(255, 228, 140, 0.85)');
  core.addColorStop(1, 'rgba(255, 195, 80, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.16, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

export function createRayTexture(width = 160, height = 800): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const grad = ctx.createLinearGradient(cx, 0, cx, height);
  grad.addColorStop(0, 'rgba(255, 250, 215, 0.52)');
  grad.addColorStop(0.25, 'rgba(255, 235, 175, 0.28)');
  grad.addColorStop(0.65, 'rgba(255, 215, 135, 0.09)');
  grad.addColorStop(1, 'rgba(255, 195, 100, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx - width * 0.18, 0);
  ctx.lineTo(cx + width * 0.18, 0);
  ctx.lineTo(width * 0.95, height);
  ctx.lineTo(width * 0.05, height);
  ctx.closePath();
  ctx.fill();
  return c;
}

export function createMoteTexture(size = 48): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  ctx.clearRect(0, 0, size, size);

  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.48);
  halo.addColorStop(0, 'rgba(255, 255, 235, 1)');
  halo.addColorStop(0.30, 'rgba(255, 230, 140, 0.7)');
  halo.addColorStop(0.65, 'rgba(255, 195, 80, 0.2)');
  halo.addColorStop(1, 'rgba(255, 170, 50, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

export function createSnowflakeTexture(size = 192, variant: 0 | 1 = 0): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
  ctx.fillStyle = 'rgba(240, 248, 255, 0.92)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const R = size * 0.44;
  ctx.lineWidth = Math.max(2, size * 0.03);

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    ctx.save();
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -R);
    ctx.stroke();

    const branchLevels = variant === 0 ? [0.42, 0.65, 0.85] : [0.35, 0.58, 0.78];
    for (const lvl of branchLevels) {
      const y = -R * lvl;
      const bLen = R * (0.28 * (1.1 - lvl));
      const bAng = Math.PI / 3;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(Math.sin(bAng) * bLen, y - Math.cos(bAng) * bLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(-Math.sin(bAng) * bLen, y - Math.cos(bAng) * bLen);
      ctx.stroke();

      if (lvl > 0.5) {
        const subLen = bLen * 0.4;
        const subY = y - Math.cos(bAng) * bLen * 0.5;
        const subX = Math.sin(bAng) * bLen * 0.5;
        ctx.beginPath();
        ctx.moveTo(subX, subY);
        ctx.lineTo(subX + Math.sin(bAng) * subLen, subY - Math.cos(bAng) * subLen);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-subX, subY);
        ctx.lineTo(-subX - Math.sin(bAng) * subLen, subY - Math.cos(bAng) * subLen);
        ctx.stroke();
      }
    }

    ctx.beginPath();
    ctx.moveTo(0, -R);
    ctx.lineTo(R * 0.05, -R + R * 0.06);
    ctx.lineTo(0, -R + R * 0.12);
    ctx.lineTo(-R * 0.05, -R + R * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.beginPath();
  const coreR = R * 0.18;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const px = Math.cos(a) * coreR;
    const py = Math.sin(a) * coreR;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(215, 235, 255, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.35);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  glow.addColorStop(0.5, 'rgba(220, 240, 255, 0.35)');
  glow.addColorStop(1, 'rgba(200, 230, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  return c;
}

export function createSnowPuffTexture(size = 128): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  ctx.clearRect(0, 0, size, size);

  const g = ctx.createRadialGradient(cx, cy, size * 0.05, cx, cy, size * 0.48);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  g.addColorStop(0.35, 'rgba(245, 250, 255, 0.75)');
  g.addColorStop(0.70, 'rgba(225, 240, 255, 0.28)');
  g.addColorStop(1, 'rgba(200, 225, 250, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
  ctx.fill();
  return c;
}
