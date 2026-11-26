import { describe, expect, it } from 'vitest';
import {
  MAX_PENDING,
  MAX_STACK,
  classifyPreviousRun,
  clip,
  enqueue,
  asciiHeader,
  isRunState,
  isoLocal,
  signalHeaders,
  type CrashReport,
  type RunState,
} from '@main/core/healthReport';

const H = 3_600_000;
const run = (over: Partial<RunState> = {}): RunState => ({
  pid: 1,
  appVersion: '5.0.28',
  channel: 'latest',
  kioskCode: 'W004',
  startedAt: 10 * H,
  lastBeatAt: 30 * H,
  lastRssMb: 612,
  cleanExit: false,
  pending: [],
  ...over,
});

describe('classifyPreviousRun', () => {
  it('reports nothing for a clean quit or a first launch', () => {
    expect(classifyPreviousRun(run({ cleanExit: true }), 40 * H)).toBeNull();
    expect(classifyPreviousRun(null, 40 * H)).toBeNull();
  });

  it('calls it an app crash when the OS stayed up after the last heartbeat', () => {
    const r = classifyPreviousRun(run(), 5 * H); // booted long before the last beat
    expect(r).toMatchObject({
      kind: 'ABNORMAL_EXIT',
      suspectedCause: 'APP_CRASH',
      uptimeSec: 20 * 3600,
      mainRssMb: 612,
      appVersion: '5.0.28',
      kioskCode: 'W004',
    });
  });

  it('calls it a system restart when the machine booted within minutes of the last heartbeat', () => {
    const r = classifyPreviousRun(run(), 30 * H + 5 * 60_000);
    expect(r?.suspectedCause).toBe('SYSTEM_RESTART');
    expect(r?.reason).toBe('boot 5 min after last heartbeat');
  });

  it('leaves it UNKNOWN when the app went silent long before the boot (crash, then nightly reboot — or power off)', () => {
    const r = classifyPreviousRun(run(), 40 * H);
    expect(r?.suspectedCause).toBe('UNKNOWN');
    expect(r?.reason).toBe('boot 600 min after last heartbeat');
  });

  it('carries the last uncaught error, clipped', () => {
    const r = classifyPreviousRun(
      run({
        lastError: {
          message: 'Array buffer allocation failed',
          stack: 'x'.repeat(9000),
          at: 29 * H,
        },
      }),
      5 * H,
    );
    expect(r?.message).toBe('Array buffer allocation failed');
    expect(r?.stack).toHaveLength(MAX_STACK);
  });
});

describe('helpers', () => {
  it('clip leaves short text alone and marks cut text', () => {
    expect(clip('abc', 5)).toBe('abc');
    expect(clip('abcdef', 5)).toBe('abcd…');
    expect(clip(undefined, 5)).toBeUndefined();
  });

  it('isoLocal writes the given offset', () => {
    expect(isoLocal(Date.UTC(2026, 9, 13, 18, 12, 45), 540)).toBe('2026-10-14T03:12:45+09:00');
    expect(isoLocal(Date.UTC(2026, 9, 13, 18, 12, 45), 0)).toBe('2026-10-13T18:12:45+00:00');
  });

  it('enqueue keeps only the newest MAX_PENDING', () => {
    let q: CrashReport[] = [];
    for (let i = 0; i < MAX_PENDING + 5; i++)
      q = enqueue(q, {
        kind: 'UNCAUGHT_EXCEPTION',
        occurredAt: String(i),
        appVersion: '',
        channel: '',
        kioskCode: '',
      });
    expect(q).toHaveLength(MAX_PENDING);
    expect(q[0]?.occurredAt).toBe('5');
  });

  it('signalHeaders carries version, channel, site, uptime and memory', () => {
    expect(
      signalHeaders({
        appVersion: '5.1.0-beta.12',
        channel: 'beta',
        kioskCode: 'W004',
        uptimeSec: 61.6,
        mainRssMb: 511.7,
      }),
    ).toEqual({
      'user-agent': 'kiosk-app/5.1.0-beta.12 (W004; beta)',
      'x-kiosk-app-version': '5.1.0-beta.12',
      'x-kiosk-channel': 'beta',
      'x-kiosk-code': 'W004',
      'x-kiosk-uptime-sec': '62',
      'x-kiosk-main-rss-mb': '512',
    });
  });
});

describe('defensive input', () => {
  it('isRunState rejects damaged files instead of letting startup throw', () => {
    expect(isRunState(run())).toBe(true);
    expect(isRunState(null)).toBe(false);
    expect(isRunState({ ...run(), pending: {} })).toBe(false);
    expect(isRunState({ ...run(), lastBeatAt: 'x' })).toBe(false);
    expect(isRunState([])).toBe(false);
  });

  it('asciiHeader replaces characters fetch would refuse in a header', () => {
    expect(asciiHeader('W004', 8)).toBe('W004');
    expect(asciiHeader('오색W4', 8)).toBe('??W4');
    expect(asciiHeader('5.0.28\n', 40)).toBe('5.0.28?');
  });
});
