#!/usr/bin/env node
/**
 * Video-switch latency diagnosis — run WHERE THE VIDEOS LIVE (on the kiosk).
 *
 *   node scripts/diagnose-videos.mjs [dir]
 *
 * `dir` defaults to C:\KioskVideos, falling back to resources/videos. Every
 * .mp4 under it (one level of set folders: insadong/, jeju-airport/, …) is
 * inspected WITHOUT decoding — pure box parsing — and flagged for the three
 * properties that decide how long the customer display's switch takes, i.e.
 * the time between the touch-screen navigation and the moment the new clip's
 * first frame is on screen (AiModelVideoWall keeps the old clip visible for
 * exactly that long):
 *
 *  - FASTSTART: `moov` (the index) must come BEFORE `mdat` (the samples).
 *    With it at the end, the player must read the file's tail before it can
 *    decode frame one — the single most common cause of a visible delay.
 *    Fix losslessly, no re-encode:  ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4
 *  - RESOLUTION/CODEC: a 2160×3840 (4K) or HEVC first frame can take several
 *    hundred ms to decode on kiosk GPUs, where a 1080×1920 H.264 frame is
 *    near-instant. The display upscales, so 1080×1920 loses nothing visible.
 *    Fix: ffmpeg -i in.mp4 -vf scale=1080:1920 -c:v libx264 -preset slow -crf 20 -movflags +faststart out.mp4
 *  - BITRATE: >20 Mbps means big reads per frame; usually rides along with 4K
 *    and goes away with the same re-encode.
 *
 * Compare a "fast" venue's folder with a "slow" one — the difference is
 * usually visible in the first two columns.
 */
import { openSync, readSync, closeSync, statSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root =
  process.argv[2] ??
  (existsSync('C:\\KioskVideos') && readdirSync('C:\\KioskVideos').length > 0
    ? 'C:\\KioskVideos'
    : join(process.cwd(), 'resources', 'videos'));

/** Read `len` bytes at `pos` (returns a possibly-short Buffer at EOF). */
function readAt(fd, pos, len) {
  const buf = Buffer.alloc(len);
  const n = readSync(fd, buf, 0, len, pos);
  return buf.subarray(0, n);
}

/** Top-level boxes: [{type, start, size}] — enough to see moov vs mdat order. */
function topLevelBoxes(fd, fileSize) {
  const boxes = [];
  let pos = 0;
  while (pos + 8 <= fileSize) {
    const hdr = readAt(fd, pos, 16);
    if (hdr.length < 8) break;
    let size = hdr.readUInt32BE(0);
    const type = hdr.toString('latin1', 4, 8);
    if (size === 1) {
      if (hdr.length < 16) break;
      size = Number(hdr.readBigUInt64BE(8));
    } else if (size === 0) {
      size = fileSize - pos; // box extends to EOF
    }
    if (size < 8) break; // corrupt — stop rather than loop forever
    boxes.push({ type, start: pos, size });
    pos += size;
  }
  return boxes;
}

/** Depth-first search inside a container box for the first box named `want`. */
function findBox(buf, want, containers = ['moov', 'trak', 'mdia', 'minf', 'stbl']) {
  let pos = 0;
  while (pos + 8 <= buf.length) {
    const size = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    if (size < 8 || pos + size > buf.length) return null;
    const body = buf.subarray(pos + 8, pos + size);
    if (type === want) return body;
    if (containers.includes(type)) {
      const hit = findBox(body, want, containers);
      if (hit) return hit;
    }
    pos += size;
  }
  return null;
}

/** { codec, width, height } from the first VISUAL stsd sample entry in moov. */
function videoTrackInfo(moov) {
  // Walk every trak; the video one has a VisualSampleEntry in its stsd.
  let pos = 0;
  while (pos + 8 <= moov.length) {
    const size = moov.readUInt32BE(pos);
    const type = moov.toString('latin1', pos + 4, pos + 8);
    if (size < 8 || pos + size > moov.length) break;
    if (type === 'trak') {
      const stsd = findBox(moov.subarray(pos + 8, pos + size), 'stsd');
      if (stsd && stsd.length >= 16) {
        // stsd: 4 ver/flags + 4 entry_count, then the first sample entry.
        const entry = stsd.subarray(8);
        const codec = entry.toString('latin1', 4, 8);
        if (['avc1', 'avc3', 'hvc1', 'hev1', 'vp09', 'av01', 'mp4v'].includes(codec)) {
          // VisualSampleEntry: 8 hdr + 6 reserved + 2 dataref + 16 pre_defined
          // and reserved → width @32, height @34.
          return { codec, width: entry.readUInt16BE(32), height: entry.readUInt16BE(34) };
        }
      }
    }
    pos += size;
  }
  return { codec: '?', width: 0, height: 0 };
}

/** Duration in seconds from mvhd (0 when unreadable). */
function durationSecs(moov) {
  const mvhd = findBox(moov, 'mvhd', ['moov']);
  if (!mvhd || mvhd.length < 20) return 0;
  const version = mvhd.readUInt8(0);
  const timescale = version === 1 ? mvhd.readUInt32BE(20) : mvhd.readUInt32BE(12);
  const duration = version === 1 ? Number(mvhd.readBigUInt64BE(24)) : mvhd.readUInt32BE(16);
  return timescale > 0 ? duration / timescale : 0;
}

function inspect(path) {
  const fileSize = statSync(path).size;
  const fd = openSync(path, 'r');
  try {
    const boxes = topLevelBoxes(fd, fileSize);
    const moovBox = boxes.find((b) => b.type === 'moov');
    const mdatBox = boxes.find((b) => b.type === 'mdat');
    if (!moovBox) return { fileSize, error: 'no moov box (not an mp4?)' };
    const faststart = !mdatBox || moovBox.start < mdatBox.start;
    const moov = readAt(fd, moovBox.start + 8, Math.min(moovBox.size - 8, 32 * 1024 * 1024));
    const { codec, width, height } = videoTrackInfo(moov);
    const secs = durationSecs(moov);
    const mbps = secs > 0 ? (fileSize * 8) / secs / 1e6 : 0;
    return { fileSize, faststart, codec, width, height, secs, mbps };
  } finally {
    closeSync(fd);
  }
}

if (!existsSync(root)) {
  console.error(`No such directory: ${root}`);
  process.exit(1);
}

const folders = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
let flagged = 0;
let total = 0;

for (const folder of folders) {
  const dir = join(root, folder);
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mp4'));
  if (files.length === 0) continue;
  console.log(`\n── ${folder} (${files.length} files) ─────────────────────────`);
  for (const name of files) {
    total++;
    try {
      const r = inspect(join(dir, name));
      if (r.error) {
        console.log(`  ✗ ${name}: ${r.error}`);
        flagged++;
        continue;
      }
      const flags = [];
      if (!r.faststart) flags.push('NOT-FASTSTART');
      if (r.width * r.height > 1920 * 1088) flags.push('4K');
      if (r.codec === 'hvc1' || r.codec === 'hev1') flags.push('HEVC');
      if (r.mbps > 20) flags.push(`${r.mbps.toFixed(0)}Mbps`);
      if (flags.length > 0) flagged++;
      const mark = flags.length > 0 ? '⚠' : '✓';
      console.log(
        `  ${mark} ${name.padEnd(44)} ${r.codec} ${r.width}x${r.height} ` +
          `${(r.fileSize / 1e6).toFixed(0)}MB ${r.mbps.toFixed(1)}Mbps` +
          (flags.length > 0 ? `   ← ${flags.join(', ')}` : ''),
      );
    } catch (err) {
      console.log(`  ✗ ${name}: ${err.message}`);
      flagged++;
    }
  }
}

console.log(`\n${total} files, ${flagged} flagged.`);
if (flagged > 0) {
  console.log(`
A flagged file explains a slow customer-display switch. Fixes, in order of
cheapness (both keep the same file name — replace in place):
  moov at end (NOT-FASTSTART), lossless, seconds per file:
    ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4
  4K / HEVC / high bitrate (re-encode; the display upscales 1080x1920 with no
  visible loss at kiosk viewing distance):
    ffmpeg -i in.mp4 -vf scale=1080:1920 -c:v libx264 -preset slow -crf 20 -movflags +faststart out.mp4`);
}
