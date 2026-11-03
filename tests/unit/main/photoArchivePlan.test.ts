import { describe, expect, it } from 'vitest';
import {
  classifySendResponse,
  kstIso,
  listFolder,
  mayBeSinceEnabled,
  needsSend,
  parseStatusEnabled,
  selectCandidates,
  type ArchiveRecord,
  type SelectOptions,
  type StatEntry,
} from '@main/services/photoArchive/plan';

const MIN = 60_000;
const NOW = Date.UTC(2026, 10, 3, 6, 0, 0); // 2026-11-03 15:00 KST

const opts = (over: Partial<SelectOptions> = {}): SelectOptions => ({
  now: NOW,
  enabledSince: NOW - 24 * 60 * MIN,
  minAgeMs: 10 * MIN,
  resultMinAgeMs: MIN,
  limit: 40,
  demoteAfterAttempts: 3,
  ...over,
});

const entry = (fileName: string, ageMin: number, over: Partial<StatEntry> = {}): StatEntry => ({
  fileName,
  mtimeMs: NOW - ageMin * MIN,
  result: null,
  attempts: 0,
  ...over,
});

const record = (over: Partial<ArchiveRecord> = {}): ArchiveRecord => ({
  fileName: 'Captured_20261103_1.jpg',
  state: 'sent',
  withResult: true,
  attempts: 1,
  ...over,
});

describe('listFolder', () => {
  it('pairs originals with their _Ai composite and ignores everything else', () => {
    const { originals, results } = listFolder([
      'Captured_20261103_2896.jpg',
      'Captured_20261103_2896_Ai.jpg',
      'Captured_20261103_2897.png',
      'Captured_20261103_2897_Ai.jpg',
      'Captured_20261103_2898.jpeg',
      'Captured_20261103_2899.JPG', // the server's pattern is lower-case only
      'Captured_2026110_1.jpg',
      'token_abc.jpg',
      'Captured_20261103_2896.jpg.tmp',
      'desktop.ini',
    ]);
    expect(originals.sort()).toEqual([
      'Captured_20261103_2896.jpg',
      'Captured_20261103_2897.png',
      'Captured_20261103_2898.jpeg',
    ]);
    expect(results.get('Captured_20261103_2896')).toBe('Captured_20261103_2896_Ai.jpg');
    expect(results.get('Captured_20261103_2897')).toBe('Captured_20261103_2897_Ai.jpg');
    expect(results.has('Captured_20261103_2898')).toBe(false);
  });

  it('never treats a composite as an original', () => {
    expect(listFolder(['Captured_20261103_1_Ai.jpg']).originals).toEqual([]);
  });
});

describe('needsSend', () => {
  it('sends files never tried and files still pending', () => {
    expect(needsSend(undefined, false)).toBe(true);
    expect(needsSend(record({ state: 'pending', withResult: false }), false)).toBe(true);
  });

  it('skips files sent with their composite and files given up', () => {
    expect(needsSend(record(), true)).toBe(false);
    expect(needsSend(record({ state: 'given_up', withResult: false }), true)).toBe(false);
  });

  it('re-sends a file sent alone once its composite appears', () => {
    expect(needsSend(record({ withResult: false }), false)).toBe(false);
    expect(needsSend(record({ withResult: false }), true)).toBe(true);
  });
});

describe('selectCandidates', () => {
  it('waits 10 minutes after the original and 1 minute after the composite', () => {
    const out = selectCandidates(
      [
        entry('Captured_20261103_1.jpg', 9),
        entry('Captured_20261103_2.jpg', 11),
        entry('Captured_20261103_3.jpg', 30, {
          result: { fileName: 'Captured_20261103_3_Ai.jpg', mtimeMs: NOW - 30_000 },
        }),
        entry('Captured_20261103_4.jpg', 30, {
          result: { fileName: 'Captured_20261103_4_Ai.jpg', mtimeMs: NOW - 2 * MIN },
        }),
      ],
      opts(),
    );
    expect(out.map((c) => c.fileName)).toEqual([
      'Captured_20261103_2.jpg',
      'Captured_20261103_4.jpg',
    ]);
    expect(out[0]!.resultFileName).toBeNull();
    expect(out[1]!.resultFileName).toBe('Captured_20261103_4_Ai.jpg');
  });

  it('never picks a photo modified before enabledSince', () => {
    const enabledSince = NOW - 60 * MIN;
    const out = selectCandidates(
      [
        entry('Captured_20261103_1.jpg', 61),
        entry('Captured_20261103_2.jpg', 60),
        entry('Captured_20261103_3.jpg', 30),
      ],
      opts({ enabledSince }),
    );
    expect(out.map((c) => c.fileName)).toEqual([
      'Captured_20261103_3.jpg',
      'Captured_20261103_2.jpg',
    ]);
  });

  it('orders newest first, failing files last', () => {
    const out = selectCandidates(
      [
        entry('Captured_20261103_10.jpg', 200),
        entry('Captured_20261103_20.jpg', 40, { attempts: 3 }),
        entry('Captured_20261103_21.jpg', 20),
        entry('Captured_20261103_22.jpg', 15),
      ],
      opts(),
    );
    expect(out.map((c) => c.fileName)).toEqual([
      'Captured_20261103_22.jpg',
      'Captured_20261103_21.jpg',
      'Captured_20261103_10.jpg',
      'Captured_20261103_20.jpg',
    ]);
  });

  it('caps the pairs per cycle', () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      entry(`Captured_20261103_${i + 1}.jpg`, 20 + i),
    );
    const out = selectCandidates(many, opts({ limit: 40 }));
    expect(out).toHaveLength(40);
    expect(out[0]!.fileName).toBe('Captured_20261103_1.jpg');
  });
});

describe('mayBeSinceEnabled', () => {
  // 2026-11-03 15:00 KST
  it('skips names dated more than a day before enabledSince, without a stat', () => {
    expect(mayBeSinceEnabled('Captured_20261103_1.jpg', NOW)).toBe(true);
    expect(mayBeSinceEnabled('Captured_20261102_1.jpg', NOW)).toBe(true); // one day of slack
    expect(mayBeSinceEnabled('Captured_20261101_1.jpg', NOW)).toBe(false);
    expect(mayBeSinceEnabled('Captured_20250101_1.jpg', NOW)).toBe(false);
    expect(mayBeSinceEnabled('Captured_20261201_1.jpg', NOW)).toBe(true);
  });
});

describe('classifySendResponse', () => {
  it('follows the contract table', () => {
    expect(classifySendResponse(200, { success: true, data: { stored: true } })).toEqual({
      kind: 'stored',
    });
    expect(classifySendResponse(200, { success: true, data: { stored: false } })).toEqual({
      kind: 'discarded',
    });
    expect(classifySendResponse(400, { success: false })).toEqual({
      kind: 'rejected',
      status: 400,
    });
    expect(classifySendResponse(413, null)).toEqual({ kind: 'rejected', status: 413 });
    expect(classifySendResponse(500, null).kind).toBe('retry');
    expect(classifySendResponse(503, null).kind).toBe('retry');
  });

  it('retries instead of guessing when the answer is not the contract', () => {
    // 404 = a server without the endpoint yet: the file is fine, try later.
    expect(classifySendResponse(404, null).kind).toBe('retry');
    expect(classifySendResponse(200, null).kind).toBe('retry');
    expect(classifySendResponse(200, { data: {} }).kind).toBe('retry');
  });
});

describe('parseStatusEnabled', () => {
  it('only an explicit true enables sending', () => {
    expect(parseStatusEnabled({ success: true, data: { enabled: true } })).toBe(true);
    expect(parseStatusEnabled({ success: true, data: { enabled: false } })).toBe(false);
    expect(parseStatusEnabled({ success: true, data: { enabled: 'true' } })).toBe(false);
    expect(parseStatusEnabled({ success: true, data: null })).toBe(false);
    expect(parseStatusEnabled(null)).toBe(false);
  });
});

describe('kstIso', () => {
  it('is KST wall-clock time to the second, without an offset', () => {
    expect(kstIso(Date.UTC(2026, 10, 3, 5, 30, 12, 999))).toBe('2026-11-03T14:30:12');
    expect(kstIso(Date.UTC(2026, 11, 31, 15, 0, 0))).toBe('2027-01-01T00:00:00');
  });
});
