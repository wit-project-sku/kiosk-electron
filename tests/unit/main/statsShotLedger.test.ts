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
