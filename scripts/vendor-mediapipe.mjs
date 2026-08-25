/**
 * Vendors the MediaPipe vision runtime into `resources/mediapipe/`.
 *
 * The kiosk is offline-first, so nothing may be fetched from a CDN at runtime:
 * the WASM runtime is copied out of node_modules and the hand-landmark model is
 * downloaded ONCE, here. Both are committed, exactly like `payment-agent/dist`,
 * so a fresh clone (or a CI box with no network) can still build an installer.
 *
 *   npm run vendor:mediapipe
 *
 * ── Only the SIMD build is vendored, and there is a trap here ──────────
 * `FilesetResolver` feature-detects WASM SIMD by instantiating a tiny probe
 * module, and asks for `vision_wasm_nosimd_internal.*` (a second 9.4 MB pair)
 * when that throws. Electron 34 supports SIMD, so the probe passes and only
 * `vision_wasm_internal.*` is ever requested — VERIFIED against this Electron
 * under the production CSP, not assumed.
 *
 * The trap: the probe also throws when the page's `script-src` lacks
 * `'wasm-unsafe-eval'`, because that refuses ALL WebAssembly compilation. The
 * symptom is not "WASM is blocked", it is a 404 for the nosimd file nobody
 * expected to be asked for. If you ever see this script's output blamed for a
 * missing `*_nosimd_*` file, the real fault is the CSP in
 * `src/main/core/security.ts` — adding the file would only move the failure one
 * step later, to the compile.
 *
 * When it does fail, it fails safely: the loader 404s, `useHandGesture` reports
 * itself unavailable, and the camera screen's fallback timer starts the
 * countdown anyway. The kiosk keeps taking photos without the gesture.
 */
import { createWriteStream } from 'node:fs';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'resources', 'mediapipe');
const WASM_SRC = join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');

/** Copied verbatim out of the installed @mediapipe/tasks-vision. */
const WASM_FILES = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'];

/**
 * The two models this app runs, both off the same vendored WASM runtime.
 *
 * 1. Hand landmarks — 21 points per hand. The open-palm / closed-fist
 *    classification is ours (see `lib/handGesture.ts`), so the heavier canned
 *    `gesture_recognizer.task` bundle is not needed.
 * 2. EfficientDet-Lite0 — COCO object detection, of which 유동인구 counting uses
 *    exactly the 'person' class (see `lib/footfall/PersonDetector.ts`). The
 *    float32 build, to match the file already vendored. Its metadata carries the
 *    90-label `labels.txt` that `categoryAllowlist: ['person']` resolves
 *    against; a bare .tflite without that metadata would load and then match
 *    nothing.
 */
const MODELS = [
  {
    file: 'hand_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  },
  {
    file: 'efficientdet_lite0.tflite',
    url: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite',
  },
];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const file of WASM_FILES) {
    const from = join(WASM_SRC, file);
    if (!(await exists(from))) {
      throw new Error(`Missing ${from} — run \`npm install\` first.`);
    }
    await copyFile(from, join(OUT_DIR, file));
    console.log(`copied  ${file}`);
  }

  for (const model of MODELS) {
    const modelPath = join(OUT_DIR, model.file);
    if (await exists(modelPath)) {
      console.log(`present ${model.file} (delete it to re-download)`);
      continue;
    }
    const response = await fetch(model.url);
    if (!response.ok || !response.body) {
      throw new Error(`Download failed for ${model.url}: ${response.status}`);
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(modelPath));
    console.log(`downloaded ${model.file}`);
  }

  const total = (
    await Promise.all(
      [...WASM_FILES, ...MODELS.map((m) => m.file)].map(
        async (f) => (await stat(join(OUT_DIR, f))).size,
      ),
    )
  ).reduce((a, b) => a + b, 0);
  console.log(`\nresources/mediapipe → ${(total / 1024 / 1024).toFixed(1)} MB`);
}

await main();
