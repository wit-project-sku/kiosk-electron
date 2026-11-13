import { describe, expect, it } from 'vitest';
import {
  afterAttempt,
  classifyStatus,
  HOUR_MS,
  isDue,
  keepRecentLines,
  KEEP_SENT_MS,
  localStamp,
  REJECTED_RETRY_MS,
  STALE_OPEN_MS,
  type ShotRow,
} from '@main/services/shotLedger/plan';

const NOW = Date.UTC(2026, 10, 11, 3, 0, 0);

const row = (over: Partial<ShotRow> = {}): ShotRow => ({
  eventId: 'e1',
  kioskId: 9,
  shotAt: '2026-11-11T12:00:00+09:00',
  isSuccess: true,
  shotType: 'SOLO',
  outfitCode: '15.1',
  language: 'ko',
  backgroundId: null,
  arFailure: null,
  autoShot: false,
  photoPath: null,
  v2Data: null,
  state: 'pending',
  v1Sent: false,
  attempts: 0,
  lastError: null,
  nextAttemptAt: NOW,
  createdAt: NOW,
  sentAt: null,
  ...over,
});

describe('what a status means for a shot report', () => {
  it.each([200, 201, 409])('%i is sent', (status) => {
    expect(classifyStatus(status).kind).toBe('sent');
  });

  it.each([408, 429, 502, 503, 504])('%i is transient — retried hourly', (status) => {
    expect(classifyStatus(status).kind).toBe('retry');
  });

  it.each([400, 401, 403, 404, 415, 422, 500])('%i is rejected — kept, retried daily', (status) => {
    expect(classifyStatus(status).kind).toBe('rejected');
  });
});

describe('a ledger row after a delivery attempt', () => {
  it('sent: keeps the row, stamps the time', () => {
    const next = afterAttempt(row(), { kind: 'sent' }, NOW);
    expect(next).toMatchObject({ state: 'sent', sentAt: NOW, v1Sent: true, attempts: 1 });
    expect(isDue(next, NOW + 365 * 24 * HOUR_MS)).toBe(false);
  });

  it('transient failure: due again on the next cycle', () => {
    const next = afterAttempt(row(), { kind: 'retry', message: 'timeout' }, NOW);
    expect(next).toMatchObject({ state: 'pending', lastError: 'timeout' });
    expect(isDue(next, NOW)).toBe(true);
  });

  it('rejected: not due for a day, then due — never dropped', () => {
    const next = afterAttempt(row(), { kind: 'rejected', message: 'HTTP 401' }, NOW);
    expect(next.state).toBe('rejected');
    expect(isDue(next, NOW + REJECTED_RETRY_MS - 1)).toBe(false);
    expect(isDue(next, NOW + REJECTED_RETRY_MS)).toBe(true);
  });

  it('an open row is due only once its composite is clearly lost', () => {
    const open = row({ state: 'open', isSuccess: null });
    expect(isDue(open, NOW + STALE_OPEN_MS - 1)).toBe(false);
    expect(isDue(open, NOW + STALE_OPEN_MS)).toBe(true);
  });
});

describe('the text ledger', () => {
  it('keeps only lines inside the 30-day window', () => {
    const old = `${localStamp(NOW - KEEP_SENT_MS - HOUR_MS)} | 촬영 | old`;
    const fresh = `${localStamp(NOW - HOUR_MS)} | 촬영 | fresh`;
    expect(keepRecentLines([old, fresh, 'garbage'], NOW, KEEP_SENT_MS)).toEqual([fresh]);
  });
});
