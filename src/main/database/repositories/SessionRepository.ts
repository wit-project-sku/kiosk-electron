import type { Session, SessionStatus } from '@shared/types/data';
import type { EntityId } from '@shared/types/domain';
import { BaseRepository } from './BaseRepository';
import type { Database } from '../Database';
import { fromJson, toJson } from './serde';

interface SessionRow {
  id: number;
  customer_id: number | null;
  status: string;
  metadata: string | null;
  started_at: string;
  ended_at: string | null;
}

function toDomain(row: SessionRow): Session {
  return {
    id: row.id,
    customerId: row.customer_id,
    status: row.status as SessionStatus,
    metadata: row.metadata ? fromJson<Record<string, unknown>>(row.metadata, {}) : null,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

export class SessionRepository extends BaseRepository {
  constructor(db: Database) {
    super(db);
  }

  findById(id: EntityId): Session | null {
    const row = this.conn.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
      | SessionRow
      | undefined;
    return row ? toDomain(row) : null;
  }

  start(customerId: EntityId | null, metadata: Record<string, unknown> | null): Session {
    const result = this.conn
      .prepare(
        `INSERT INTO sessions (customer_id, status, metadata, started_at)
         VALUES (@customerId, 'active', @metadata, @startedAt)`,
      )
      .run({
        customerId,
        metadata: metadata ? toJson(metadata) : null,
        startedAt: new Date().toISOString(),
      });
    return this.findById(Number(result.lastInsertRowid))!;
  }

  end(id: EntityId, status: SessionStatus): Session | null {
    const existing = this.findById(id);
    if (!existing) return null;
    this.conn
      .prepare('UPDATE sessions SET status = @status, ended_at = @endedAt WHERE id = @id')
      .run({ id, status, endedAt: new Date().toISOString() });
    return this.findById(id);
  }

  listRecent(limit: number): Session[] {
    const rows = this.conn
      .prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?')
      .all(limit) as SessionRow[];
    return rows.map(toDomain);
  }
}
