import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/core/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));
vi.mock('@main/core/apiBase', () => ({ witteriaApiBase: () => 'https://api.example.test' }));

import {
  PhotoArchiveService,
  cadenceFor,
  type PhotoArchiveStore,
} from '@main/services/photoArchive/PhotoArchiveService';
import type { ArchiveRecord, IdentitySpan } from '@main/services/photoArchive/plan';

const MIN = 60_000;
const NOW = Date.UTC(2026, 10, 3, 6, 0, 0);

/** Same transitions as PhotoArchiveRepository, in memory. */
class MemoryStore implements PhotoArchiveStore {
  rows = new Map<string, ArchiveRecord>();
  since: number | null = null;
  identities: IdentitySpan[] = [];
  identityHistory(): IdentitySpan[] {
    return [...this.identities];
  }
  saveIdentityHistory(history: IdentitySpan[]): void {
    this.identities = [...history];
  }
  enabledSince(): number | null {
    return this.since;
  }
  markEnabledSince(now: number): number {
    this.since ??= now;
    return this.since;
  }
  records(): Map<string, ArchiveRecord> {
    return new Map(this.rows);
  }
  markSent(fileName: string, withResult: boolean): void {
    const prev = this.rows.get(fileName);
    this.rows.set(fileName, {
      fileName,
      state: 'sent',
      withResult: withResult || (prev?.withResult ?? false),
      attempts: (prev?.attempts ?? 0) + 1,
    });
  }
  markGivenUp(fileName: string): void {
    const prev = this.rows.get(fileName);
    this.rows.set(fileName, {
      fileName,
      state: 'given_up',
      withResult: prev?.withResult ?? false,
      attempts: (prev?.attempts ?? 0) + 1,
    });
  }
  markFailed(fileName: string): void {
    const prev = this.rows.get(fileName);
    this.rows.set(fileName, {
      fileName,
      state: prev?.state === 'sent' ? 'sent' : 'pending',
      withResult: prev?.withResult ?? false,
      attempts: (prev?.attempts ?? 0) + 1,
    });
  }
}

/** A store whose kiosk was enabled two hours before NOW. */
function enabledStore(): MemoryStore {
  const store = new MemoryStore();
  store.since = NOW - 120 * MIN;
  return store;
}

interface Sent {
  data: { kioskId: number; fileName: string; capturedAt: string; source: string };
  original: string | null;
  result: string | null;
}

type Reply = { status: number; body?: unknown } | Error;

function fakeServer(opts: { enabled?: boolean; replies?: Reply[] } = {}) {
  const sent: Sent[] = [];
  const statusCalls: string[] = [];
  const replies = [...(opts.replies ?? [])];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    if (href.includes('/status')) {
      statusCalls.push(href);
      return Response.json({ success: true, data: { enabled: opts.enabled ?? true } });
    }
    const form = init!.body as FormData;
    const original = form.get('original') as File | null;
    const result = form.get('result') as File | null;
    sent.push({
      data: JSON.parse(await (form.get('data') as Blob).text()),
      original: original ? `${original.name}:${await original.text()}` : null,
      result: result ? `${result.name}:${await result.text()}` : null,
    });
    const reply = replies.shift() ?? {
      status: 200,
      body: { success: true, data: { stored: true } },
    };
    if (reply instanceof Error) throw reply;
    return Response.json(reply.body ?? {}, { status: reply.status });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, sent, statusCalls };
}

let dir: string;
let clock: number;

function photo(name: string, ageMin: number): void {
  const path = join(dir, name);
  writeFileSync(path, `bytes-of-${name}`);
  const t = (clock - ageMin * MIN) / 1000;
  utimesSync(path, t, t);
}

function service(store: MemoryStore, fetchImpl: typeof fetch): PhotoArchiveService {
  return new PhotoArchiveService({
    store,
    kioskNum: () => 3,
    photoDir: () => dir,
    fetch: fetchImpl,
    now: () => clock,
  });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'photo-archive-'));
  clock = NOW;
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env['PHOTO_ARCHIVE_URL'];
  delete process.env['PHOTO_ARCHIVE_STATUS_URL'];
});

describe('PhotoArchiveService.runCycle', () => {
  it('sends nothing when the server says disabled, and caches that for 30 minutes', async () => {
    photo('Captured_20261103_1.jpg', 60);
    const server = fakeServer({ enabled: false });
    const svc = service(new MemoryStore(), server.fetchImpl);

    expect((await svc.runCycle()).stoppedBy).toBe('disabled');
    clock += 10 * MIN;
    await svc.runCycle();
    expect(server.statusCalls).toHaveLength(1);
    expect(server.statusCalls[0]).toBe(
      'https://api.example.test/api/kiosk/photos/upload/status?kioskId=3',
    );
    clock += 25 * MIN;
    await svc.runCycle();
    expect(server.statusCalls).toHaveLength(2);
    expect(server.sent).toHaveLength(0);
  });

  it('stays silent until the first enabled=true, then sends only photos taken after it', async () => {
    photo('Captured_20261103_1.jpg', 60); // before the kiosk was enabled
    photo('Captured_20250101_9.jpg', 500_000); // long before — never even stat'ed
    const store = new MemoryStore();
    const disabled = service(store, fakeServer({ enabled: false }).fetchImpl);
    await disabled.runCycle();
    expect(store.since).toBeNull();
    expect(store.rows.size).toBe(0);

    const server = fakeServer({ enabled: true });
    const svc = service(store, server.fetchImpl);
    await svc.runCycle();
    expect(store.since).toBe(NOW); // stamped at the first enabled answer
    expect(server.sent).toHaveLength(0);
    expect(store.rows.size).toBe(0); // old photos are neither sent nor recorded

    clock += 15 * MIN;
    photo('Captured_20261103_2.jpg', 11); // shot 4 minutes after enabling
    clock += 30 * MIN; // past the status cache
    await svc.runCycle();
    expect(server.sent.map((s) => s.data.fileName)).toEqual(['Captured_20261103_2.jpg']);
    expect(store.since).toBe(NOW); // not moved by later enabled answers
    expect([...store.rows.keys()]).toEqual(['Captured_20261103_2.jpg']);
  });

  it('sends the original with its composite and the contract data part', async () => {
    photo('Captured_20261103_7.jpg', 30);
    photo('Captured_20261103_7_Ai.jpg', 29);
    photo('Captured_20261103_8.jpg', 5); // too young
    const store = enabledStore();
    const server = fakeServer();

    const summary = await service(store, server.fetchImpl).runCycle();

    expect(summary).toMatchObject({ enabled: true, stored: 1, stoppedBy: 'done' });
    expect(server.sent).toHaveLength(1);
    expect(server.sent[0]).toEqual({
      data: {
        kioskId: 3,
        fileName: 'Captured_20261103_7.jpg',
        capturedAt: '2026-11-03T14:30:00',
        source: 'LIVE',
      },
      original: 'Captured_20261103_7.jpg:bytes-of-Captured_20261103_7.jpg',
      result: 'Captured_20261103_7_Ai.jpg:bytes-of-Captured_20261103_7_Ai.jpg',
    });
    expect(store.rows.get('Captured_20261103_7.jpg')).toMatchObject({
      state: 'sent',
      withResult: true,
    });
    expect(store.rows.has('Captured_20261103_8.jpg')).toBe(false);
  });

  it('re-sends an original sent alone once its composite appears, then stops', async () => {
    photo('Captured_20261103_9.jpg', 30);
    const store = enabledStore();
    const server = fakeServer();
    const svc = service(store, server.fetchImpl);

    await svc.runCycle();
    expect(server.sent[0]!.result).toBeNull();
    expect(store.rows.get('Captured_20261103_9.jpg')).toMatchObject({
      state: 'sent',
      withResult: false,
    });

    await svc.runCycle();
    expect(server.sent).toHaveLength(1); // nothing new

    photo('Captured_20261103_9_Ai.jpg', 2);
    await svc.runCycle();
    expect(server.sent).toHaveLength(2);
    expect(server.sent[1]!.result).toBe(
      'Captured_20261103_9_Ai.jpg:bytes-of-Captured_20261103_9_Ai.jpg',
    );
    expect(store.rows.get('Captured_20261103_9.jpg')).toMatchObject({
      state: 'sent',
      withResult: true,
    });

    await svc.runCycle();
    expect(server.sent).toHaveLength(2);
  });

  it('gives up on a 400 and carries on with the next file', async () => {
    photo('Captured_20261103_1.jpg', 20);
    photo('Captured_20261103_2.jpg', 30);
    const store = enabledStore();
    const server = fakeServer({ replies: [{ status: 400, body: { success: false } }] });
    const svc = service(store, server.fetchImpl);

    const summary = await svc.runCycle();
    expect(summary).toMatchObject({ stored: 1, givenUp: 1 });
    expect(store.rows.get('Captured_20261103_1.jpg')!.state).toBe('given_up');
    expect(store.rows.get('Captured_20261103_2.jpg')!.state).toBe('sent');

    await svc.runCycle();
    expect(server.sent).toHaveLength(2); // the given-up file is never retried
  });

  it('stops the cycle on 5xx or a network error and retries next cycle', async () => {
    photo('Captured_20261103_1.jpg', 20);
    photo('Captured_20261103_2.jpg', 30);
    const store = enabledStore();
    const server = fakeServer({ replies: [{ status: 503 }, new TypeError('fetch failed')] });
    const svc = service(store, server.fetchImpl);

    expect((await svc.runCycle()).stoppedBy).toBe('retry');
    expect(server.sent).toHaveLength(1);
    expect(store.rows.get('Captured_20261103_1.jpg')).toMatchObject({
      state: 'pending',
      attempts: 1,
    });

    expect((await svc.runCycle()).stoppedBy).toBe('retry');
    expect(store.rows.get('Captured_20261103_1.jpg')).toMatchObject({
      state: 'pending',
      attempts: 2,
    });

    expect(await svc.runCycle()).toMatchObject({ stored: 2, stoppedBy: 'done' });
  });

  it('leaves the file unmarked on stored:false and re-checks status next cycle', async () => {
    photo('Captured_20261103_1.jpg', 20);
    photo('Captured_20261103_2.jpg', 30);
    const store = enabledStore();
    const server = fakeServer({ replies: [{ status: 200, body: { data: { stored: false } } }] });
    const svc = service(store, server.fetchImpl);

    expect((await svc.runCycle()).stoppedBy).toBe('discarded');
    expect(server.sent).toHaveLength(1);
    expect(store.rows.size).toBe(0);

    await svc.runCycle();
    expect(server.statusCalls).toHaveLength(2);
    expect(store.rows.size).toBe(2);
  });

  it('sends at most 120 pairs per cycle, newest first, to catch up after an outage', async () => {
    const store = enabledStore();
    for (let i = 1; i <= 125; i++) photo(`Captured_20261103_${i}.jpg`, 110 - i * 0.75);
    const server = fakeServer();
    const svc = service(store, server.fetchImpl);

    await svc.runCycle();
    expect(server.sent).toHaveLength(120);
    expect(server.sent[0]!.data.fileName).toBe('Captured_20261103_125.jpg');
    expect(server.sent.every((s) => s.data.source === 'LIVE')).toBe(true);

    await svc.runCycle();
    expect(server.sent).toHaveLength(125);
  });

  it('pauses while a customer is mid-capture', async () => {
    photo('Captured_20261103_1.jpg', 20);
    const server = fakeServer();
    const svc = service(enabledStore(), server.fetchImpl);
    svc.setBusyCheck(() => true);
    expect((await svc.runCycle()).stoppedBy).toBe('busy');
    expect(server.sent).toHaveLength(0);
  });

  it('honours the PHOTO_ARCHIVE_URL / PHOTO_ARCHIVE_STATUS_URL overrides', async () => {
    process.env['PHOTO_ARCHIVE_URL'] = 'https://override.example.test/upload';
    process.env['PHOTO_ARCHIVE_STATUS_URL'] = 'https://override.example.test/status';
    photo('Captured_20261103_1.jpg', 20);
    const server = fakeServer();
    await service(enabledStore(), server.fetchImpl).runCycle();
    const urls = vi.mocked(server.fetchImpl).mock.calls.map(([url]) => String(url));
    expect(urls).toEqual([
      'https://override.example.test/status?kioskId=3',
      'https://override.example.test/upload',
    ]);
  });
});

describe('which kiosk a photo is filed under', () => {
  it('uses the id the PC had when the photo was taken, not the id it has now', async () => {
    // Set to kiosk 5, then to kiosk 3 ten minutes before NOW, with photos waiting.
    photo('Captured_20261103_1.jpg', 30);
    photo('Captured_20261103_2.jpg', 15);
    photo('Captured_20261103_3.jpg', 9);
    const store = enabledStore();
    store.identities = [
      { kioskId: 5, since: NOW - 60 * MIN },
      { kioskId: 3, since: NOW - 10 * MIN },
    ];
    clock = NOW + 2 * MIN;
    const server = fakeServer();
    await service(store, server.fetchImpl).runCycle();

    const idOf = (name: string): number | undefined =>
      server.sent.find((s) => s.data.fileName === name)?.data.kioskId;
    expect(idOf('Captured_20261103_1.jpg')).toBe(5);
    expect(idOf('Captured_20261103_2.jpg')).toBe(5);
    expect(idOf('Captured_20261103_3.jpg')).toBe(3);
    expect(server.statusCalls[0]).toContain('kioskId=3');
  });

  it('records a new id once, with the moment it was first seen', async () => {
    const store = enabledStore();
    store.identities = [{ kioskId: 5, since: NOW - 60 * MIN }];
    const svc = service(store, fakeServer().fetchImpl);
    await svc.runCycle();
    clock += MIN;
    await svc.runCycle();
    expect(store.identities).toEqual([
      { kioskId: 5, since: NOW - 60 * MIN },
      { kioskId: 3, since: NOW },
    ]);
  });

  it('gives up on a photo whose earlier id the server does not archive, and carries on', async () => {
    photo('Captured_20261103_1.jpg', 90); // taken as kiosk 200 (not archived)
    photo('Captured_20261103_2.jpg', 30); // taken as kiosk 3
    const store = enabledStore();
    store.identities = [
      { kioskId: 200, since: NOW - 120 * MIN },
      { kioskId: 3, since: NOW - 60 * MIN },
    ];
    const server = fakeServer({
      replies: [
        { status: 200, body: { success: true, data: { stored: true } } },
        { status: 200, body: { success: true, data: { stored: false } } },
      ],
    });
    const summary = await service(store, server.fetchImpl).runCycle();

    expect(summary).toMatchObject({ stored: 1, givenUp: 1, stoppedBy: 'done' });
    expect(store.rows.get('Captured_20261103_1.jpg')?.state).toBe('given_up');
  });
});

describe('scan cadence', () => {
  it('moves photos within minutes against a stage server, hourly otherwise', () => {
    const stage = cadenceFor('https://api-stage-v3.witteria.com');
    expect(stage.cycleIntervalMs).toBe(MIN);
    expect(stage.minAgeMs).toBe(MIN);
    for (const base of ['https://api-v3.witteria.com', '']) {
      expect(cadenceFor(base)).toMatchObject({ cycleIntervalMs: 60 * MIN, minAgeMs: 10 * MIN });
    }
  });
});
