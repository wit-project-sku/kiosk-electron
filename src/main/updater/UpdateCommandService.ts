/**
 * Remote "update now" trigger (operator-initiated, from the admin site).
 *
 * The scheduled update path ({@link UpdateService}) is deliberately conservative:
 * production kiosks only check during the weekly maintenance window so they never
 * restart during business hours. That is the right default, but it means an
 * urgent fix can sit unshipped for up to a week.
 *
 * This service adds a second, explicit trigger WITHOUT touching that schedule.
 * The witteria API stores a single timestamp — "when an update was last
 * requested" — which an admin sets by clicking a button. Every kiosk polls it and
 * runs an immediate check when it sees a timestamp NEWER than the last one it
 * already handled. See docs/UPDATE_COMMAND_API.md for the backend contract.
 *
 * Why a timestamp rather than a boolean flag:
 *  - idempotent — a kiosk that already updated finds nothing new to do,
 *  - survives downtime — a kiosk that was powered off still sees a newer value
 *    on its next poll after boot and updates then,
 *  - no clock-skew risk — we compare the fetched value against the last
 *    SERVER-provided value we stored, never against the kiosk's own clock
 *    (kiosk clocks drift; it does not affect correctness),
 *  - no server-side per-kiosk bookkeeping — one value serves the whole fleet.
 *
 * All kiosks ship the SAME build; only the electron-store `kioskId` differs, and
 * `KioskService.kioskNum()` resolves it at runtime — so nothing kiosk-specific is
 * baked in here.
 *
 * Env:
 *   UPDATE_COMMAND_API_URL  — full endpoint override (wins if set)
 *   WITTERIA_API_BASE       — shared API base, default https://api-v3.witteria.com
 *   UPDATE_COMMAND_POLL_MIN — minutes between polls (default 5, clamped 1–60)
 */

import { app } from 'electron';
import { createLogger } from '@main/core/logger';
import type { KioskService } from '@main/services/KioskService';
import type { UpdateService } from './UpdateService';
import { UpdateStateStore } from './UpdateStateStore';

const DEFAULT_API_BASE = 'https://api-v3.witteria.com';

const DEFAULT_POLL_MINUTES = 5;
const MIN_POLL_MINUTES = 1;
const MAX_POLL_MINUTES = 60;

/** First poll waits a little so it doesn't compete with startup work. */
const INITIAL_DELAY_MS = 60_000;
/** A hung request must not pin the poll loop. */
const FETCH_TIMEOUT_MS = 10_000;

interface UpdateCommandPayload {
  success?: boolean;
  data?: { requestedAt?: string | null } | null;
}

export class UpdateCommandService {
  private readonly log = createLogger('update-command');
  private readonly state = new UpdateStateStore();
  private timer: NodeJS.Timeout | null = null;
  private started = false;
  private polling = false;
  /** Consecutive failed polls — drives the throttled failure logging below. */
  private failures = 0;

  constructor(
    private readonly updater: UpdateService,
    private readonly kiosk: KioskService,
  ) {}

  /** Begin polling. No-op if already started or running unpackaged. */
  start(): void {
    if (this.started) return;
    this.started = true;

    // electron-updater can only replace an installed (NSIS) build, so a dev run
    // has nothing to trigger. Matches UpdateService.start().
    if (!app.isPackaged) {
      this.log.info('Remote update command polling disabled (development build)');
      return;
    }

    this.log.info('Remote update command polling started', {
      url: this.endpoint(),
      everyMinutes: this.pollMinutes(),
    });
    this.arm(INITIAL_DELAY_MS);
  }

  /** Cancel the poll loop (called on app quit). */
  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.started = false;
  }

  // ---- internals -----------------------------------------------------------

  private pollMinutes(): number {
    const n = Number.parseInt((process.env['UPDATE_COMMAND_POLL_MIN'] ?? '').trim(), 10);
    if (!Number.isInteger(n)) return DEFAULT_POLL_MINUTES;
    return Math.min(MAX_POLL_MINUTES, Math.max(MIN_POLL_MINUTES, n));
  }

  private endpoint(): string {
    if (process.env['UPDATE_COMMAND_API_URL']) return process.env['UPDATE_COMMAND_API_URL'];
    const base = (process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE).replace(/\/+$/, '');
    return `${base}/api/kiosks/${this.kiosk.kioskNum()}/update-command`;
  }

  private arm(delayMs: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  private async tick(): Promise<void> {
    try {
      await this.poll();
    } finally {
      // Always re-arm: an offline kiosk simply retries on the next interval.
      if (this.started) this.arm(this.pollMinutes() * 60_000);
    }
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const requestedAt = await this.fetchRequestedAt();
      if (requestedAt == null) return;

      const handled = this.state.getLastCommandHandled();
      if (requestedAt <= handled) return;

      // NOTE: on a freshly installed kiosk `handled` is 0, so any existing
      // request triggers exactly one check at boot. Harmless — the check is
      // cheap and the timestamp is recorded immediately after.
      this.log.info('Remote update command received; checking for updates now', {
        requestedAt: new Date(requestedAt).toISOString(),
        previouslyHandled: handled ? new Date(handled).toISOString() : 'never',
      });

      const status = await this.updater.checkNow();
      if (status.state === 'error') {
        // Do NOT record it — retry on the next poll so a transient network
        // failure can't swallow an operator's request.
        this.log.warn('Update check after remote command failed; will retry next poll', {
          error: status.error,
        });
        return;
      }

      this.state.setLastCommandHandled(requestedAt);
      this.log.info('Remote update command handled', {
        state: status.state,
        availableVersion: status.availableVersion,
      });
    } finally {
      this.polling = false;
    }
  }

  /** Fetch the command timestamp as epoch ms, or null if absent/unreachable. */
  private async fetchRequestedAt(): Promise<number | null> {
    const url = this.endpoint();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as UpdateCommandPayload;
      if (this.failures > 0) {
        this.log.info('Update command endpoint reachable again', { url, afterFailures: this.failures });
        this.failures = 0;
      }
      const raw = json.data?.requestedAt;
      if (!raw) return null; // null/absent = nothing requested
      const epoch = Date.parse(raw);
      if (!Number.isFinite(epoch)) {
        this.log.warn('Ignoring unparseable requestedAt', { requestedAt: raw });
        return null;
      }
      return epoch;
    } catch (err) {
      // Offline / API down / endpoint not deployed yet. Log the FIRST failure at
      // info (packaged builds persist info and above, so a silent poll would
      // otherwise be undiagnosable on a real kiosk), then throttle to roughly
      // hourly so a not-yet-deployed endpoint can't flood the log forever.
      this.failures += 1;
      const throttle = Math.max(1, Math.round(60 / this.pollMinutes()));
      if (this.failures === 1 || this.failures % throttle === 0) {
        this.log.info('Update command poll failed (offline or endpoint not deployed)', {
          url,
          consecutiveFailures: this.failures,
          message: err instanceof Error ? err.message : String(err),
        });
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
