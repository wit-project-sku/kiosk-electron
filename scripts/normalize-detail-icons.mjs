// One-off: normalize the 상세(detail) info icons (marker / alarm / phone) so each
// glyph occupies the same fraction of a square canvas — they render at the same
// visual size under object-fit:contain. Crop to the glyph bbox, re-pad to a square
// with a uniform margin. Lossless (no resampling). Run: node scripts/normalize-detail-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pako from 'pako';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../src/renderer/src/assets/icons/osan');
const FILES = ['marker.png', 'alarm.png', 'phone.png'];
const MARGIN = 0.09; // 9% transparent margin around the glyph on its longer side

const SIG = [137, 80, 78, 71, 13, 10, 26, 10];

// ── CRC32 ──
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function readChunks(buf) {
  for (let i = 0; i < 8; i++) if (buf[i] !== SIG[i]) throw new Error('not a PNG');
  let off = 8;
  const chunks = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    chunks.push({ type, data });
    off += 12 + len;
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Decode an 8-bit PNG (colorType 6/2/0/4) → { w, h, rgba } */
function decode(buf) {
  const chunks = readChunks(buf);
  const ihdr = chunks.find((c) => c.type === 'IHDR').data;
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8], colorType = ihdr[9];
  if (bitDepth !== 8) throw new Error('only 8-bit supported, got ' + bitDepth);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error('unsupported colorType ' + colorType);

  const idat = chunks.filter((c) => c.type === 'IDAT').map((c) => c.data);
  const raw = pako.inflate(Buffer.concat(idat));
  const bpp = channels;
  const stride = w * bpp;
  const out = new Uint8Array(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[pos++];
    const row = out.subarray(y * stride, y * stride + stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, (y - 1) * stride + stride) : null;
    for (let x = 0; x < stride; x++) {
      const rawv = raw[pos++];
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v;
      switch (filter) {
        case 0: v = rawv; break;
        case 1: v = rawv + a; break;
        case 2: v = rawv + b; break;
        case 3: v = rawv + ((a + b) >> 1); break;
        case 4: v = rawv + paeth(a, b, c); break;
        default: throw new Error('bad filter ' + filter);
      }
      row[x] = v & 0xff;
    }
  }

  // expand to RGBA
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const s = i * bpp;
    let r, g, b, a;
    if (colorType === 6) { r = out[s]; g = out[s + 1]; b = out[s + 2]; a = out[s + 3]; }
    else if (colorType === 2) { r = out[s]; g = out[s + 1]; b = out[s + 2]; a = 255; }
    else if (colorType === 4) { r = g = b = out[s]; a = out[s + 1]; }
    else { r = g = b = out[s]; a = 255; }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }
  return { w, h, rgba };
}

/** True for a pixel that is part of the glyph (opaque-ish, or non-white if no alpha). */
function isInk(rgba, i) {
  const a = rgba[i * 4 + 3];
  if (a < 250) return a > 32; // has transparency → use alpha
  const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
  return r < 240 || g < 240 || b < 240; // opaque image → non-white is ink
}

function bbox(w, h, rgba) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (isInk(rgba, y * w + x)) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
  return { x0, y0, x1, y1 };
}

function encode(w, h, rgba) {
  const stride = w * 4;
  const raw = new Uint8Array(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter None
    raw.set(rgba.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1);
  }
  const idat = pako.deflate(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td), 0);
    return Buffer.concat([len, td, crc]);
  };
  return Buffer.concat([
    Buffer.from(SIG),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const file of FILES) {
  const path = join(DIR, file);
  const { w, h, rgba } = decode(readFileSync(path));
  const { x0, y0, x1, y1 } = bbox(w, h, rgba);
  if (x1 < x0) { console.log(`${file}: no ink found, skipped`); continue; }
  const gw = x1 - x0 + 1, gh = y1 - y0 + 1;
  const side = Math.round(Math.max(gw, gh) / (1 - 2 * MARGIN));
  const ox = Math.round((side - gw) / 2), oy = Math.round((side - gh) / 2);
  const out = new Uint8Array(side * side * 4); // transparent
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const src = ((y0 + y) * w + (x0 + x)) * 4;
      const dst = ((oy + y) * side + (ox + x)) * 4;
      out[dst] = rgba[src]; out[dst + 1] = rgba[src + 1];
      out[dst + 2] = rgba[src + 2]; out[dst + 3] = rgba[src + 3];
    }
  writeFileSync(path, encode(side, side, out));
  console.log(`${file}: ${w}x${h} glyph ${gw}x${gh} → ${side}x${side} square`);
}
