import { randomUUID } from 'node:crypto';
import { createLogger } from '@main/core/logger';
import { getKioskLocation } from '@shared/config/kioskLocations';
import type { KioskId } from '@shared/types/kiosk';
import type {
  AutoShotPlan,
  AutoShotRunRequest,
  AutoShotRunResult,
  AutoShotTiming,
} from '@shared/types/autoShot';
import type { KioskService } from '@main/services/KioskService';
import type { StatsService } from '@main/services/StatsService';
import type { PhotoGenerationService } from './PhotoGenerationService';
import type { PhotoWorkflowService } from './PhotoWorkflowService';

const log = createLogger('auto-shot');

/** First hour a 자동 촬영 may be taken (local time). */
export const AUTO_SHOT_FIRST_HOUR = 10;
/** Last hour (inclusive) — the minimum is reached by the start of it. */
export const AUTO_SHOT_LAST_HOUR = 19;

/**
 * How many shots there should be by `hour`: one more each hour from 10:00, so
 * the day's minimum is reached at 19:00 — spread out rather than in a burst, and
 * every visitor photo earlier in the day means one fewer of the kiosk's own.
 * 0 outside the window.
 */
export function autoShotTarget(dailyMin: number, hour: number): number {
  if (hour < AUTO_SHOT_FIRST_HOUR || hour > AUTO_SHOT_LAST_HOUR) return 0;
  return Math.min(dailyMin, hour - AUTO_SHOT_FIRST_HOUR + 1);
}

/** Every two minutes after launch, then every five; five minutes untouched. */
const PRODUCTION_TIMING: AutoShotTiming = {
  firstCheckMs: 2 * 60_000,
  checkEveryMs: 5 * 60_000,
  idleMs: 5 * 60_000,
};

/**
 * `AUTO_SHOT_TIMING=fast` — seconds instead of minutes, so a test can watch a
 * 자동 촬영 happen. Never set on a kiosk.
 */
const FAST_TIMING: AutoShotTiming = { firstCheckMs: 3_000, checkEveryMs: 5_000, idleMs: 2_000 };

export function autoShotTiming(env: NodeJS.ProcessEnv = process.env): AutoShotTiming {
  return env['AUTO_SHOT_TIMING']?.trim() === 'fast' ? FAST_TIMING : PRODUCTION_TIMING;
}

/** Local midnight of `now`, epoch ms. */
function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * 자동 촬영 (2026-11-13): a venue with a daily photo minimum
 * (kioskLocations.autoShotDailyMin — 제주국제공항, 제주국제여객터미널) takes a
 * photo itself while the day's count is short of the hourly target.
 *
 * This service only says WHEN and runs the AR pipeline. Whether the moment is
 * right is the touch-screen window's call (AutoShotCamera): home screen, no touch
 * for five minutes, nobody in front of the camera — it asks `plan()`, captures,
 * and hands the frame to `run()`. The shot is recorded and counted like any
 * other, with `autoShot` set in its record.
 */
export class AutoShotService {
  private running = false;

  constructor(
    private readonly kiosk: KioskService,
    private readonly stats: StatsService,
    private readonly generation: PhotoGenerationService,
    private readonly workflow: PhotoWorkflowService,
    private readonly now: () => number = Date.now,
  ) {}

  plan(): AutoShotPlan {
    const location = getKioskLocation(this.kiosk.getConfig().kioskId as KioskId);
    const rotation = location.cameraRotation;
    const timing = autoShotTiming();
    const dailyMin = location.autoShotDailyMin ?? 0;
    if (dailyMin <= 0)
      return { enabled: false, due: false, reason: 'off', today: 0, target: 0, rotation, timing };

    const now = this.now();
    const target = autoShotTarget(dailyMin, new Date(now).getHours());
    const today = this.stats.shotsSince(startOfDay(now));
    const base = { enabled: true, today, target, rotation, timing };
    if (target === 0) return { ...base, due: false, reason: 'outside-hours' };
    if (today >= target) return { ...base, due: false, reason: 'met' };
    if (this.running) return { ...base, due: false, reason: 'busy' };
    // A visitor is in the photo flow: their shot is on its way, and the camera is theirs.
    if (this.workflow.getState().phase !== 'idle')
      return { ...base, due: false, reason: 'session' };
    return { ...base, due: true, reason: 'due' };
  }

  async run(request: AutoShotRunRequest): Promise<AutoShotRunResult> {
    // Checked again: a visitor may have shot in the seconds the camera took.
    const plan = this.plan();
    if (!plan.due) return { taken: false, reason: plan.reason };

    this.running = true;
    const sessionId = randomUUID();
    log.info('자동 촬영', {
      sessionId,
      today: plan.today,
      target: plan.target,
      clothingKey: request.clothingKey,
      backgroundId: request.backgroundId,
    });
    try {
      await this.generation.generate({
        sessionId,
        dataUrl: request.dataUrl,
        clothingKey: request.clothingKey,
        styleKey: 'solo',
        backgroundId: request.backgroundId,
        auto: true,
      });
    } catch (error) {
      // A failed composite is still a shot — the original is saved and recorded
      // as failed, exactly like a visitor's. Nothing to retry.
      log.warn('자동 촬영 합성 실패', { sessionId, error });
    } finally {
      this.running = false;
    }
    return { taken: true, reason: 'due' };
  }
}
