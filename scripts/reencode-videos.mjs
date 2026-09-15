#!/usr/bin/env node
/**
 * Batch-fix kiosk display videos for INSTANT switching — run WHERE THE VIDEOS
 * LIVE (each kiosk's C:\KioskVideos), with ffmpeg on PATH.
 *
 *   node scripts/reencode-videos.mjs [dir]
 *
 * `dir` defaults to C:\KioskVideos. Every .mp4 under its set folders
 * (insadong/, jeju-airport/, … — folders starting with "_" are skipped) is
 * inspected (same box parsing as diagnose-videos.mjs) and, when needed, fixed
 * IN PLACE with the SAME FILE NAME (the app matches clips by name — nothing
 * else may change):
 *
 *  - already ≤1080-wide AND faststart          → skipped (nothing to fix)
 *  - right size but moov at the end            → lossless remux (seconds)
 *  - 4K / high-bitrate                         → re-encode to 1080×1920 H.264
 *                                                CRF 20 +faststart
 *
 * The original of every touched file is MOVED to <dir>/_originals/<set>/
 * first — nothing is deleted, and re-running is safe: a file whose backup
 * already exists is skipped (it was already processed).
 *
 * Why: the customer display swaps videos the moment the incoming clip's first
 * frame is decoded. A 2160×3840 / 200 Mbps / moov-at-end file takes visibly
 * long to reach that first frame (the 제주 "slow switch" complaint); a
 * 1080×1920 faststart file is effectively instant. The display upscales, so
 * at kiosk viewing distance the picture is the same.
 */
import { spawnSync } from 'node:child_process';
import {
  closeSync, existsSync, mkdirSync, openSync, readdirSync, readSync, renameSync, statSync, unlinkSync,
} from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'C:\\KioskVideos';

// ── mp4 inspection (compact copy of diagnose-videos.mjs's parser) ──────────
function readAt(fd, pos, len) {
  const buf = Buffer.alloc(len);
  const n = readSync(fd, buf, 0, len, pos);
  return buf.subarray(0, n);
}
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
    } else if (size === 0) size = fileSize - pos;
    if (size < 8) break;
    boxes.push({ type, start: pos, size });
    pos += size;
  }
  return boxes;
}
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
function videoTrackInfo(moov) {
  let pos = 0;
  while (pos + 8 <= moov.length) {
    const size = moov.readUInt32BE(pos);
    const type = moov.toString('latin1', pos + 4, pos + 8);
    if (size < 8 || pos + size > moov.length) break;
    if (type === 'trak') {
      const stsd = findBox(moov.subarray(pos + 8, pos + size), 'stsd');
      if (stsd && stsd.length >= 40) {
        const entry = stsd.subarray(8);
        const codec = entry.toString('latin1', 4, 8);
        if (['avc1', 'avc3', 'hvc1', 'hev1', 'vp09', 'av01', 'mp4v'].includes(codec)) {
          return { codec, width: entry.readUInt16BE(32), height: entry.readUInt16BE(34) };
        }
      }
    }
    pos += size;
  }
  return { codec: '?', width: 0, height: 0 };
}
function inspect(path) {
  const fileSize = statSync(path).size;
  const fd = openSync(path, 'r');
  try {
    const boxes = topLevelBoxes(fd, fileSize);
    const moovBox = boxes.find((b) => b.type === 'moov');
    const mdatBox = boxes.find((b) => b.type === 'mdat');
    if (!moovBox) return null;
    const faststart = !mdatBox || moovBox.start < mdatBox.start;
    const moov = readAt(fd, moovBox.start + 8, Math.min(moovBox.size - 8, 32 * 1024 * 1024));
    return { fileSize, faststart, ...videoTrackInfo(moov) };
  } finally {
    closeSync(fd);
  }
}

// ── ffmpeg ─────────────────────────────────────────────────────────────────
if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) {
  console.error('ffmpeg not found on PATH. Install it (winget install Gyan.FFmpeg) and retry.');
  process.exit(1);
}
function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  return r.status === 0;
}

// ── the pass ───────────────────────────────────────────────────────────────
if (!existsSync(root)) {
  console.error(`No such directory: ${root}`);
  process.exit(1);
}
const sets = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name);

let fixed = 0;
let skipped = 0;
let failed = 0;

for (const set of sets) {
  const dir = join(root, set);
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mp4'));
  if (files.length === 0) continue;
  console.log(`\n── ${set} (${files.length} files) ─────────────────────────`);
  const bakDir = join(root, '_originals', set);

  for (const name of files) {
    const src = join(dir, name);
    const bak = join(bakDir, name);
    if (existsSync(bak)) {
      console.log(`  ✓ ${name} — already processed (backup exists)`);
      skipped++;
      continue;
    }
    let info;
    try {
      info = inspect(src);
    } catch {
      info = null;
    }
    if (!info) {
      console.log(`  ✗ ${name} — unreadable mp4, left alone`);
      failed++;
      continue;
    }
    const shortSide = Math.min(info.width, info.height);
    const heavy = shortSide > 1080 || ['hvc1', 'hev1'].includes(info.codec);
    if (!heavy && info.faststart) {
      console.log(`  ✓ ${name} — already fine (${info.width}x${info.height}, faststart)`);
      skipped++;
      continue;
    }

    const tmp = join(dir, `~${name}`);
    // Portrait kiosk footage → 1080×1920; landscape (just in case) → 1920×1080.
    const scale = info.width >= info.height ? 'scale=1920:1080' : 'scale=1080:1920';
    const args = heavy
      ? ['-i', src, '-vf', scale, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
         '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '128k', tmp]
      : ['-i', src, '-c', 'copy', '-movflags', '+faststart', tmp]; // lossless remux
    process.stdout.write(`  … ${name} (${heavy ? 're-encode' : 'faststart remux'})`);
    if (!ffmpeg(args) || !existsSync(tmp) || statSync(tmp).size === 0) {
      if (existsSync(tmp)) unlinkSync(tmp);
      console.log(' — FAILED, original untouched');
      failed++;
      continue;
    }
    mkdirSync(bakDir, { recursive: true });
    // backup first — the original is never deleted. A rename fails when the
    // kiosk app is streaming that clip right now (Windows file lock): count it
    // and move on; close the app (or run after the 02:00 reboot) and re-run.
    try {
      renameSync(src, bak);
    } catch (err) {
      unlinkSync(tmp);
      console.log(` — FAILED, file in use? Close the kiosk app and re-run (${err.code ?? err.message})`);
      failed++;
      continue;
    }
    try {
      renameSync(tmp, src);
    } catch (err) {
      renameSync(bak, src); // put the original back — never leave a gap
      unlinkSync(tmp);
      console.log(` — FAILED to swap in, original restored (${err.code ?? err.message})`);
      failed++;
      continue;
    }
    console.log(
      ` → ${(statSync(src).size / 1e6).toFixed(1)}MB (was ${(info.fileSize / 1e6).toFixed(0)}MB)`,
    );
    fixed++;
  }
}

console.log(`\nDone: ${fixed} fixed, ${skipped} already fine, ${failed} failed.`);
console.log(`Originals kept under ${join(root, '_originals')} — delete that folder only when happy.`);
console.log('Restart the kiosk app (or wait for the 02:00 reboot) to pick the files up.');
