import type { AnalyticsEvent, AnalyticsReport, CreateAnalyticsEvent } from '@shared/types/data';
import type { EntityId } from '@shared/types/domain';
import { BaseRepository } from './BaseRepository';
import type { Database } from '../Database';
import { fromJson, toJson } from './serde';

interface AnalyticsRow {
  id: number;
  name: string;
  payload: string | null;
  session_id: number | null;
  customer_id: number | null;
  sync_state: string;
  created_at: string;
}

function toDomain(row: AnalyticsRow): AnalyticsEvent {
  return {
    id: row.id,
    name: row.name,
    payload: row.payload ? fromJson<Record<string, unknown>>(row.payload, {}) : null,
    sessionId: row.session_id,
    customerId: row.customer_id,
    syncState: row.sync_state === 'synced' ? 'synced' : 'pending',
    createdAt: row.created_at,
  };
}

/**
 * Append-only analytics store. Events are inserted once and only ever updated to
 * flip `sync_state` to 'synced'. They are never mutated or deleted in normal
 * operation, preserving a complete, auditable event history for reporting.
 */
export class AnalyticsRepository extends BaseRepository {
  constructor(db: Database) {
    super(db);
  }

  create(input: CreateAnalyticsEvent): AnalyticsEvent {
    const result = this.conn
      .prepare(
        `INSERT INTO analytics_events (name, payload, session_id, customer_id, sync_state, created_at)
         VALUES (@name, @payload, @sessionId, @customerId, 'pending', @createdAt)`,
      )
      .run({
        name: input.name,
        payload: input.payload ? toJson(input.payload) : null,
        sessionId: input.sessionId ?? null,
        customerId: input.customerId ?? null,
        createdAt: new Date().toISOString(),
      });
    const row = this.conn
      .prepare('SELECT * FROM analytics_events WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as AnalyticsRow;
    return toDomain(row);
  }

  listPending(limit: number): AnalyticsEvent[] {
    const rows = this.conn
      .prepare(
        `SELECT * FROM analytics_events WHERE sync_state = 'pending'
         ORDER BY created_at ASC LIMIT ?`,
      )
      .all(limit) as AnalyticsRow[];
    return rows.map(toDomain);
  }

  markSynced(ids: EntityId[]): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    this.conn
      .prepare(`UPDATE analytics_events SET sync_state = 'synced' WHERE id IN (${placeholders})`)
      .run(...ids);
  }

  countPending(): number {
    return (
      this.conn
        .prepare(`SELECT COUNT(*) AS n FROM analytics_events WHERE sync_state = 'pending'`)
        .get() as { n: number }
    ).n;
  }

  /** Aggregate events into a report grouped by event name, within an optional range. */
  report(rangeStart: string | null, rangeEnd: string | null): AnalyticsReport {
    const clauses: string[] = [];
    const params: Record<string, string> = {};
    if (rangeStart) {
      clauses.push('created_at >= @start');
      params.start = rangeStart;
    }
    if (rangeEnd) {
      clauses.push('created_at <= @end');
      params.end = rangeEnd;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const total = (
      this.conn.prepare(`SELECT COUNT(*) AS n FROM analytics_events ${where}`).get(params) as {
        n: number;
      }
    ).n;

    const byName = this.conn
      .prepare(
        `SELECT name, COUNT(*) AS count FROM analytics_events ${where}
         GROUP BY name ORDER BY count DESC`,
      )
      .all(params) as { name: string; count: number }[];

    return { totalEvents: total, byName, rangeStart, rangeEnd };
  }

  /** Full export stream (newest first). */
  listAll(): AnalyticsEvent[] {
    const rows = this.conn
      .prepare('SELECT * FROM analytics_events ORDER BY created_at DESC')
      .all() as AnalyticsRow[];
    return rows.map(toDomain);
  }
}
