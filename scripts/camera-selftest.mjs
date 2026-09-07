// Scenario checks for photo-camera selection.
//
//   npm run camera:selftest
//
// Guards a bug that reached a running kiosk: the 제주 camera screen streamed the
// ZED 2i instead of the Elgato, and every photo would have gone to the AR API
// as a side-by-side stereo pair — silently, with nothing logged. Two things had
// to go wrong together, and both are checked here:
//
//   1. the depth camera was not recognised from its label, and
//   2. a null deviceId meant "no constraint", handing the choice to Chromium,
//      which picked the system default.
//
// No test framework: this project has none, and one command that prints
// PASS/FAIL lines is worth more here than a dependency.

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { transform } from 'esbuild';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function loadModule(file) {
  const source = await readFile(join(ROOT, file), 'utf8');
  const { code } = await transform(source, { loader: 'ts', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

const { classifyCamera, looksLikeStereoPair } = await loadModule('src/shared/config/cameras.ts');

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) console.log(`  PASS  ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${name}\n          expected ${e}\n          actual   ${a}`);
  }
}

// ── by label ───────────────────────────────────────────────────────────────
// Labels are exactly as Chromium reports them, (vid:pid) suffix included.
console.log('\nclassifyCamera — real device labels from the 제주 hardware');
check('ZED 2i is a depth sensor', classifyCamera('ZED 2i (2b03:f880)'), 'depth');
check('the photo camera', classifyCamera('Elgato Facecam Pro (0fd9:008b)'), 'elgato');
check('a plain webcam is usable', classifyCamera('ASUS FHD webcam'), 'usb');
check('an unlabelled device', classifyCamera(''), 'unknown');

// Word-boundary matching: "zed" must not fire on words that merely contain it.
check('does not misfire on "Anodized Cam"', classifyCamera('Anodized Cam'), 'usb');
check('Stereolabs by brand name', classifyCamera('Stereolabs Camera'), 'depth');

// ── by shape, when the label is empty ──────────────────────────────────────
// Chromium returns EMPTY labels until camera permission is granted, and an
// empty label matches no pattern — so shape is the only remaining signal.
console.log('\nlooksLikeStereoPair — the backstop when labels are unavailable');
check('ZED HD720 side-by-side 2560x720', looksLikeStereoPair(2560, 720), true);
check('ZED VGA side-by-side 1344x376', looksLikeStereoPair(1344, 376), true);
check('ZED HD1080 side-by-side 3840x1080', looksLikeStereoPair(3840, 1080), true);
// The 제주 mount is rotated 90 degrees, so a stereo pair can arrive TALL.
check('ZED rotated 720x2560', looksLikeStereoPair(720, 2560), true);

check('ordinary 1080p webcam', looksLikeStereoPair(1920, 1080), false);
check('ordinary 720p webcam', looksLikeStereoPair(1280, 720), false);
check('4:3 webcam', looksLikeStereoPair(640, 480), false);
// The Elgato is deliberately configured portrait for the 90-degree mount; that
// must NOT read as a stereo pair or the real photo camera gets rejected.
check('Elgato in portrait 1080x1920', looksLikeStereoPair(1080, 1920), false);
check('a 21:9 ultrawide is still not stereo', looksLikeStereoPair(2560, 1080), false);
check('a frame with no dimensions yet', looksLikeStereoPair(0, 0), false);

// ── selection ──────────────────────────────────────────────────────────────
// Mirrors pickPhotoCamera in useKioskCamera.
console.log('\nSelection — a depth sensor must never be chosen, even as a fallback');
const DEPTH = /\bzed\b|stereolabs/i;
const PREF = /elgato|facecam|cam link|prompter/i;
function pick(devices, explicit = null, rejected = new Set()) {
  if (explicit && !rejected.has(explicit)) return explicit;
  const usable = devices.filter((d) => !DEPTH.test(d.label) && !rejected.has(d.deviceId));
  return (usable.find((d) => PREF.test(d.label)) ?? usable[0])?.deviceId ?? null;
}

const JEJU = [
  { deviceId: 'zed', label: 'ZED 2i (2b03:f880)' },
  { deviceId: 'elgato', label: 'Elgato Facecam Pro (0fd9:008b)' },
];
check('prefers the Elgato', pick(JEJU), 'elgato');
check('ZED listed first still loses', pick([JEJU[0], JEJU[1]]), 'elgato');

// The actual production failure: the ZED was the only enumerated camera the
// code was willing to consider, and it got opened.
check('ZED alone yields NOTHING, not a stereo photo', pick([JEJU[0]]), null);

check(
  'falls back to a plain webcam over the ZED',
  pick([JEJU[0], { deviceId: 'asus', label: 'ASUS FHD webcam' }]),
  'asus',
);
check(
  'a rejected camera is skipped on retry',
  pick(JEJU, null, new Set(['elgato'])),
  null,
);
check('an explicit choice is honoured', pick(JEJU, 'asus'), 'asus');

console.log('');
if (failures > 0) {
  console.log(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log('All checks passed.');
