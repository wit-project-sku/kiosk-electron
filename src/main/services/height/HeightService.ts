import { randomUUID } from 'node:crypto';
import type { PhotoWorkflowState } from '@shared/types/photo';
import type { HeightMeasurement, HeightRuntime } from '@shared/types/height';
import { isJejuLayout } from '@shared/config/kioskLocations';
import { createLogger } from '@main/core/logger';
import type { SidecarEvent, ZedSidecarManager } from '@main/core/ZedSidecarManager';
import type { KioskService } from '@main/services/KioskService';
import type { HeightRepository } from '@main/database/repositories/HeightRepository';
// Local-time helpers, shared with 유동인구. Same reasoning applies here: "which
// hour did this visitor come through" is a question about the wall clock behind
// the kiosk, and bucketing in UTC would split every Korean day across two dates.
import { localDateDaysBefore, localDateOf, localIso } from '@main/services/footfall/time';
import { finiteOrNull, isCameraLive, toMeasurement } from './captureWindow';

const log = createLogger('height');

/**
 * How long a measurement is kept. Matches FOOTFALL_RETENTION_DAYS — the two are
 * the same kind of anonymous venue analytics and there is no reason for a kiosk
 * to hold one longer than the other.
 *
 * This table is one row per capture rather than 유동인구's one row per hour, so
 * it grows with how busy the kiosk is; at a few hundred photos a day that is
 * housekeeping rather than disk pressure, but unbounded is still wrong.
 */
const RETENTION_DAYS = 180;

const cm = (value: number | null): string => (value === null ? '--' : value.toFixed(1));

/** A sidecar result waiting to be attached to the shot it was taken during. */
export interface ShotMeasurement extends HeightMeasurement {
  measuredAt: string;
}

type MeasurementWaiter = (measurement: ShotMeasurement | null) => void;

/**
 * 키 측정 — anonymous visitor-height analytics. 제주 only.
 *
 * Owns the ZED sidecar and decides when it samples. It writes rows and hands
 * each capture's result to `/shots/v2` via `claimShotMeasurement`; no IPC to
 * the renderer, no UI, no live value. See `src/shared/types/height.ts`.
 *
 * ── This must never be in the photo flow's way ─────────────────────────
 * Nothing here is awaited by anything. `onPhotoWorkflowChanged` is a
 * subscription — the same shape FootfallService uses — so the capture pipeline
 * does not know this exists and cannot be delayed, blocked or failed by it. A
 * dead sidecar, a missing SDK or an unplugged ZED produces a null height and no
 * other consequence.
 *
 * ── The measurement window ─────────────────────────────────────────────
 * Sampling runs for as long as the camera is live — phases `preview` AND
 * `countdown` — not just the countdown. 제주 arms the 손동작 게이트 first, so the
 * visitor is already standing in position and posing before the 10 seconds
 * start; that makes the real window 15–30 s rather than 10, which is what lets
 * the sidecar take a median and stop caring about individual bad frames.
 */
export class HeightService {
  private readonly enabled: boolean;
  private sampling = false;
  private runtime: HeightRuntime;
  /** The current capture window's result, until a shot claims it. */
  private pendingShot: ShotMeasurement | null = null;
  private waiters: MeasurementWaiter[] = [];

  constructor(
    private readonly sidecar: ZedSidecarManager,
    private readonly repo: HeightRepository,
    private readonly kiosk: KioskService,
  ) {
    const { layout } = this.kiosk.getConfig();
    this.enabled = isJejuLayout(layout) && process.env['HEIGHT_ENABLED'] !== 'false';
    this.runtime = {
      enabled: this.enabled,
      running: false,
      calibrated: false,
      cameraHeightM: null,
      lastError: null,
    };
  }

  start(): void {
    if (!this.enabled) {
      log.info('Height measurement not enabled for this kiosk');
      return;
    }
    this.sidecar.subscribe((event) => this.onSidecarEvent(event));
    this.sidecar.start();
  }

  stop(): void {
    this.sidecar.stop();
    this.sampling = false;
  }

  getRuntime(): HeightRuntime {
    return { ...this.runtime, running: this.sidecar.isRunning() };
  }

  /**
   * Follow the photo workflow's camera window.
   *
   * Edge-triggered rather than level-triggered: the workflow broadcasts on
   * every transition (and 제주 makes several inside one capture — style, gate
   * armed, countdown started, each tick of the count), and re-sending `start`
   * on each of those would reset the sample buffer and throw away the frames
   * already collected. Only the transitions in and out of "camera live" matter.
   */
  onPhotoWorkflowChanged(state: PhotoWorkflowState): void {
    if (!this.enabled) return;

    const cameraLive = isCameraLive(state.phase);
    if (cameraLive === this.sampling) return;

    this.sampling = cameraLive;
    // A new visitor: whatever the last window measured belongs to someone else.
    if (cameraLive) this.pendingShot = null;
    this.sidecar.send({ cmd: cameraLive ? 'start' : 'stop' });
  }

  /**
   * Claim the measurement of the capture that just ended, for `/shots/v2`.
   *
   * The sidecar answers only after the camera window closes, which can land
   * after the shot is reported (an early pipeline failure), so this waits up to
   * `timeoutMs` for it. Consumed once — a second shot never gets the same
   * visitor's numbers. Resolves null when disabled or nothing arrives.
   */
  claimShotMeasurement(timeoutMs = 5000): Promise<ShotMeasurement | null> {
    if (!this.enabled) return Promise.resolve(null);
    if (this.pendingShot) {
      const measurement = this.pendingShot;
      this.pendingShot = null;
      return Promise.resolve(measurement);
    }
    return new Promise((resolve) => {
      const waiter: MeasurementWaiter = (measurement) => {
        clearTimeout(timer);
        resolve(measurement);
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        resolve(null);
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  /**
   * Drop measurements past the retention window.
   *
   * Registered as a night task rather than run on a timer of its own: the
   * nightly sync already owns "things the kiosk does at 02:00 when nobody is
   * using it", and a DELETE over an indexed column is not worth a second
   * scheduler. Best-effort — a failed prune is not worth waking anyone for, and
   * tomorrow's run will clear the same rows.
   */
  async pruneOldMeasurements(): Promise<void> {
    if (!this.enabled) return;
    try {
      const removed = this.repo.pruneBefore(localDateDaysBefore(RETENTION_DAYS));
      if (removed > 0) log.info('Pruned old height measurements', { removed });
    } catch (error) {
      log.warn('Height prune failed', error);
    }
  }

  private onSidecarEvent(event: SidecarEvent): void {
    switch (event.type) {
      case 'ready':
        this.runtime = {
          ...this.runtime,
          calibrated: Boolean(event['calibrated']),
          cameraHeightM: finiteOrNull(event['cameraHeightM']),
          lastError: null,
        };
        log.info('Height sidecar ready', {
          calibrated: this.runtime.calibrated,
          cameraHeightM: this.runtime.cameraHeightM,
        });
        if (!this.runtime.calibrated) {
          log.warn(
            'ZED has no floor calibration; no heights will be recorded. ' +
              'Run `python main.py --calibrate` with nobody in front of the camera.',
          );
        }
        break;

      case 'calibrated':
        this.runtime = {
          ...this.runtime,
          calibrated: true,
          cameraHeightM: finiteOrNull(event['cameraHeightM']),
        };
        log.info('ZED floor calibrated', { cameraHeightM: this.runtime.cameraHeightM });
        break;

      case 'result':
        this.record(toMeasurement(event));
        break;

      case 'error':
        this.runtime = { ...this.runtime, lastError: String(event['message'] ?? 'unknown') };
        log.warn('Height sidecar error', { message: this.runtime.lastError });
        break;

      default:
        break;
    }
  }

  /**
   * Persist one capture's measurement.
   *
   * Null-height rows are stored too. "Nobody was in the zone" and "this was a
   * 같이찍기 capture" are exactly the rows that reveal whether the estimator is
   * working; a table that only ever holds successes always looks healthy. See
   * migration 008.
   */
  private record(measurement: HeightMeasurement): void {
    const now = new Date();
    const shot: ShotMeasurement = { ...measurement, measuredAt: localIso(now) };
    const waiter = this.waiters.shift();
    if (waiter) waiter(shot);
    else this.pendingShot = shot;
    try {
      this.repo.insert({
        ...measurement,
        id: randomUUID(),
        kioskId: this.kiosk.getConfig().kioskId,
        measuredAt: localIso(now),
        localDate: localDateOf(now),
        hour: now.getHours(),
      });
      // One readable line per capture — this is what a tester watches for.
      log.info(
        measurement.heightCm === null
          ? `===== HEIGHT: none — ${measurement.reason ?? 'unknown'} =====`
          : `===== HEIGHT: ${measurement.heightCm.toFixed(1)} cm ` +
              `| shoulder ${cm(measurement.shoulderWidthCm)} chest ${cm(measurement.chestWidthCm)} ` +
              `waist ${cm(measurement.waistWidthCm)} hip ${cm(measurement.hipWidthCm)} ` +
              `(confidence ${measurement.confidence.toFixed(2)}, ` +
              `${measurement.samples} frames, v${measurement.version ?? '?'}) =====`,
      );
    } catch (error) {
      // A failed analytics write is not worth surfacing anywhere: the photo is
      // already taken and the visitor is looking at it.
      log.error('Could not store height measurement', error);
    }
  }
}

