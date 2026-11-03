import type { ArchiveRecord, ArchiveState } from '@main/services/photoArchive/plan';
import type { PhotoArchiveStore } from '@main/services/photoArchive/PhotoArchiveService';
import { BaseRepository } from './BaseRepository';
import type { Database } from '../Database';

interface PhotoArchiveRow {
  file_name: string;
  state: ArchiveState;
  with_result: number;
  attempts: number;
}

const ENABLED_SINCE_KEY = 'enabled_since';

/** SQLite side of PhotoArchiveService (tables from migration 011). */
export class PhotoArchiveRepository extends BaseRepository implements PhotoArchiveStore {
  constructor(db: Database) {
    super(db);
  }

  enabledSince(): number | null {
    const row = this.conn
      .prepare('SELECT value FROM photo_archive_meta WHERE key = ?')
      .get(ENABLED_SINCE_KEY) as { value: string } | undefined;
    const value = Number(row?.value);
    return row && Number.isFinite(value) ? value : null;
  }

  /** Stores `now` only the first time; returns whatever is stored. */
  markEnabledSince(now: number): number {
    this.conn
      .prepare('INSERT OR IGNORE INTO photo_archive_meta (key, value) VALUES (?, ?)')
      .run(ENABLED_SINCE_KEY, String(now));
    return this.enabledSince() ?? now;
  }

  records(): Map<string, ArchiveRecord> {
    const rows = this.conn
      .prepare('SELECT file_name, state, with_result, attempts FROM photo_archive_files')
      .all() as PhotoArchiveRow[];
    const out = new Map<string, ArchiveRecord>();
    for (const row of rows) {
      out.set(row.file_name, {
        fileName: row.file_name,
        state: row.state,
        withResult: row.with_result === 1,
        attempts: row.attempts,
      });
    }
    return out;
  }

  markSent(fileName: string, withResult: boolean): void {
    const now = new Date().toISOString();
    this.conn
      .prepare(
        `INSERT INTO photo_archive_files
           (file_name, state, with_result, attempts, last_status, last_error,
            sent_at, updated_at, created_at)
         VALUES (@fileName, 'sent', @withResult, 1, 200, NULL, @now, @now, @now)
         ON CONFLICT(file_name) DO UPDATE SET
           state       = 'sent',
           with_result = MAX(with_result, excluded.with_result),
           attempts    = attempts + 1,
           last_status = 200,
           last_error  = NULL,
           sent_at     = excluded.sent_at,
           updated_at  = excluded.updated_at`,
      )
      .run({ fileName, withResult: withResult ? 1 : 0, now });
  }

  markGivenUp(fileName: string, status: number, error: string): void {
    this.upsertState(fileName, 'given_up', status, error);
  }

  markFailed(fileName: string, status: number | null, error: string): void {
    this.upsertState(fileName, 'pending', status, error);
  }

  /**
   * A retryable failure on a file already sent without its composite (the
   * re-send with the composite failed) keeps it `sent`, so it is tried again.
   * `given_up` always wins: a rejected re-send must not be retried forever, and
   * `sent_at` still shows that the original itself got through.
   */
  private upsertState(
    fileName: string,
    state: 'pending' | 'given_up',
    status: number | null,
    error: string,
  ): void {
    const now = new Date().toISOString();
    this.conn
      .prepare(
        `INSERT INTO photo_archive_files
           (file_name, state, with_result, attempts, last_status, last_error,
            updated_at, created_at)
         VALUES (@fileName, @state, 0, 1, @status, @error, @now, @now)
         ON CONFLICT(file_name) DO UPDATE SET
           state       = CASE WHEN excluded.state = 'pending' AND state = 'sent' THEN 'sent'
                              ELSE excluded.state END,
           attempts    = attempts + 1,
           last_status = excluded.last_status,
           last_error  = excluded.last_error,
           updated_at  = excluded.updated_at`,
      )
      .run({ fileName, state, status, error: error.slice(0, 500), now });
  }
}
