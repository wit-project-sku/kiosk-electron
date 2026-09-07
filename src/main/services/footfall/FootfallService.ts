import type {
  FootfallReport,
  FootfallRuntime,
  FootfallStats,
  FootfallSuspendReason,
  FootfallTuning,
} from '@shared/types/footfall';
import type { DisplayState } from '@shared/types/domain';
import type { PhotoWorkflowState } from '@shared/types/photo';
import {
  DEFAULT_FOOTFALL_TUNING,
  FOOTFALL_FLUSH_INTERVAL_MS,
  parseFootfallLine,
  parseNumberInRange,
} from '@shared/config/footfall';
import { createLogger } from '@main/core/logger';
import { getKioskLayout, isKadaLayout } from '@shared/config/kioskLocations';
import type { KioskService } from '@main/services/KioskService';
import type { CameraService } from '@main/services/camera/CameraService';
import type {
  FootfallDelta,
  FootfallRepository,
} from '@main/database/repositories/FootfallRepository';
import { bucketStartOf, localDateOf } from './time';

const log = createLogger('footfall');

type RuntimeListener = (runtime: FootfallRuntime) => void;

/**
 * Cool-down after the camera comes back to us.
 *
 * A photo session ends with a group of people standing directly in front of the
 * kiosk, and they then walk away — across the counting line, together, all at
 * once. Those are not passers-by, they are the customers we just photographed,
 * and counting them would put a spike in the data at exactly the hours the
 * kiosk was busiest. Waiting a few seconds before re-arming lets them clear.
 */
const RESUME_COOLDOWN_MS = 6_000;

/**
 * 유동인구 — the durable half.
 *
 * The renderer sees the people; this owns everything that outlives a frame:
 * whether counting is allowed to run at all, which hour the counts belong to,
 * and getting them into SQLite. It never sees an image.
 *
 * ── The camera is not ours ─────────────────────────────────────────────
 * The photo pipeline owns the camera; counting borrows it. Chromium hands the
 * SECOND opener of a device whatever format the FIRST one negotiated, so a
 * counting loop still holding the camera at 320-wide when the photo flow opens
 * it would silently produce 320-wide PHOTOS. That is why `active` exists, and
 * why it is computed here from state main already has rather than being
 * something the renderer decides for itself.
 *
 * Nothing about the photo flow had to change to make that work: this subscribes
 * to the workflow and display state it already broadcasts.
 */
export class FootfallService {
  private readonly listeners = new Set<RuntimeListener>();
  /** Accumulated, not-yet-persisted counts, keyed by local hour bucket. */
  private readonly pending = new Map<string, FootfallDelta>();
  private flushTimer: NodeJS.Timeout | null = null;
  private resumeTimer: NodeJS.Timeout | null = null;

  private readonly enabled: boolean;
  private readonly tuning: FootfallTuning;
  private readonly line = parseFootfallLine(process.env['FOOTFALL_LINE']);

  /** Reasons currently blocking counting. Empty = the camera is ours. */
  private readonly blockers = new Set<FootfallSuspendReason>();
  private started = false;
  private deviceId: string | null = null;
  /**
   * Whether the renderer could actually open a camera last time it tried.
   *
   * Deliberately NOT a blocker. A blocker would clear `active`, the renderer
   * would tear its loop down, and nothing would ever set the flag back — the
   * feature would be dead until the next reboot. Worse, the broadcast that
   * carried the bad news would itself restart the renderer's effect, throwing
   * away the backoff it had just started and turning one unplugged cable into a
   * getUserMedia call every few milliseconds. So this is diagnostic only: main
   * keeps saying "count", and the renderer's own retry schedule decides when to
   * try the device again.
   */
  private cameraAvailable = true;
  private lastUploadAt: string | null = null;
  private lastUploadError: string | null = null;

  constructor(
    private readonly repo: FootfallRepository,
    private readonly kiosk: KioskService,
    private readonly camera: CameraService,
  ) {
    /*
     * 유동인구 counting is opt-OUT everywhere except KADA, where it is opt-IN.
     *
     * W202 is a two-week opening-ceremony kiosk in Hanoi with no footfall
     * mandate, and leaving the fleet default on would have it run the MediaPipe
     * person detector against the camera all day and POST hourly counts to
     * `/api/kiosks/9/...`, which does not exist. It also shares that camera with
     * the K-CULTURE CHALLENGE flow, so the cost buys nothing and risks
     * something. An explicit FOOTFALL_ENABLED=true still turns it on if the
     * venue ever asks for the numbers.
     */
    const layout = getKioskLayout(kiosk.getConfig().kioskId);
    this.enabled = isKadaLayout(layout)
      ? process.env['FOOTFALL_ENABLED'] === 'true'
      : process.env['FOOTFALL_ENABLED'] !== 'false';
    this.tuning = {
      ...DEFAULT_FOOTFALL_TUNING,
      targetFps: parseNumberInRange(
        process.env['FOOTFALL_FPS'],
        DEFAULT_FOOTFALL_TUNING.targetFps,
        2,
        15,
      ),
      scoreThreshold: parseNumberInRange(
        process.env['FOOTFALL_SCORE'],
        DEFAULT_FOOTFALL_TUNING.scoreThreshold,
        0.05,
        0.9,
      ),
      trackScoreThreshold: parseNumberInRange(
        process.env['FOOTFALL_TRACK_SCORE'],
        DEFAULT_FOOTFALL_TUNING.trackScoreThreshold,
        0.1,
        0.95,
      ),
      minBoxAreaRatio: parseNumberInRange(
        process.env['FOOTFALL_MIN_BOX'],
        DEFAULT_FOOTFALL_TUNING.minBoxAreaRatio,
        0,
        0.5,
      ),
    };
  }

  /** Begin the flush loop and arm counting. Called once, at startup. */
  start(): void {
    if (!this.enabled) {
      log.info('Footfall counting disabled (FOOTFALL_ENABLED=false)');
      this.emit();
      return;
    }
    if (this.flushTimer) return;

    this.flushTimer = setInterval(() => this.flush(), FOOTFALL_FLUSH_INTERVAL_MS);
    if (typeof this.flushTimer.unref === 'function') this.flushTimer.unref();

    this.started = true;
    log.info('Footfall counting started', { line: this.line, tuning: this.tuning });
    this.emit();
  }

  /** Persist whatever is buffered and stop the loop (shutdown). */
  stop(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = null;
    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    this.resumeTimer = null;
    this.started = false;
    this.flush();
  }

  getRuntime(): FootfallRuntime {
    const cooling = this.resumeTimer !== null;
    return {
      enabled: this.enabled,
      active: this.enabled && this.started && this.blockers.size === 0 && !cooling,
      suspendReason: cooling ? 'cooldown' : this.firstBlocker(),
      // The stored preference first: `resolveDeviceId` can only answer once
      // something has enumerated devices into the camera cache, and at boot
      // nothing has. A null here is not a failure — it means "open the default
      // camera", which on a single-camera kiosk is the same device anyway.
      deviceId: this.deviceId ?? this.camera.getPreferredDevice() ?? this.camera.resolveDeviceId(),
      line: this.line,
      tuning: this.tuning,
    };
  }

  subscribe(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Follow the photo workflow. Any phase other than 'idle' means a visitor is
   * somewhere in the AR 한복 flow, and the camera either is live or is about to
   * be — `selectStyle` turns it on two taps after 'clothing', which is not
   * enough warning to release a device asynchronously. So counting yields at the
   * START of the flow, not at the moment the preview opens.
   */
  onPhotoWorkflowChanged(state: PhotoWorkflowState): void {
    this.setBlocker('photo-session', state.phase !== 'idle');
  }

  /**
   * Follow the customer display too. `syncDisplay('camera')` is the call that
   * actually opens the device, and it can be reached from paths that never
   * touch the workflow (the operator's display controls, a donation web view
   * driving a capture). Watching both means a capture path added later cannot
   * quietly start competing for the camera.
   */
  onDisplayStateChanged(state: DisplayState): void {
    this.setBlocker('display-camera', state.mode === 'camera' || state.mode === 'countdown');
  }

  /**
   * The renderer's report on whether a camera opened. Records only — see the
   * field's comment for why this must never suspend anything or broadcast.
   */
  setCameraAvailable(available: boolean): void {
    if (this.cameraAvailable === available) return;
    this.cameraAvailable = available;
    log.info('Footfall camera availability changed', { available });
  }

  /** The renderer reports which device it actually opened, for diagnostics. */
  setActiveDevice(deviceId: string | null): void {
    this.deviceId = deviceId;
  }

  /** Recorded by the uploader so the operator view can show the last attempt. */
  recordUpload(at: string, error: string | null): void {
    this.lastUploadAt = at;
    this.lastUploadError = error;
  }

  /**
   * Take a batch of crossings from the renderer.
   *
   * Each crossing carries its OWN timestamp and is bucketed individually, so a
   * batch that straddles 14:59:58 → 15:00:01 puts two counts in the 14:00
   * bucket and one in the 15:00 bucket rather than all three wherever the flush
   * happened to land.
   */
  report(report: FootfallReport): { accepted: number } {
    if (!this.enabled) return { accepted: 0 };

    const kioskId = this.kiosk.getConfig().kioskId;

    for (const crossing of report.crossings) {
      const at = new Date(crossing.at);
      // A malformed timestamp must not create a bucket called "Invalid Date".
      const when = Number.isNaN(at.getTime()) ? new Date() : at;
      const delta = this.deltaFor(kioskId, when);
      if (crossing.direction === 'in') delta.inCount += 1;
      else delta.outCount += 1;
    }

    // Watch time is attributed to the hour the report arrives in. It is a data
    // quality signal, not a count, so splitting it across an hour boundary would
    // cost a second timestamp per report and buy nothing.
    if (report.activeMs > 0) {
      this.deltaFor(kioskId, new Date()).activeSeconds += report.activeMs / 1000;
    }

    return { accepted: report.crossings.length };
  }

  /** Write buffered deltas to SQLite. Called on a timer, and at shutdown. */
  flush(): void {
    if (this.pending.size === 0) return;
    const deltas = [...this.pending.values()];
    this.pending.clear();
    try {
      this.repo.addMany(deltas);
      const counted = deltas.reduce((sum, d) => sum + d.inCount + d.outCount, 0);
      if (counted > 0) log.debug('Footfall flushed', { buckets: deltas.length, counted });
    } catch (error) {
      // Put them back rather than lose them; the next tick tries again.
      for (const delta of deltas) {
        const existing = this.pending.get(delta.bucketStart);
        if (existing) {
          existing.inCount += delta.inCount;
          existing.outCount += delta.outCount;
          existing.activeSeconds += delta.activeSeconds;
        } else {
          this.pending.set(delta.bucketStart, delta);
        }
      }
      log.error('Footfall flush failed; counts retained in memory', error);
    }
  }

  /** Operator/diagnostic snapshot. Flushes first so the numbers are current. */
  getStats(): FootfallStats {
    this.flush();
    const kioskId = this.kiosk.getConfig().kioskId;
    const date = localDateOf(new Date());
    const buckets = this.repo.day(kioskId, date);

    return {
      runtime: this.getRuntime(),
      today: {
        date,
        inCount: buckets.reduce((sum, b) => sum + b.inCount, 0),
        outCount: buckets.reduce((sum, b) => sum + b.outCount, 0),
        totalCount: buckets.reduce((sum, b) => sum + b.totalCount, 0),
      },
      hours: buckets.map((b) => ({ hour: b.hour, totalCount: b.totalCount })),
      pendingBuckets: this.repo.countPending(),
      lastUploadAt: this.lastUploadAt,
      lastUploadError: this.lastUploadError,
    };
  }

  private deltaFor(kioskId: string, when: Date): FootfallDelta {
    const bucketStart = bucketStartOf(when);
    let delta = this.pending.get(bucketStart);
    if (!delta) {
      delta = {
        kioskId,
        bucketStart,
        localDate: localDateOf(when),
        hour: when.getHours(),
        inCount: 0,
        outCount: 0,
        activeSeconds: 0,
      };
      this.pending.set(bucketStart, delta);
    }
    return delta;
  }

  private firstBlocker(): FootfallSuspendReason | null {
    if (!this.enabled) return 'disabled';
    for (const reason of this.blockers) return reason;
    // Nothing is holding the camera away from us; it just isn't there.
    if (!this.cameraAvailable) return 'no-camera';
    return null;
  }

  /**
   * Add or clear a blocker.
   *
   * Suspending is immediate — the camera may be needed a frame from now.
   * Resuming is delayed by RESUME_COOLDOWN_MS, and any new blocker arriving
   * during that window cancels it, so a flow that bounces through 'idle'
   * between two screens never briefly hands the camera back.
   */
  private setBlocker(reason: FootfallSuspendReason, blocked: boolean): void {
    if (blocked) {
      if (this.resumeTimer) {
        clearTimeout(this.resumeTimer);
        this.resumeTimer = null;
      }
      if (this.blockers.has(reason)) return;
      this.blockers.add(reason);
      log.debug('Footfall suspended', { reason });
      this.emit();
      return;
    }

    if (!this.blockers.has(reason)) return;
    this.blockers.delete(reason);
    if (this.blockers.size > 0) {
      this.emit();
      return;
    }

    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = null;
      log.debug('Footfall resumed', { after: reason });
      this.emit();
    }, RESUME_COOLDOWN_MS);
    if (typeof this.resumeTimer.unref === 'function') this.resumeTimer.unref();
    // Still paused for now — the cooldown is a pause too.
    this.emit();
  }

  private emit(): void {
    const runtime = this.getRuntime();
    for (const listener of this.listeners) listener(runtime);
  }
}
