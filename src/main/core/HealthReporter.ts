/**
 * Kiosk health reporting.
 *
 * - Keeps `userData/health/run-state.json` while the app runs (a heartbeat every
 *   minute with the main-process memory), and marks it clean on a normal quit.
 *   At the next launch an unclean file means the previous run ended abnormally —
 *   reported as ABNORMAL_EXIT with the last known memory and uncaught error.
 * - Reports renderer / child-process deaths and uncaught exceptions as they happen.
 * - Supplies the metadata headers for the 5-minute update-command poll.
 *
 * Reports go to POST {api}/api/kiosks/{kioskNum}/crash-reports and are queued in
 * the run-state file until the server accepts them (best effort, never blocks or
 * crashes the app). Why: the October 2026 field shutdowns left no trace anywhere
 * but a local log on the kiosk PC — this makes them visible from the server.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { uptime as osUptime } from 'node:os';
import { join } from 'node:path';
import { app } from 'electron';
import { createLogger } from './logger';
import { witteriaApiBase } from './apiBase';
import { resolveUpdateChannel } from '@main/updater/updateChannel';
import {
  classifyPreviousRun,
  clip,
  enqueue,
  isoLocal,
  MAX_MESSAGE,
  MAX_STACK,
  signalHeaders,
  type CrashReport,
  type RunState,
} from './healthReport';
import type { KioskService } from '@main/services/KioskService';

const BEAT_MS = 60_000;
const POST_TIMEOUT_MS = 10_000;
/** The same uncaught error can fire hundreds of times (Array buffer allocation failed: 516 in the field). */
const SAME_ERROR_COOLDOWN_MS = 60 * 60_000;

export class HealthReporter {
  private readonly log = createLogger('health');
  private readonly file = join(app.getPath('userData'), 'health', 'run-state.json');
  private state: RunState | null = null;
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;
  private readonly lastErrorSent = new Map<string, number>();

  constructor(private readonly kiosk: KioskService) {}

  start(): void {
    if (this.state) return;
    const previous = this.read();
    const report = classifyPreviousRun(previous, Date.now() - osUptime() * 1000);
    if (report) {
      this.log.warn('Previous run ended abnormally', {
        suspectedCause: report.suspectedCause,
        version: report.appVersion,
        lastBeatAt: report.occurredAt,
        lastRssMb: report.mainRssMb,
      });
    }
    const now = Date.now();
    this.state = {
      pid: process.pid,
      appVersion: app.getVersion(),
      channel: resolveUpdateChannel(),
      kioskCode: this.kiosk.getConfig().kioskId,
      startedAt: now,
      lastBeatAt: now,
      lastRssMb: rssMb(),
      cleanExit: false,
      pending: report ? enqueue(previous?.pending ?? [], report) : (previous?.pending ?? []),
    };
    this.write();
    void this.flush();
    this.timer = setInterval(() => this.beat(), BEAT_MS);
    this.timer.unref?.();

    app.on('render-process-gone', (_e, _wc, details) =>
      this.report({
        kind: 'RENDERER_GONE',
        processType: 'renderer',
        reason: details.reason,
        exitCode: details.exitCode,
      }),
    );
    app.on('child-process-gone', (_e, details) => {
      // A normal exit of a helper (e.g. a utility process finishing) is not news.
      if (details.reason === 'clean-exit') return;
      this.report({
        kind: 'CHILD_GONE',
        processType: details.name ?? details.type,
        reason: details.reason,
        exitCode: details.exitCode,
      });
    });
  }

  /** Call from `before-quit` / `session-end`. Synchronous on purpose. */
  markCleanExit(): void {
    if (!this.state) return;
    if (this.timer) clearInterval(this.timer);
    this.state.cleanExit = true;
    this.state.lastBeatAt = Date.now();
    this.write();
  }

  /** Remember an uncaught error for the crash report and send it (deduplicated). */
  recordUncaught(error: unknown): void {
    if (!this.state) return;
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    this.state.lastError = {
      message: clip(message, MAX_MESSAGE) ?? '',
      stack: clip(stack, MAX_STACK),
      at: Date.now(),
    };
    this.write();
    const last = this.lastErrorSent.get(message) ?? 0;
    if (Date.now() - last < SAME_ERROR_COOLDOWN_MS) return;
    this.lastErrorSent.set(message, Date.now());
    this.report({ kind: 'UNCAUGHT_EXCEPTION', processType: 'browser', message, stack });
  }

  /** Headers for the update-command poll (version, channel, uptime, memory). */
  signalHeaders(): Record<string, string> {
    return signalHeaders({
      appVersion: app.getVersion(),
      channel: resolveUpdateChannel(),
      kioskCode: this.kiosk.getConfig().kioskId,
      uptimeSec: process.uptime(),
      mainRssMb: rssMb(),
    });
  }

  private report(
    partial: Omit<CrashReport, 'occurredAt' | 'appVersion' | 'channel' | 'kioskCode'>,
  ): void {
    if (!this.state) return;
    const report: CrashReport = {
      occurredAt: isoLocal(Date.now()),
      appVersion: this.state.appVersion,
      channel: this.state.channel,
      kioskCode: this.state.kioskCode,
      uptimeSec: Math.round(process.uptime()),
      mainRssMb: rssMb(),
      ...partial,
      message: clip(partial.message, MAX_MESSAGE),
      stack: clip(partial.stack, MAX_STACK),
    };
    this.log.warn('Crash report queued', {
      kind: report.kind,
      reason: report.reason,
      processType: report.processType,
    });
    this.state.pending = enqueue(this.state.pending, report);
    this.write();
    void this.flush();
  }

  private beat(): void {
    if (!this.state) return;
    this.state.lastBeatAt = Date.now();
    this.state.lastRssMb = rssMb();
    this.write();
    if (this.state.pending.length) void this.flush();
  }

  /** Send queued reports oldest first; stop at the first failure and retry next beat. */
  private async flush(): Promise<void> {
    if (!this.state || this.flushing || !this.state.pending.length) return;
    this.flushing = true;
    try {
      const url = `${witteriaApiBase()}/api/kiosks/${this.kiosk.kioskNum()}/crash-reports`;
      while (this.state.pending.length) {
        const next = this.state.pending[0];
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...this.signalHeaders() },
            body: JSON.stringify(next),
            signal: controller.signal,
          });
          // 5xx = try again later. 4xx = the server will never take this one (e.g. an
          // older server without the endpoint) — drop it rather than block the queue.
          if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
          if (!res.ok)
            this.log.warn('Crash report rejected; dropped', {
              status: res.status,
              kind: next?.kind,
            });
        } finally {
          clearTimeout(t);
        }
        this.state.pending = this.state.pending.slice(1);
        this.write();
      }
    } catch (e) {
      this.log.info('Crash reports not sent yet; will retry', {
        pending: this.state.pending.length,
        error: String(e),
      });
    } finally {
      this.flushing = false;
    }
  }

  private read(): RunState | null {
    try {
      return JSON.parse(readFileSync(this.file, 'utf8')) as RunState;
    } catch {
      return null;
    }
  }

  /** Write via a temp file + rename so a crash mid-write never leaves half a file. */
  private write(): void {
    if (!this.state) return;
    try {
      mkdirSync(join(this.file, '..'), { recursive: true });
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.state));
      renameSync(tmp, this.file);
    } catch (e) {
      this.log.warn('Could not write run state', { error: String(e) });
    }
  }
}

function rssMb(): number {
  return Math.round(process.memoryUsage().rss / 1048576);
}
