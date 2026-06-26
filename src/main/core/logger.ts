/**
 * Structured logging built on electron-log.
 *
 * A single configured logger instance is exported and reused everywhere in the
 * main process. Scoped child loggers (`logger.scope('database')`) tag each line
 * with its subsystem, which makes production log triage tractable.
 */

import log from 'electron-log/main';
import { app } from 'electron';

let initialized = false;

/**
 * Configure file + console transports. Must be called once, early in startup,
 * before any other module logs.
 */
export function initLogger(): void {
  if (initialized) return;
  initialized = true;

  // Route renderer console output and uncaught errors through electron-log.
  log.initialize();

  log.transports.file.level = app.isPackaged ? 'info' : 'debug';
  log.transports.console.level = app.isPackaged ? 'warn' : 'debug';

  log.transports.file.maxSize = 10 * 1024 * 1024; // 10 MB rotation.
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {scope} {text}';

  // Capture anything that would otherwise crash the process silently.
  log.errorHandler.startCatching({ showDialog: false });

  log.info('Logger initialized', {
    packaged: app.isPackaged,
    version: app.getVersion(),
  });
}

export type ScopedLogger = ReturnType<typeof log.scope>;

/** Create a subsystem-scoped logger. */
export function createLogger(scope: string): ScopedLogger {
  return log.scope(scope);
}

export const logger = log;
