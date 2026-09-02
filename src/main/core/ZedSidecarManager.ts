/**
 * Supervises the 제주 visitor-height sidecar (zed-height/) as a child process.
 *
 * The sidecar owns the ZED 2i exclusively — the ZED SDK claims its device
 * through CUDA and cannot share it with `getUserMedia`. That is only workable
 * because 제주 has TWO cameras: the Elgato takes the photo on the existing UVC
 * path, and this one does nothing but measure. See zed-height/README.md.
 *
 * ── Why a Python child process ─────────────────────────────────────────
 * `pyzed` is the ZED SDK's own binding and the only sane way to reach it. A
 * native Node addon would mean node-gyp, an Electron ABI rebuild, and linking
 * the SDK on Windows, for no gain. Isolation is a bonus: a CUDA fault or a
 * wedged camera driver kills a child we respawn, not the kiosk UI.
 *
 * ── It is packaged as extraResources, NOT into the asar ────────────────
 * Unlike the payment agent (which is Node and reads fine from inside app.asar),
 * a Python interpreter cannot open a file in an asar archive — it is a virtual
 * path that only Electron's patched fs understands. The sidecar therefore ships
 * under `resources/zed-height` and is resolved from `process.resourcesPath`.
 *
 * Everything here is best-effort. A missing SDK, an unplugged camera or a dead
 * child costs a null height and nothing else; HeightService never lets the photo
 * flow wait on it.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { app } from 'electron';
import { createLogger } from './logger';
import { NdjsonBuffer } from './ndjson';

const log = createLogger('zed-sidecar');

/** Restart backoff: starts at 3s, doubles, capped at 60s. */
const RESTART_MIN_MS = 3_000;
const RESTART_MAX_MS = 60_000;

/**
 * Consecutive failed starts before we stop trying until the next app launch.
 *
 * A kiosk whose ZED SDK was never installed would otherwise respawn a doomed
 * Python process every minute for the machine's entire uptime, filling the log
 * with the same traceback and telling the operator nothing new. Giving up
 * loudly, once, is more useful than retrying quietly forever — and the feature
 * is optional by design, so giving up is a legitimate end state.
 */
const MAX_CONSECUTIVE_FAILURES = 5;

/** A frame of the sidecar's protocol. See zed-height/README.md. */
export interface SidecarEvent {
  type: 'ready' | 'result' | 'calibrated' | 'pong' | 'error';
  [key: string]: unknown;
}

type EventListener = (event: SidecarEvent) => void;

export class ZedSidecarManager {
  private child: ChildProcess | null = null;
  private restartTimer: NodeJS.Timeout | null = null;
  private backoffMs = RESTART_MIN_MS;
  private stopped = false;
  private consecutiveFailures = 0;
  private gaveUp = false;
  private readonly buffer = new NdjsonBuffer();
  private readonly listeners = new Set<EventListener>();

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isRunning(): boolean {
    return this.child !== null;
  }

  /** Directory holding the sidecar. Real on disk in both dev and packaged. */
  private scriptDir(): string {
    return app.isPackaged
      ? join(process.resourcesPath, 'zed-height')
      : join(process.cwd(), 'zed-height');
  }

  /**
   * The interpreter to run. `HEIGHT_PYTHON` exists because the sidecar must run
   * under the SAME Python the ZED SDK's `get_python_api.py` installed pyzed
   * into, and on a machine with several Pythons the bare `python` on PATH is
   * frequently not that one.
   */
  private pythonPath(): string {
    return process.env['HEIGHT_PYTHON'] || 'python';
  }

  start(): void {
    this.stopped = false;
    if (this.child || this.gaveUp) return;

    const dir = this.scriptDir();
    const entry = join(dir, 'main.py');
    if (!existsSync(entry)) {
      log.warn('Height sidecar not found; skipping', { entry });
      this.gaveUp = true;
      return;
    }

    try {
      const child = spawn(this.pythonPath(), ['-u', 'main.py'], {
        cwd: dir,
        env: {
          ...process.env,
          // The floor calibration must survive an auto-update, which replaces
          // the install directory wholesale. userData does; the script's own
          // folder does not.
          HEIGHT_CALIBRATION: join(app.getPath('userData'), 'zed-height', 'calibration.json'),
          PYTHONIOENCODING: 'utf-8',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
      this.child = child;
      const startedAt = Date.now();
      log.info('Height sidecar starting', { pid: child.pid });

      child.stdout?.on('data', (b: Buffer) => this.onStdout(b.toString()));
      child.stderr?.on('data', (b: Buffer) => log.info(`[zed] ${b.toString().trimEnd()}`));

      child.on('error', (err) => log.error('Height sidecar spawn error', err));

      child.on('exit', (code) => {
        this.child = null;
        // Whatever it was midway through writing is incomplete by definition;
        // keeping it would prepend garbage to the replacement's first line.
        this.buffer.reset();
        if (this.stopped) {
          log.info('Height sidecar stopped');
          return;
        }
        // Ran for a while before dying? Then it was working, and this is a
        // fault rather than a machine that can never run it. Reset both the
        // backoff and the give-up counter.
        if (Date.now() - startedAt > 30_000) {
          this.backoffMs = RESTART_MIN_MS;
          this.consecutiveFailures = 0;
        } else {
          this.consecutiveFailures += 1;
        }

        if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          this.gaveUp = true;
          log.error(
            'Height sidecar failed to stay up; giving up until next launch. ' +
              'Check that the ZED SDK and pyzed are installed (see zed-height/README.md).',
            { attempts: this.consecutiveFailures },
          );
          return;
        }

        log.warn('Height sidecar exited; scheduling restart', {
          code,
          backoffMs: this.backoffMs,
        });
        this.scheduleRestart();
      });
    } catch (error) {
      log.error('Failed to spawn height sidecar; scheduling restart', error);
      this.consecutiveFailures += 1;
      this.scheduleRestart();
    }
  }

  /** Turn stdout into protocol events. Reassembly lives in NdjsonBuffer. */
  private onStdout(chunk: string): void {
    for (const line of this.buffer.push(chunk)) {
      let event: SidecarEvent;
      try {
        event = JSON.parse(line) as SidecarEvent;
      } catch {
        // Anything unparseable on stdout is a sidecar bug (diagnostics belong on
        // stderr), but it must never take the supervisor down with it.
        log.warn('Unparseable line from height sidecar', { line: line.slice(0, 200) });
        continue;
      }
      for (const listener of this.listeners) {
        try {
          listener(event);
        } catch (error) {
          log.error('Height sidecar listener threw', error);
        }
      }
    }
  }

  /** Fire-and-forget a command. Silently does nothing when the child is down. */
  send(command: Record<string, unknown>): void {
    const stdin = this.child?.stdin;
    if (!stdin || !stdin.writable) return;
    try {
      stdin.write(`${JSON.stringify(command)}\n`);
    } catch (error) {
      log.warn('Could not write to height sidecar', error);
    }
  }

  private scheduleRestart(): void {
    if (this.restartTimer || this.stopped) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.start();
    }, this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, RESTART_MAX_MS);
  }

  stop(): void {
    this.stopped = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.child?.kill();
    this.child = null;
  }
}
