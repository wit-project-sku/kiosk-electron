import type { SyncJob, SyncJobStatus, SyncJobType, SyncQueueStats } from '@shared/types/data';
import type { EntityId } from '@shared/types/domain';
import { BaseRepository } from './BaseRepository';
import type { Database } from '../Database';
import { fromJson, toJson } from './serde';

interface SyncRow {
  id: number;
  type: string;
  payload: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_attempt_at: string;
  created_at: string;
  updated_at: string;
}

function toDomain(row: SyncRow): SyncJob {
  return {
    id: row.id,
    type: row.type,
    payload: fromJson<Record<string, unknown>>(row.payload, {}),
    status: row.status as SyncJobStatus,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lastError: row.last_error,
    nextAttemptAt: row.next_attempt_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Durable, crash-safe job queue. Every remote operation becomes a row here
 * first, so work survives network failures, crashes, restarts, and power loss.
 * Failed jobs are retained (never silently dropped) for inspection and retry.
 */
export class SyncQueueRepository extends BaseRepository {
  constructor(db: Database) {
    super(db);
  }

  enqueue(type: SyncJobType, payload: Record<string, unknown>, maxAttempts = 10): SyncJob {
    const now = new Date().toISOString();
    const result = this.conn
      .prepare(
        `INSERT INTO sync_queue (type, payload, status, attempts, max_attempts, next_attempt_at, created_at, updated_at)
         VALUES (@type, @payload, 'pending', 0, @maxAttempts, @now, @now, @now)`,
      )
      .run({ type, payload: toJson(payload), maxAttempts, now });
    return this.findById(Number(result.lastInsertRowid))!;
  }

  findById(id: EntityId): SyncJob | null {
    const row = this.conn.prepare('SELECT * FROM sync_queue WHERE id = ?').get(id) as
      | SyncRow
      | undefined;
    return row ? toDomain(row) : null;
  }

  /**
   * Atomically claim the next due pending job and mark it 'processing'. The
   * SELECT+UPDATE run in a transaction so concurrent workers can never grab the
   * same job twice.
   */
  claimNext(now: string): SyncJob | null {
    return this.db.transaction(() => {
      const row = this.conn
        .prepare(
          `SELECT * FROM sync_queue
           WHERE status = 'pending' AND next_attempt_at <= ?
           ORDER BY next_attempt_at ASC LIMIT 1`,
        )
        .get(now) as SyncRow | undefined;
      if (!row) return null;

      this.conn
        .prepare(`UPDATE sync_queue SET status = 'processing', updated_at = ? WHERE id = ?`)
        .run(now, row.id);

      return toDomain({ ...row, status: 'processing' });
    });
  }

  markCompleted(id: EntityId): void {
    this.conn
      .prepare(`UPDATE sync_queue SET status = 'completed', updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), id);
  }

  /**
   * Record a failed attempt. If attempts remain, the job is re-queued with a
   * backoff (`nextAttemptAt`); once exhausted it is parked in 'failed' state.
   */
  markFailed(id: EntityId, error: string, nextAttemptAt: string): void {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      const job = this.findById(id);
      if (!job) return;
      const attempts = job.attempts + 1;
      const exhausted = attempts >= job.maxAttempts;
      this.conn
        .prepare(
          `UPDATE sync_queue
           SET attempts = @attempts,
               status = @status,
               last_error = @error,
               next_attempt_at = @nextAttemptAt,
               updated_at = @now
           WHERE id = @id`,
        )
        .run({
          id,
          attempts,
          status: exhausted ? 'failed' : 'pending',
          error,
          nextAttemptAt,
          now,
        });
    });
  }

  /** Move a permanently-failed job back to pending for a manual retry. */
  retry(id: EntityId): SyncJob | null {
    const now = new Date().toISOString();
    this.conn
      .prepare(
        `UPDATE sync_queue
         SET status = 'pending', attempts = 0, last_error = NULL, next_attempt_at = @now, updated_at = @now
         WHERE id = @id`,
      )
      .run({ id, now });
    return this.findById(id);
  }

  /**
   * Reset jobs stuck in 'processing' (a crash mid-flight) back to 'pending' so
   * they are retried on the next worker tick. Run once at startup.
   */
  recoverInterrupted(): number {
    const now = new Date().toISOString();
    return this.conn
      .prepare(
        `UPDATE sync_queue SET status = 'pending', updated_at = ? WHERE status = 'processing'`,
      )
      .run(now).changes;
  }

  stats(): SyncQueueStats {
    const rows = this.conn
      .prepare('SELECT status, COUNT(*) AS n FROM sync_queue GROUP BY status')
      .all() as { status: string; n: number }[];
    const stats: SyncQueueStats = { pending: 0, processing: 0, completed: 0, failed: 0 };
    for (const row of rows) {
      if (row.status in stats) stats[row.status as keyof SyncQueueStats] = row.n;
    }
    return stats;
  }

  listByStatus(status: SyncJobStatus, limit = 100): SyncJob[] {
    const rows = this.conn
      .prepare('SELECT * FROM sync_queue WHERE status = ? ORDER BY updated_at DESC LIMIT ?')
      .all(status, limit) as SyncRow[];
    return rows.map(toDomain);
  }
}
