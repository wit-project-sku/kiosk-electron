import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { createLogger } from '@main/core/logger';
import type { ArErrorKind, ArFailure, ShotType, ShotV2Data } from '@shared/types/data';
import { keepRecentLines, STALE_OPEN_MS, type ShotRow, type ShotState } from './plan';
import type { ShotLedger } from './ShotLedger';

const log = createLogger('shot-ledger');

const DB_FILE = 'shot-ledger.db';
const TEXT_FILE = 'shot-ledger.txt';

interface Row {
  event_id: string;
  kiosk_id: number;
  shot_at: string;
  is_success: number | null;
  shot_type: string | null;
  outfit_code: string;
  language: string | null;
  background_id: number | null;
  ar_error_kind: string | null;
  ar_error_status: number | null;
  ar_error_message: string | null;
  auto_shot: number | null;
  photo_path: string | null;
  v2_data: string | null;
  state: ShotState;
  v1_sent: number;
  attempts: number;
  last_error: string | null;
  next_attempt_at: number;
  created_at: number;
  sent_at: number | null;
}

/**
 * Columns added after the first 촬영 장부 (2026-11-12, AR 합성 실패 알림). A ledger
 * file written by an older build lacks them; they are added on open, empty, so
 * rows already in the file keep sending as before.
 */
const ADDED_COLUMNS: readonly (readonly [name: string, type: string])[] = [
  ['background_id', 'INTEGER'],
  ['ar_error_kind', 'TEXT'],
  ['ar_error_status', 'INTEGER'],
  ['ar_error_message', 'TEXT'],
  ['auto_shot', 'INTEGER'],
];

function arFailureOf(row: Row): ArFailure | null {
  if (!row.ar_error_kind) return null;
  return {
    kind: row.ar_error_kind as ArErrorKind,
    status: row.ar_error_status,
    message: row.ar_error_message,
  };
}

function toShot(row: Row): ShotRow {
  let v2Data: ShotV2Data | null = null;
  if (row.v2_data) {
    try {
      v2Data = JSON.parse(row.v2_data) as ShotV2Data;
    } catch {
      v2Data = null;
    }
  }
  return {
    eventId: row.event_id,
    kioskId: row.kiosk_id,
    shotAt: row.shot_at,
    isSuccess: row.is_success === null ? null : row.is_success === 1,
    shotType: row.shot_type as ShotType | null,
    outfitCode: row.outfit_code,
    language: row.language,
    backgroundId: row.background_id ?? null,
    arFailure: arFailureOf(row),
    autoShot: row.auto_shot === 1,
    photoPath: row.photo_path,
    v2Data,
    state: row.state,
    v1Sent: row.v1_sent === 1,
    attempts: row.attempts,
    lastError: row.last_error,
    nextAttemptAt: row.next_attempt_at,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

/**
 * 촬영 장부 on disk — `shot-ledger.db` (the ledger the app sends from) and
 * `shot-ledger.txt` (the same events as readable lines), both next to main.log
 * so whoever collects the logs gets the day's shots with them.
 *
 * `due()` repeats plan.isDue in SQL — change them together.
 *
 * Its own SQLite file rather than a table in kiosk.db: the ledger must stay
 * readable on its own, and a problem in the app database must not take the
 * record of what was shot with it.
 */
export class SqliteShotLedger implements ShotLedger {
  private readonly db: BetterSqlite3.Database;
  private readonly textPath: string;

  constructor(dir: string) {
    this.textPath = join(dir, TEXT_FILE);
    this.db = new BetterSqlite3(join(dir, DB_FILE));
    // Rollback journal, not WAL: every commit lands in the .db itself, so copying
    // that one file with the logs always has the latest shots.
    this.db.pragma('journal_mode = DELETE');
    this.db.pragma('synchronous = FULL');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shots (
        event_id        TEXT PRIMARY KEY,
        kiosk_id        INTEGER NOT NULL,
        shot_at         TEXT NOT NULL,
        is_success      INTEGER,
        shot_type       TEXT,
        outfit_code     TEXT NOT NULL,
        language        TEXT,
        photo_path      TEXT,
        v2_data         TEXT,
        state           TEXT NOT NULL,
        v1_sent         INTEGER NOT NULL DEFAULT 0,
        attempts        INTEGER NOT NULL DEFAULT 0,
        last_error      TEXT,
        next_attempt_at INTEGER NOT NULL DEFAULT 0,
        created_at      INTEGER NOT NULL,
        sent_at         INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_shots_state ON shots (state, next_attempt_at);
    `);
    const existing = new Set(
      (this.db.prepare('PRAGMA table_info(shots)').all() as { name: string }[]).map((c) => c.name),
    );
    for (const [name, type] of ADDED_COLUMNS) {
      if (!existing.has(name)) this.db.exec(`ALTER TABLE shots ADD COLUMN ${name} ${type}`);
    }
  }

  get(eventId: string): ShotRow | null {
    const row = this.db.prepare('SELECT * FROM shots WHERE event_id = ?').get(eventId) as
      | Row
      | undefined;
    return row ? toShot(row) : null;
  }

  save(row: ShotRow): void {
    // Named parameters must match the SQL exactly — the failure goes in as its three columns.
    const { arFailure, ...fields } = row;
    this.db
      .prepare(
        `INSERT OR REPLACE INTO shots (
           event_id, kiosk_id, shot_at, is_success, shot_type, outfit_code, language,
           background_id, ar_error_kind, ar_error_status, ar_error_message, auto_shot, photo_path,
           v2_data, state, v1_sent, attempts, last_error, next_attempt_at, created_at, sent_at
         ) VALUES (
           @eventId, @kioskId, @shotAt, @isSuccess, @shotType, @outfitCode, @language,
           @backgroundId, @arErrorKind, @arErrorStatus, @arErrorMessage, @autoShot, @photoPath,
           @v2Data, @state, @v1Sent, @attempts, @lastError, @nextAttemptAt, @createdAt, @sentAt
         )`,
      )
      .run({
        ...fields,
        arErrorKind: arFailure?.kind ?? null,
        arErrorStatus: arFailure?.status ?? null,
        arErrorMessage: arFailure?.message ?? null,
        autoShot: row.autoShot ? 1 : 0,
        isSuccess: row.isSuccess === null ? null : row.isSuccess ? 1 : 0,
        v2Data: row.v2Data ? JSON.stringify(row.v2Data) : null,
        v1Sent: row.v1Sent ? 1 : 0,
      });
  }

  due(now: number, limit: number): ShotRow[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM shots
          WHERE (state IN ('pending', 'rejected') AND next_attempt_at <= @now)
             OR (state = 'open' AND created_at <= @staleBefore)
          ORDER BY attempts, created_at
          LIMIT @limit`,
      )
      .all({ now, staleBefore: now - STALE_OPEN_MS, limit }) as Row[];
    return rows.map(toShot);
  }

  countSince(since: number): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM shots WHERE created_at >= ?')
      .get(since) as {
      n: number;
    };
    return row.n;
  }

  pruneSent(before: number): number {
    return this.db.prepare("DELETE FROM shots WHERE state = 'sent' AND sent_at < ?").run(before)
      .changes;
  }

  unsent(): { open: number; pending: number; rejected: number } {
    const count = { open: 0, pending: 0, rejected: 0 };
    const rows = this.db
      .prepare("SELECT state, COUNT(*) AS n FROM shots WHERE state <> 'sent' GROUP BY state")
      .all() as { state: 'open' | 'pending' | 'rejected'; n: number }[];
    for (const { state, n } of rows) count[state] = n;
    return count;
  }

  note(line: string): void {
    try {
      appendFileSync(this.textPath, `${line}\n`, 'utf8');
    } catch (error) {
      log.warn('Could not write the text ledger', error);
    }
  }

  pruneNotes(now: number, keepMs: number): void {
    try {
      if (!existsSync(this.textPath)) return;
      const lines = readFileSync(this.textPath, 'utf8').split('\n').filter(Boolean);
      const kept = keepRecentLines(lines, now, keepMs);
      if (kept.length === lines.length) return;
      writeFileSync(this.textPath, kept.length > 0 ? `${kept.join('\n')}\n` : '', 'utf8');
    } catch (error) {
      log.warn('Could not prune the text ledger', error);
    }
  }

  close(): void {
    this.db.close();
  }
}
