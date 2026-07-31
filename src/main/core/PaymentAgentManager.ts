/**
 * Supervises the vendored NestJS payment agent as an isolated child process.
 *
 * Why a separate process (not in main): the agent talks to a TL-3800 card
 * terminal over `serialport` and keeps a better-sqlite3 outbox. Running it in
 * its own process means a serial/terminal failure can never crash the kiosk UI
 * — the supervisor just respawns it. It listens on 127.0.0.1:8080; the 위드마켓
 * webview store page calls that loopback API directly (CORS-allowed), so the
 * webview needs no changes whether the agent runs standalone or embedded.
 *
 * It is spawned as a real Node process via Electron's own binary with
 * ELECTRON_RUN_AS_NODE=1 — NOT utilityProcess.fork, whose restricted network
 * stack fails `net.Server.listen` with `UNKNOWN (-4094)`. Running as Electron's
 * Node keeps the native-module ABI (serialport / better-sqlite3) compatible.
 *
 * Lifecycle: started once after `app.whenReady` (card-terminal kiosks only —
 * W003/W004/W005, i.e. hasCardTerminal), killed on app quit, and respawned with capped backoff if it exits
 * unexpectedly. Every step is best-effort and swallows errors so payment
 * problems never affect kiosk startup or runtime.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { app } from 'electron';
import { createLogger } from './logger';

const log = createLogger('payment-agent');

/** Restart backoff: starts at 2s, doubles, capped at 30s. */
const RESTART_MIN_MS = 2_000;
const RESTART_MAX_MS = 30_000;

export class PaymentAgentManager {
  private child: ChildProcess | null = null;
  private restartTimer: NodeJS.Timeout | null = null;
  private backoffMs = RESTART_MIN_MS;
  private stopped = false;

  /** Absolute path to the vendored agent entry (works in dev and packaged). */
  private entryPath(): string {
    return app.isPackaged
      ? join(app.getAppPath(), 'payment-agent', 'dist', 'main.js')
      : join(process.cwd(), 'payment-agent', 'dist', 'main.js');
  }

  /** Environment passed to the agent. Reads PAYMENT_* overrides from the kiosk
   *  env (resources/.env), with sensible loopback defaults. */
  private childEnv(): Record<string, string> {
    const outboxDb = join(app.getPath('userData'), 'payment-agent', 'outbox.sqlite');
    mkdirSync(dirname(outboxDb), { recursive: true });

    // Forced/required values + sensible defaults. NODE_ENV and OUTBOX_DB_PATH
    // are forced (production; userData is writable, the agent's default
    // ./data/ is not under Program Files).
    const env: Record<string, string> = {
      NODE_ENV: 'production',
      OUTBOX_DB_PATH: outboxDb,
      HTTP_HOST: process.env['PAYMENT_HTTP_HOST'] ?? '127.0.0.1',
      HTTP_PORT: process.env['PAYMENT_HTTP_PORT'] ?? '8080',
      // Must include BOTH webview origins (each with no path/trailing slash, or
      // it won't match the Origin header) so the loopback calls aren't
      // CORS-blocked: the 위드마켓 store (https://witteria.com) AND the 기부
      // donation app — which is hosted on VERCEL (witglobaldonation.vercel.app),
      // NOT netlify. WEB_EMBED_URLS.donation is the source of truth for that host.
      CORS_ORIGINS:
        process.env['PAYMENT_CORS_ORIGINS'] ??
        'https://witteria.com,https://witglobaldonation.vercel.app,https://witglobaldonation.netlify.app,http://localhost:3000,http://localhost:5173',
      CENTRAL_BASE_URL: process.env['PAYMENT_CENTRAL_BASE_URL'] ?? '',
      TL3800_TERMINAL_ID: process.env['PAYMENT_TL3800_TERMINAL_ID'] ?? '',
    };

    // Optional pass-throughs: PAYMENT_<NAME> → <NAME>. Only forwarded when set,
    // so the agent's built-in defaults apply otherwise.
    const passthrough = [
      'LOG_LEVEL',
      'CENTRAL_AUTH_TOKEN',
      'CENTRAL_TIMEOUT_MS',
      'TL3800_PORT',
      'TL3800_BAUD_RATE',
      // New in agent v2: baud-rate discovery + a hex/ASCII frame dump used to
      // read a fresh terminal's IDs off the wire during install.
      'TL3800_BAUD_FALLBACKS',
      'TL3800_LOG_CONFIG_DISCOVERY',
      'TL3800_DATA_BITS',
      'TL3800_STOP_BITS',
      'TL3800_PARITY',
      'TL3800_ACK_WAIT_MS',
      'TL3800_RESP_WAIT_MS',
      'TL3800_MAX_ACK_RETRY',
      'TL3800_FOLLOWUP_WINDOW_MS',
      'OUTBOX_WORKER_INTERVAL_MS',
      'OUTBOX_MAX_ATTEMPTS',
    ];
    for (const name of passthrough) {
      const v = process.env[`PAYMENT_${name}`];
      if (v != null && v !== '') env[name] = v;
    }
    return env;
  }

  /** Spawn the agent. No-op if already running. */
  start(): void {
    this.stopped = false;
    if (this.child) return;

    const entry = this.entryPath();
    if (!existsSync(entry)) {
      log.warn('Payment agent entry not found; skipping', { entry });
      return;
    }
    if (!process.env['PAYMENT_CENTRAL_BASE_URL'] || !process.env['PAYMENT_TL3800_TERMINAL_ID']) {
      log.warn(
        'PAYMENT_CENTRAL_BASE_URL / PAYMENT_TL3800_TERMINAL_ID not set; the agent will fail validation and respawn. Configure resources/.env.',
      );
    }

    try {
      // Run the agent as a real Node process using Electron's binary
      // (ELECTRON_RUN_AS_NODE strips the Chromium/utility-process layer so
      // net.listen works).
      //
      // cwd MUST be a real on-disk directory. In a PACKAGED build `dirname(entry)`
      // is inside app.asar (a virtual path, not a real folder), so Windows `spawn`
      // fails with ENOENT — the agent never launches and nothing listens on :8080
      // (dev works only because there the dist dir is a real folder). Use userData
      // when packaged: it's real, writable, and has no `.env`, so the agent's
      // NestJS ConfigModule (which reads `.env` from cwd) picks up nothing stray —
      // all its config comes from the env we pass below, not a cwd `.env`.
      const cwd = app.isPackaged ? app.getPath('userData') : dirname(entry);
      const child = spawn(process.execPath, [entry], {
        cwd,
        env: { ...process.env, ...this.childEnv(), ELECTRON_RUN_AS_NODE: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      this.child = child;
      const startedAt = Date.now();
      log.info('Payment agent starting', { pid: child.pid });

      child.stdout?.on('data', (b: Buffer) => log.info(b.toString().trimEnd()));
      child.stderr?.on('data', (b: Buffer) => log.warn(b.toString().trimEnd()));

      child.on('error', (err) => log.error('Payment agent spawn error', err));

      child.on('exit', (code) => {
        this.child = null;
        if (this.stopped) {
          log.info('Payment agent stopped');
          return;
        }
        // Reset backoff if it had been running stably (not a boot-crash loop).
        if (Date.now() - startedAt > 20_000) this.backoffMs = RESTART_MIN_MS;
        log.warn('Payment agent exited; scheduling restart', { code, backoffMs: this.backoffMs });
        this.scheduleRestart();
      });
    } catch (error) {
      log.error('Failed to spawn payment agent; scheduling restart', error);
      this.scheduleRestart();
    }
  }

  private scheduleRestart(): void {
    if (this.stopped || this.restartTimer) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, RESTART_MAX_MS);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.start();
    }, delay);
    if (typeof this.restartTimer.unref === 'function') this.restartTimer.unref();
  }

  /** Stop the agent and cancel any pending restart (called on app quit). */
  stop(): void {
    this.stopped = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.child) {
      try {
        this.child.kill();
      } catch {
        /* already gone */
      }
      this.child = null;
    }
  }
}
