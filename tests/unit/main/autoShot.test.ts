import { describe, expect, it, vi } from 'vitest';

vi.mock('@main/core/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

import { AutoShotService, autoShotTarget } from '@main/services/photo/AutoShotService';
import type { KioskService } from '@main/services/KioskService';
import type { StatsService } from '@main/services/StatsService';
import type { PhotoGenerationService } from '@main/services/photo/PhotoGenerationService';
import type { PhotoWorkflowService } from '@main/services/photo/PhotoWorkflowService';

/** Local time on 2026-11-13. */
const at = (hour: number, minute = 0): number => new Date(2026, 10, 13, hour, minute).getTime();

function make(opts: { site: string; today: number; phase?: string; now: number }) {
  const generate = vi.fn(async () => ({}));
  const service = new AutoShotService(
    { getConfig: () => ({ kioskId: opts.site }) } as unknown as KioskService,
    { shotsSince: () => opts.today } as unknown as StatsService,
    { generate } as unknown as PhotoGenerationService,
    { getState: () => ({ phase: opts.phase ?? 'idle' }) } as unknown as PhotoWorkflowService,
    () => opts.now,
  );
  return { service, generate };
}

describe('자동 촬영 — how many by when', () => {
  it('one more each hour from 10:00, the minimum by 19:00, none outside 10:00–19:59', () => {
    expect(autoShotTarget(10, 9)).toBe(0);
    expect(autoShotTarget(10, 10)).toBe(1);
    expect(autoShotTarget(10, 14)).toBe(5);
    expect(autoShotTarget(10, 19)).toBe(10);
    expect(autoShotTarget(10, 20)).toBe(0);
    expect(autoShotTarget(3, 19)).toBe(3);
  });
});

describe('자동 촬영 — whether to take one now', () => {
  it('only the venues with a daily minimum (제주국제공항·제주국제여객터미널)', () => {
    expect(make({ site: 'W008', today: 0, now: at(12) }).service.plan()).toMatchObject({
      enabled: true,
      due: true,
    });
    expect(make({ site: 'W009', today: 0, now: at(12) }).service.plan()).toMatchObject({
      enabled: true,
      due: true,
    });
    expect(make({ site: 'W001', today: 0, now: at(12) }).service.plan()).toMatchObject({
      enabled: false,
      due: false,
    });
    expect(make({ site: 'W010', today: 0, now: at(12) }).service.plan()).toMatchObject({
      enabled: false,
    });
  });

  it('not when the day already has enough shots — visitors count first', () => {
    expect(make({ site: 'W008', today: 3, now: at(12, 30) }).service.plan()).toMatchObject({
      due: false,
      reason: 'met',
      target: 3,
    });
    expect(make({ site: 'W008', today: 12, now: at(19, 30) }).service.plan()).toMatchObject({
      due: false,
      reason: 'met',
    });
    expect(make({ site: 'W008', today: 2, now: at(12, 30) }).service.plan()).toMatchObject({
      due: true,
      target: 3,
    });
  });

  it('not outside 10:00–19:59, and not while a visitor is in the photo flow', () => {
    expect(make({ site: 'W008', today: 0, now: at(9, 59) }).service.plan().reason).toBe(
      'outside-hours',
    );
    expect(make({ site: 'W008', today: 0, now: at(20, 0) }).service.plan().reason).toBe(
      'outside-hours',
    );
    expect(
      make({ site: 'W008', today: 0, now: at(12), phase: 'countdown' }).service.plan().reason,
    ).toBe('session');
  });

  it('a run is a 혼자찍기 marked as the kiosk’s own, with the picked outfit and 배경', async () => {
    const { service, generate } = make({ site: 'W008', today: 0, now: at(12) });
    await expect(
      service.run({
        dataUrl: 'data:image/jpeg;base64,AA==',
        clothingKey: 'female|15.1',
        backgroundId: 2,
      }),
    ).resolves.toEqual({ taken: true, reason: 'due' });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        styleKey: 'solo',
        clothingKey: 'female|15.1',
        backgroundId: 2,
        auto: true,
      }),
    );
  });

  it('a run that is no longer due (a visitor shot meanwhile) takes nothing', async () => {
    const { service, generate } = make({ site: 'W008', today: 5, now: at(12) });
    await expect(
      service.run({ dataUrl: 'x', clothingKey: '|1.1', backgroundId: null }),
    ).resolves.toEqual({
      taken: false,
      reason: 'met',
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it('a failed composite is still a shot taken (the original is recorded as failed)', async () => {
    const { service, generate } = make({ site: 'W008', today: 0, now: at(12) });
    generate.mockRejectedValueOnce(new Error('AR generation failed (500)'));
    await expect(
      service.run({ dataUrl: 'x', clothingKey: '|1.1', backgroundId: null }),
    ).resolves.toMatchObject({ taken: true });
  });
});
