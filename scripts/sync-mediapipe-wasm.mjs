/* eslint-disable no-console -- build-time CLI script; console is the intended output. */
/**
 * Keep the bundled MediaPipe WASM runtime in lockstep with the installed
 * `@mediapipe/tasks-vision` package.
 *
 * The gesture / face-tracking hooks load the WASM loader (`vision_wasm_*.js`)
 * and binary (`vision_wasm_*.wasm`) at runtime from `public/mediapipe/wasm/`,
 * while the JS API (`GestureRecognizer`, `FilesetResolver`) comes from
 * node_modules. MediaPipe requires the loader version to match the API version
 * EXACTLY — if they drift (e.g. an `npm install` on another branch bumps the
 * package but the committed loader is stale), `createFromOptions` silently fails
 * or hangs and the effects screen sits on "효과 준비 중" forever.
 *
 * Running this on every install copies the loader straight from the resolved
 * package so the two can never drift apart. Idempotent; safe to run anytime.
 */
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const destDir = join(root, 'src', 'renderer', 'public', 'mediapipe', 'wasm');

if (!existsSync(srcDir)) {
  // Dependency not installed yet (or hoisted elsewhere) — nothing to sync.
  console.warn('[sync-mediapipe-wasm] @mediapipe/tasks-vision not found; skipped.');
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });

let copied = 0;
for (const file of readdirSync(srcDir)) {
  copyFileSync(join(srcDir, file), join(destDir, file));
  copied += 1;
}

console.log(`[sync-mediapipe-wasm] synced ${copied} runtime file(s) → public/mediapipe/wasm`);
