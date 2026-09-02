// Scenario checks for the 키 측정 (ZED visitor-height) plumbing.
//
//   npm run height:selftest
//
// This covers the TypeScript half — the sidecar's own measurement maths is
// tested separately and far more thoroughly by `npm run height:test` (pytest,
// against synthetic bodies). What is checked here is the part that sits between
// a working sidecar and a stored row, and that fails SILENTLY when it is wrong:
// a torn stdout chunk loses a measurement, and a mis-scoped capture window
// folds one visitor's frames into the next visitor's median. Neither raises
// anything; both just quietly produce worse data.
//
// No test framework: this project has none, and one command that prints
// PASS/FAIL lines is worth more here than a dependency. (Same reasoning, and
// the same loader, as footfall-selftest.mjs.)

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { transform } from 'esbuild';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Load one .ts module. Both files import only TYPES, so stripping is enough. */
async function loadModule(file) {
  const source = await readFile(join(ROOT, file), 'utf8');
  const { code } = await transform(source, { loader: 'ts', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

const { NdjsonBuffer } = await loadModule('src/main/core/ndjson.ts');
const { isCameraLive, toMeasurement } = await loadModule(
  'src/main/services/height/captureWindow.ts',
);

let failures = 0;

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}\n          expected ${e}\n          actual   ${a}`);
  }
}

// ── stdout reassembly ──────────────────────────────────────────────────────
// The failure this prevents is not a crash. A `result` message split across two
// pipe writes would simply never parse, and one capture in however-many would
// silently go unrecorded.
console.log('\nNdjsonBuffer — stdout arrives in whatever pieces the pipe chooses');
{
  const buffer = new NdjsonBuffer();
  check('a whole line in one chunk', buffer.push('{"type":"pong"}\n'), ['{"type":"pong"}']);

  check('a line split across two chunks yields nothing yet', buffer.push('{"type":"res'), []);
  check('...and completes on the next', buffer.push('ult"}\n'), ['{"type":"result"}']);

  check('several lines in one chunk', buffer.push('{"a":1}\n{"b":2}\n{"c":3}\n'), [
    '{"a":1}',
    '{"b":2}',
    '{"c":3}',
  ]);

  check('two and a half lines', buffer.push('{"d":4}\n{"e":5}\n{"f":'), ['{"d":4}', '{"e":5}']);
  check('...the half finishes later', buffer.push('6}\n'), ['{"f":6}']);

  check('blank lines are dropped', buffer.push('\n\n{"g":7}\n\n'), ['{"g":7}']);

  // Windows line endings: Python writes "\n" but a pipe on Windows can still
  // deliver "\r\n". A stray \r would make every JSON.parse fail.
  check('CRLF is trimmed, not parsed', buffer.push('{"h":8}\r\n'), ['{"h":8}']);
}
{
  const buffer = new NdjsonBuffer();
  buffer.push('{"partial":');
  buffer.reset();
  check(
    'reset drops the fragment a dead child left behind',
    buffer.push('{"fresh":1}\n'),
    ['{"fresh":1}'],
  );
}

// ── the capture window ─────────────────────────────────────────────────────
// Getting this wrong does not fail loudly either: too narrow and the median has
// too few frames, too wide and the previous visitor is still in the buffer.
console.log('\nisCameraLive — which phases the ZED samples through');
{
  // 제주 arms the gesture gate during `preview`, so the visitor is already in
  // position and posing before the countdown starts. Sampling both is what
  // turns a 10 s window into 15-30 s.
  check('preview (gesture gate armed, visitor posing)', isCameraLive('preview'), true);
  check('countdown', isCameraLive('countdown'), true);

  check('idle', isCameraLive('idle'), false);
  check('clothing', isCameraLive('clothing'), false);
  check('style', isCameraLive('style'), false);
  // Sampling past the shutter would put the NEXT visitor walking up to the
  // kiosk into THIS visitor's median.
  check('generating (photo already taken)', isCameraLive('generating'), false);
  check('result', isCameraLive('result'), false);
}

// ── edge-triggering ────────────────────────────────────────────────────────
// One 제주 capture broadcasts many transitions — gate armed, countdown started,
// and once per second as it ticks. Level-triggering would re-send `start` on
// each and discard every frame collected so far.
console.log('\nEdge-triggering — one capture must produce exactly one start/stop');
{
  const sent = [];
  let sampling = false;
  const feed = (phase) => {
    const live = isCameraLive(phase);
    if (live === sampling) return;
    sampling = live;
    sent.push(live ? 'start' : 'stop');
  };

  // A realistic 제주 run: pick outfit, gate arms, palm seen, count ticks down,
  // shutter, AI runs, result shown.
  for (const phase of [
    'idle',
    'clothing',
    'style',
    'preview', // gate armed — sampling begins here
    'preview', // still waiting for a palm
    'countdown', // 10
    'countdown', // 9 ... each tick re-broadcasts
    'countdown', // 8
    'generating', // shutter — sampling ends here
    'result',
    'idle',
  ]) {
    feed(phase);
  }
  check('exactly one start and one stop', sent, ['start', 'stop']);
}

// ── reading the sidecar's answer ───────────────────────────────────────────
// The sidecar is a separate process upgraded independently of the app, so a
// kiosk can be running one built from a different commit. Every field has to
// degrade rather than throw — this runs inside the photo workflow's broadcast.
console.log('\ntoMeasurement — a result frame from a process we do not control');
{
  check(
    'a normal solo capture',
    toMeasurement({
      type: 'result',
      heightCm: 171.4,
      confidence: 0.86,
      samples: 184,
      subjects: 1,
      reason: null,
    }),
    { heightCm: 171.4, confidence: 0.86, samples: 184, subjects: 1, reason: null },
  );

  check(
    'a 같이찍기 capture reports no height',
    toMeasurement({
      type: 'result',
      heightCm: null,
      confidence: 0,
      samples: 0,
      subjects: 2,
      reason: 'more than one visitor in frame',
    }),
    {
      heightCm: null,
      confidence: 0,
      samples: 0,
      subjects: 2,
      reason: 'more than one visitor in frame',
    },
  );

  check('an empty frame does not throw', toMeasurement({}), {
    heightCm: null,
    confidence: 0,
    samples: 0,
    subjects: 0,
    reason: null,
  });

  // A height that arrived as a string would otherwise reach SQLite as one and
  // sit in a REAL column forever.
  check(
    'wrong types are refused, not coerced',
    toMeasurement({ heightCm: '171.4', confidence: 'high', samples: null, subjects: {} }),
    { heightCm: null, confidence: 0, samples: 0, subjects: 0, reason: null },
  );

  check(
    'NaN and Infinity are not heights',
    toMeasurement({ heightCm: NaN, confidence: Infinity, samples: 3, subjects: 1 }),
    { heightCm: null, confidence: 0, samples: 3, subjects: 1, reason: null },
  );
}

console.log('');
if (failures > 0) {
  console.log(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log('All checks passed.');
