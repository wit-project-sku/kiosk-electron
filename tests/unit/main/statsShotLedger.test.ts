import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/core/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

import { StatsService } from '@main/services/StatsService';
import type { KioskService } from '@main/services/KioskService';
import type { FailedRequestService } from '@main/services/FailedRequestService';
import { MemoryShotLedger } from '@main/services/shotLedger/ShotLedger';
import {
  HOUR_MS,
  KEEP_SENT_MS,
  REJECTED_RETRY_MS,
  STALE_OPEN_MS,
} from '@main/services/shotLedger/plan';

const BASE = 'https://api.example.test';
const SHOTS = `${BASE}/api/stats/shots`;
const MEASUREMENT = `${BASE}/api/stats/shots/measurement`;

const kioskOf = (layout: string, id: number): KioskService =>
  ({
    kioskNum: () => id,
    identityNum: () => id,
    getConfig: () => ({ layout }),
  }) as unknown as KioskService;

/** Nothing queued by older versions; the batch re-sends find an empty queue. */
const noQueue = { listByType: () => [], record: vi.fn() } as unknown as FailedRequestService;

type Answer = number | 'network';
/** fetch that answers per URL from a script; records every call. */
function serve(answers: Record<string, Answer[]>): { calls: { url: string; body: unknown }[] } {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const body =
        typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : '(multipart)';
      calls.push({ url, body });
      const answer = answers[url]?.shift() ?? 200;
      if (answer === 'network') throw new TypeError('fetch failed');
      return new Response('{}', { status: answer });
    }),
  );
  return { calls };
}

let now: number;
let ledger: MemoryShotLedger;
const make = (kiosk: KioskService): StatsService =>
  new StatsService(kiosk, noQueue, { ledger, now: () => now });

beforeEach(() => {
  process.env['WITTERIA_API_BASE'] = BASE;
  now = Date.UTC(2026, 10, 11, 3, 0, 0);
  ledger = new MemoryShotLedger();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['WITTERIA_API_BASE'];
});

describe('촬영 장부 — every shot is written first and sent from the ledger', () => {
  it('a shot the server takes is kept as sent, not deleted', async () => {
    serve({});
    const stats = make(kioskOf('INSADONG', 1));

    expect(await stats.recordShot({ eventId: 'e1', isSuccess: true, outfitCode: '1.1' })).toBe(
      true,
    );

    expect(ledger.get('e1')).toMatchObject({ state: 'sent', sentAt: now });
    expect(ledger.notes.some((line) => line.includes('전송 완료'))).toBe(true);
  });

  it('a network failure stays in the ledger and goes out on the next cycle with its outfit', async () => {
    const { calls } = serve({ [SHOTS]: ['network'] });
    const stats = make(kioskOf('INSADONG', 1));

    expect(await stats.recordShot({ eventId: 'e1', isSuccess: true, outfitCode: '5.6' })).toBe(
      false,
    );
    expect(ledger.get('e1')?.state).toBe('pending');

    now += HOUR_MS;
    expect(await stats.syncShotLedger()).toEqual({ sent: 1, kept: 0 });
    expect(ledger.get('e1')?.state).toBe('sent');
    expect(calls[1]).toMatchObject({ url: SHOTS, body: { eventId: 'e1', outfitCode: '5.6' } });
  });

  it('a rejected shot is never dropped: skipped for a day, then tried again', async () => {
    const { calls } = serve({ [SHOTS]: [401] });
    const stats = make(kioskOf('INSADONG', 1));

    await stats.recordShot({ eventId: 'e1', isSuccess: true, outfitCode: '1.1' });
    expect(ledger.get('e1')?.state).toBe('rejected');

    now += HOUR_MS;
    await stats.syncShotLedger();
    expect(calls).toHaveLength(1);

    now += REJECTED_RETRY_MS;
    await stats.syncShotLedger();
    expect(ledger.get('e1')?.state).toBe('sent');
  });

  it('a shot whose composite never finished is reported as a failed shot', async () => {
    const { calls } = serve({});
    const stats = make(kioskOf('INSADONG', 1));

    stats.openShot({ eventId: 'e1', outfitCode: '1.1', shotType: 'SOLO' });
    await stats.syncShotLedger();
    expect(calls).toHaveLength(0);

    now += STALE_OPEN_MS;
    await stats.syncShotLedger();
    expect(calls[0]?.body).toMatchObject({ eventId: 'e1', isSuccess: false, outfitCode: '1.1' });
    expect(ledger.get('e1')?.state).toBe('sent');
  });

  it('stops the cycle when the line is down instead of trying every row', async () => {
    const { calls } = serve({ [SHOTS]: Array<Answer>(10).fill('network') });
    const stats = make(kioskOf('INSADONG', 1));
    for (let i = 0; i < 5; i++) {
      await stats.recordShot({ eventId: `e${i}`, isSuccess: true, outfitCode: '1.1' });
    }
    calls.length = 0;

    await stats.syncShotLedger();
    expect(calls).toHaveLength(3);
  });

  it('rows that keep failing do not starve the ones behind them', async () => {
    // Three old rows have already failed once; a newer row has never been tried.
    serve({ [SHOTS]: Array<Answer>(10).fill('network') });
    const stats = make(kioskOf('INSADONG', 1));
    for (const id of ['old1', 'old2', 'old3']) {
      await stats.recordShot({ eventId: id, isSuccess: true, outfitCode: '1.1' });
    }
    await stats.recordShot({ eventId: 'fresh', isSuccess: true, outfitCode: '1.1' });
    await stats.syncShotLedger(); // everything fails again; the olds are now 2 attempts ahead

    const { calls } = serve({ [SHOTS]: [200, 'network', 'network', 'network'] });
    await stats.syncShotLedger();
    expect((calls[0]?.body as { eventId: string }).eventId).toBe('fresh');
    expect(ledger.get('fresh')?.state).toBe('sent');
  });

  it('a slower send of the same shot cannot turn a sent row back into an unsent one', async () => {
    const stats = make(kioskOf('INSADONG', 1));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        // The hourly cycle delivered this row while our own request was in flight.
        const row = ledger.get('e1');
        if (row) ledger.save({ ...row, state: 'sent', sentAt: now });
        return new Response('{}', { status: 500 });
      }),
    );

    await stats.recordShot({ eventId: 'e1', isSuccess: true, outfitCode: '1.1' });
    expect(ledger.get('e1')?.state).toBe('sent');
  });

  it('with no ledger on disk an unsent shot also goes to the old queue, so a restart keeps it', async () => {
    serve({ [SHOTS]: ['network'] });
    const record = vi.fn();
    const queue = { listByType: () => [], record } as unknown as FailedRequestService;
    const stats = new StatsService(kioskOf('INSADONG', 1), queue, { now: () => now });

    await stats.recordShot({ eventId: 'e1', isSuccess: true, outfitCode: '1.1' });
    expect(record).toHaveBeenCalledWith(
      'photo_shot',
      expect.objectContaining({ eventId: 'e1' }),
      expect.any(String),
      'e1',
    );
  });

  it('prunes only rows sent more than 30 days ago', async () => {
    serve({ [SHOTS]: [200, 'network'] });
    const stats = make(kioskOf('INSADONG', 1));
    await stats.recordShot({ eventId: 'sent', isSuccess: true, outfitCode: '1.1' });
    await stats.recordShot({ eventId: 'unsent', isSuccess: true, outfitCode: '1.1' });

    now += KEEP_SENT_MS + HOUR_MS;
    serve({ [SHOTS]: ['network'] });
    await stats.syncShotLedger();

    expect(ledger.get('sent')).toBeNull();
    expect(ledger.get('unsent')?.state).toBe('pending');
  });
});

describe('제주 — measurement upload refused by the server', () => {
  const photo = join(mkdtempSync(join(tmpdir(), 'shot-ledger-')), 'Captured_20261111_1.jpg');
  writeFileSync(photo, 'jpg');

  it('the shot record goes out on its own so it is counted; the upload is retried daily', async () => {
    const { calls } = serve({ [MEASUREMENT]: [401] });
    const stats = make(kioskOf('JEJU_AIRPORT', 9));

    await stats.recordShot({
      eventId: 'e1',
      isSuccess: true,
      outfitCode: '15.1',
      photoPath: photo,
    });

    expect(calls.map((c) => c.url)).toEqual([MEASUREMENT, SHOTS]);
    expect(ledger.get('e1')).toMatchObject({ state: 'rejected', v1Sent: true });

    now += REJECTED_RETRY_MS;
    calls.length = 0;
    await stats.syncShotLedger();
    expect(calls.map((c) => c.url)).toEqual([MEASUREMENT]);
    expect(ledger.get('e1')?.state).toBe('sent');
  });

  it('an original that is gone from disk still gets its shot record sent', async () => {
    const { calls } = serve({});
    const stats = make(kioskOf('JEJU_AIRPORT', 9));

    await stats.recordShot({
      eventId: 'e1',
      isSuccess: false,
      outfitCode: '15.1',
      photoPath: join(tmpdir(), 'no-such-capture.jpg'),
    });

    expect(calls.map((c) => c.url)).toEqual([SHOTS]);
    expect(ledger.get('e1')?.state).toBe('sent');
  });
});

describe('AR 합성 실패 알림 — the failed shot says why and which 배경', () => {
  const failure = {
    kind: 'HTTP' as const,
    status: 400,
    message: 'Background change not available for outfit: 15.1',
  };

  it('a failed shot carries the 배경 and the AR failure', async () => {
    const { calls } = serve({});
    const stats = make(kioskOf('INSADONG', 1));

    await stats.recordShot({
      eventId: 'e1',
      isSuccess: false,
      outfitCode: '15.1',
      shotType: 'TOGETHER',
      backgroundId: 1,
      arFailure: failure,
    });

    expect(calls[0]?.body).toMatchObject({
      eventId: 'e1',
      isSuccess: false,
      backgroundId: 1,
      arErrorKind: 'HTTP',
      arErrorStatus: 400,
      arErrorMessage: 'Background change not available for outfit: 15.1',
    });
  });

  it('a plain shot sends exactly the body it always did', async () => {
    const { calls } = serve({});
    const stats = make(kioskOf('INSADONG', 1));

    await stats.recordShot({
      eventId: 'e1',
      isSuccess: true,
      outfitCode: '1.1',
      arFailure: failure,
    });

    expect(Object.keys(calls[0]?.body as object).sort()).toEqual(
      ['eventId', 'isSuccess', 'kioskId', 'language', 'outfitCode', 'shotAt', 'shotType'].sort(),
    );
  });

  it('a network failure without a status leaves the status out', async () => {
    const { calls } = serve({});
    const stats = make(kioskOf('INSADONG', 1));

    await stats.recordShot({
      eventId: 'e1',
      isSuccess: false,
      outfitCode: '1.1',
      arFailure: { kind: 'NETWORK', status: null, message: 'fetch failed (ENOTFOUND)' },
    });

    expect(calls[0]?.body).toMatchObject({
      arErrorKind: 'NETWORK',
      arErrorMessage: 'fetch failed (ENOTFOUND)',
    });
    expect(calls[0]?.body).not.toHaveProperty('arErrorStatus');
  });

  it('the 배경 picked at capture is kept when the composite fails later, and the re-send carries it all', async () => {
    const { calls } = serve({ [SHOTS]: ['network'] });
    const stats = make(kioskOf('INSADONG', 1));

    stats.openShot({ eventId: 'e1', outfitCode: '15.1', shotType: 'SOLO', backgroundId: 3 });
    await stats.recordShot({
      eventId: 'e1',
      isSuccess: false,
      outfitCode: '15.1',
      arFailure: failure,
    });
    expect(ledger.get('e1')).toMatchObject({
      state: 'pending',
      backgroundId: 3,
      arFailure: failure,
    });

    now += HOUR_MS;
    await stats.syncShotLedger();
    expect(calls[1]?.body).toMatchObject({ eventId: 'e1', backgroundId: 3, arErrorStatus: 400 });
    expect(
      ledger.notes.some((line) => line.includes('배경 3') && line.includes('AR HTTP 400')),
    ).toBe(true);
  });

  it('제주: the measurement upload data part carries them too', async () => {
    const photo = join(mkdtempSync(join(tmpdir(), 'shot-')), 'capture.jpg');
    writeFileSync(photo, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const parts: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        if (init.body instanceof FormData) {
          parts.push(JSON.parse(await (init.body.get('data') as Blob).text()) as unknown);
        }
        return new Response('{}', { status: 200 });
      }),
    );
    const stats = make(kioskOf('JEJU_AIRPORT', 9));

    await stats.recordShot({
      eventId: 'e1',
      isSuccess: false,
      outfitCode: '15.1',
      photoPath: photo,
      backgroundId: 2,
      arFailure: failure,
    });

    expect(parts[0]).toMatchObject({
      eventId: 'e1',
      backgroundId: 2,
      arErrorKind: 'HTTP',
      arErrorStatus: 400,
    });
  });
});

describe('자동 촬영 — the record says it was the kiosk’s own', () => {
  it('sends autoShot: true, keeps it for a re-send, and counts it in the day', async () => {
    const { calls } = serve({ [SHOTS]: ['network'] });
    const stats = make(kioskOf('JEJU_AIRPORT', 8));

    stats.openShot({ eventId: 'e1', outfitCode: '15.1', shotType: 'SOLO', autoShot: true });
    await stats.recordShot({ eventId: 'e1', isSuccess: true, outfitCode: '15.1', autoShot: true });
    expect(ledger.get('e1')).toMatchObject({ autoShot: true, state: 'pending' });
    expect(calls[0]?.body).toMatchObject({ eventId: 'e1', autoShot: true });

    now += HOUR_MS;
    await stats.syncShotLedger();
    expect(calls[1]?.body).toMatchObject({ eventId: 'e1', autoShot: true });
    expect(ledger.notes.some((line) => line.includes('자동 촬영'))).toBe(true);
    expect(stats.shotsSince(now - 2 * HOUR_MS)).toBe(1);
  });
});
