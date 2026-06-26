import type { EntityId } from '@shared/types/domain';
import { BaseRepository } from './BaseRepository';
import type { Database } from '../Database';
import { fromJson, toJson } from './serde';

export interface FailedRequest {
  readonly id: EntityId;
  requestId: string;
  type: string;
  payload: Record<string, unknown>;
  error: string | null;
  retryCount: number;
  readonly createdAt: string;
  updatedAt: string;
}

export interface CreateFailedRequestInput {
  requestId: string;
  type: string;
  payload: Record<string, unknown>;
  error: string | null;
}

interface FailedRow {
  id: number;
  request_id: string;
  type: string;
  payload: string;
  error: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

function toDomain(row: FailedRow): FailedRequest {
  return {
    id: row.id,
    requestId: row.request_id,
    type: row.type,
    payload: fromJson<Record<string, unknown>>(row.payload, {}),
    error: row.error,
    retryCount: row.retry_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Durable store for failed remote operations. Nothing is discarded — every
 * failure is recorded for night-sync retry.
 */
export class FailedRequestRepository extends BaseRepository {
  constructor(db: Database) {
    super(db);
  }

  create(input: CreateFailedRequestInput): FailedRequest {
    const now = new Date().toISOString();
    const result = this.conn
      .prepare(
        `INSERT INTO failed_requests (request_id, type, payload, error, retry_count, created_at, updated_at)
         VALUES (@requestId, @type, @payload, @error, 0, @now, @now)
         ON CONFLICT(request_id) DO UPDATE SET
           error = excluded.error,
           retry_count = retry_count + 1,
           updated_at = excluded.updated_at`,
      )
      .run({
        requestId: input.requestId,
        type: input.type,
        payload: toJson(input.payload),
        error: input.error,
        now,
      });

    const id =
      result.changes > 0
        ? Number(result.lastInsertRowid) ||
          (this.conn
            .prepare('SELECT id FROM failed_requests WHERE request_id = ?')
            .get(input.requestId) as { id: number }).id
        : 0;

    return this.findById(id)!;
  }

  findById(id: EntityId): FailedRequest | null {
    const row = this.conn.prepare('SELECT * FROM failed_requests WHERE id = ?').get(id) as
      | FailedRow
      | undefined;
    return row ? toDomain(row) : null;
  }

  listRetryable(limit: number): FailedRequest[] {
    const rows = this.conn
      .prepare(
        `SELECT * FROM failed_requests
         ORDER BY retry_count ASC, created_at ASC LIMIT ?`,
      )
      .all(limit) as FailedRow[];
    return rows.map(toDomain);
  }

  listByType(type: string, limit: number): FailedRequest[] {
    const rows = this.conn
      .prepare(
        `SELECT * FROM failed_requests
         WHERE type = ?
         ORDER BY retry_count ASC, created_at ASC LIMIT ?`,
      )
      .all(type, limit) as FailedRow[];
    return rows.map(toDomain);
  }

  incrementRetry(id: EntityId, error: string | null): void {
    const now = new Date().toISOString();
    this.conn
      .prepare(
        `UPDATE failed_requests
         SET retry_count = retry_count + 1, error = @error, updated_at = @now
         WHERE id = @id`,
      )
      .run({ id, error, now });
  }

  delete(id: EntityId): void {
    this.conn.prepare('DELETE FROM failed_requests WHERE id = ?').run(id);
  }

  count(): number {
    return (this.conn.prepare('SELECT COUNT(*) AS n FROM failed_requests').get() as { n: number })
      .n;
  }
}
