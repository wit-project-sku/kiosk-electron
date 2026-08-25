// Scenario checks for the 유동인구 counting logic.
//
//   npm run footfall:selftest
//
// The tracker and the line counter are pure functions of a sequence of boxes,
// which makes them the one part of this feature that can be verified without a
// camera, a kiosk, or a person willing to walk past one. Run it after touching
// ObjectTracker, LineCrossingCounter, or the tuning defaults — several of those
// numbers only look reasonable until you simulate a walk with them. The
// proximity fallback in ObjectTracker exists BECAUSE of the third case below:
// with plain IoU association at these frame rates it counted nothing at all.
//
// No test framework: this project has none, and one command that prints
// PASS/FAIL lines is worth more here than a dependency.

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { transform } from 'esbuild';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = join(ROOT, 'src', 'renderer', 'src', 'lib', 'footfall');

/** Load one .ts module. Both files import only TYPES, so stripping is enough. */
async function loadModule(file) {
  const source = await readFile(join(LIB, file), 'utf8');
  const { code } = await transform(source, { loader: 'ts', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

const { ObjectTracker } = await loadModule('ObjectTracker.ts');
const { LineCrossingCounter } = await loadModule('LineCrossingCounter.ts');

const W = 640;
const H = 480;
const VERTICAL = { orientation: 'vertical', position: 0.5 };
const HORIZONTAL = { orientation: 'horizontal', position: 0.5 };
// Mirrors DEFAULT_FOOTFALL_TUNING — update both together.
const OPTS = { matchThreshold: 0.3, trackScoreThreshold: 0.45, maxAge: 18 };
const MIN_HITS = 3;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}` +
      (ok ? '' : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`),
  );
}

function run(frames, line = VERTICAL) {
  const tracker = new ObjectTracker();
  const counter = new LineCrossingCounter();
  const events = [];
  const ids = new Set();
  for (const detections of frames) {
    const tracks = tracker.update(detections, OPTS);
    tracks.forEach((t) => ids.add(t.id));
    for (const crossing of counter.check(tracks, line, W, H, MIN_HITS)) {
      events.push(crossing.direction);
    }
  }
  return { events, distinctIds: ids.size };
}

/** A person ~2 m away: 110 px wide. At 6 fps a walking step is ~45 px here. */
const near = (x) => ({ bbox: [x, 150, 110, 260], confidence: 0.8 });
/** Smaller and faster: 60 px wide moving 50 px a frame — boxes barely touch. */
const fast = (x) => ({ bbox: [x, 200, 60, 160], confidence: 0.8 });

const walk = [40, 85, 130, 175, 220, 265, 310, 355, 400, 445, 490];

check('walk L→R at walking pace', run(walk.map((x) => [near(x)])).events, ['in']);
check('walk R→L at walking pace', run([...walk].reverse().map((x) => [near(x)])).events, ['out']);
check(
  'walk L→R, small box, big steps',
  run([50, 100, 150, 200, 250, 300, 350, 400, 450].map((x) => [fast(x)])).events,
  ['in'],
);
check('one identity for the whole walk', run(walk.map((x) => [near(x)])).distinctIds, 1);

// Someone waiting by the line, drifting back and forth across it. Only the
// COUNT is asserted: a track that reaches its min-hits bar while already past
// the line records whichever way it next goes, which for a loiterer is
// arbitrary. A walker entering at the frame edge meets the bar long before the
// line, which is why the direction assertions above are safe.
check(
  'loiterer counted once, not once per drift',
  run([250, 270, 300, 275, 250, 285, 310, 280, 255, 295, 320, 270, 245].map((x) => [near(x)]))
    .events.length,
  1,
);

check('single flickering box rejected', run([[near(250)], [], [near(360)], [], [near(250)], []]).events, []);
check(
  'approach and stop is not a crossing',
  run([40, 85, 130, 175, 200, 210, 212, 212, 212].map((x) => [near(x)])).events,
  [],
);
check(
  'two people side by side count twice',
  run(walk.map((x) => [near(x), { bbox: [x + 30, 20, 110, 260], confidence: 0.8 }])).events,
  ['in', 'in'],
);
check(
  'two frames of occlusion keep one count',
  run([
    [near(40)],
    [near(85)],
    [near(130)],
    [near(175)],
    [],
    [],
    [near(310)],
    [near(355)],
    [near(400)],
  ]).events,
  ['in'],
);
check(
  'weak detections alone never start a track',
  run(
    [250, 295, 340, 385].map((x) => [{ bbox: [x, 150, 110, 260], confidence: 0.3 }]),
  ).events,
  [],
);
check(
  'horizontal line counts someone walking toward the kiosk',
  run(
    [20, 70, 120, 170, 220, 270, 320].map((y) => [{ bbox: [260, y, 110, 130], confidence: 0.8 }]),
    HORIZONTAL,
  ).events,
  ['in'],
);

console.log(failures === 0 ? '\nAll footfall scenarios passed.' : `\n${failures} scenario(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
