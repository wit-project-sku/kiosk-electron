import type { FootfallBucket } from '@shared/types/footfall';
import { BaseRepository } from './BaseRepository';
import type { Database } from '../Database';

interface FootfallRow {
  id: number;
  kiosk_id: string;
  bucket_start: string;
  local_date: string;
  hour: number;
  in_count: number;
  out_count: number;
  total_count: number;
  active_seconds: number;
  sync_state: string;
  synced_at: string | null;
  updated_at: string;
  created_at: string;
}

function toDomain(row: FootfallRow): FootfallBucket {
  return {
    kioskId: row.kiosk_id,
    bucketStart: row.bucket_start,
    localDate: row.local_date,
    hour: row.hour,
    inCount: row.in_count,
    outCount: row.out_count,
    totalCount: row.total_count,
    activeSeconds: row.active_seconds,
  };
}

/** One accumulating delta for a single hour bucket. */
export interface FootfallDelta {
  kioskId: string;
  bucketStart: string;
  localDate: string;
  hour: number;
  inCount: number;
  outCount: number;
  activeSeconds: number;
}

/**
 * Hourly 유동인구 counts.
 *
 * Every write is additive. `add()` never overwrites a total, it increments one,
 * which is what makes the flush loop safe to run at any interval and safe to
 * repeat after a crash. The only non-additive column is `sync_state`, and even
 * that flips BACK to 'pending' on every add — an hour that gains a visitor after
 * it was uploaded is an hour the backend has a stale number for, so it must be
 * sent again. The server side of that contract is an upsert keyed on
 * (kioskId, bucketStart); see FootfallUploader.
 */
export class FootfallRepository extends BaseRepository {
  constructor(db: Database) {
    super(db);
  }

  /**
   * Add one interval's counts to its hour bucket, creating the row if this is
   * the hour's first crossing. Returns nothing — callers that need the running
   * total read it back through `day()`.
   */
  add(delta: FootfallDelta): void {
    const now = new Date().toISOString();
    this.conn
      .prepare(
        `INSERT INTO footfall_buckets
           (kiosk_id, bucket_start, local_date, hour,
            in_count, out_count, total_count, active_seconds,
            sync_state, updated_at, created_at)
         VALUES
           (@kioskId, @bucketStart, @localDate, @hour,
            @inCount, @outCount, @totalCount, @activeSeconds,
            'pending', @now, @now)
         ON CONFLICT(kiosk_id, bucket_start) DO UPDATE SET
           in_count       = in_count + excluded.in_count,
           out_count      = out_count + excluded.out_count,
           total_count    = total_count + excluded.total_count,
           active_seconds = active_seconds + excluded.active_seconds,
           sync_state     = 'pending',
           updated_at     = excluded.updated_at`,
      )
      .run({
        kioskId: delta.kioskId,
        bucketStart: delta.bucketStart,
        localDate: delta.localDate,
        hour: delta.hour,
        inCount: delta.inCount,
        outCount: delta.outCount,
        totalCount: delta.inCount + delta.outCount,
        activeSeconds: Math.round(delta.activeSeconds),
        now,
      });
  }

  /** Apply many deltas in one transaction (the flush path). */
  addMany(deltas: FootfallDelta[]): void {
    if (deltas.length === 0) return;
    this.db.transaction(() => {
      for (const delta of deltas) this.add(delta);
    });
  }

  /** Buckets the backend has not acknowledged, oldest first. */
  listPending(limit: number): FootfallBucket[] {
    const rows = this.conn
      .prepare(
        `SELECT * FROM footfall_buckets WHERE sync_state = 'pending'
         ORDER BY bucket_start ASC LIMIT ?`,
      )
      .all(limit) as FootfallRow[];
    return rows.map(toDomain);
  }

  countPending(): number {
    return (
      this.conn
        .prepare(`SELECT COUNT(*) AS n FROM footfall_buckets WHERE sync_state = 'pending'`)
        .get() as { n: number }
    ).n;
  }

  /**
   * Mark buckets uploaded.
   *
   * Guarded on `updated_at`: if a crossing landed in one of these hours WHILE
   * the upload was in flight, its row was touched after the batch was read and
   * must stay pending rather than have the newer count silently marked as sent.
   */
  markSynced(buckets: { kioskId: string; bucketStart: string; updatedAtBefore: string }[]): void {
    if (buckets.length === 0) return;
    const now = new Date().toISOString();
    const statement = this.conn.prepare(
      `UPDATE footfall_buckets
          SET sync_state = 'synced', synced_at = @now
        WHERE kiosk_id = @kioskId AND bucket_start = @bucketStart
          AND updated_at <= @updatedAtBefore`,
    );
    this.db.transaction(() => {
      for (const bucket of buckets) {
        statement.run({
          now,
          kioskId: bucket.kioskId,
          bucketStart: bucket.bucketStart,
          updatedAtBefore: bucket.updatedAtBefore,
        });
      }
    });
  }

  /** `updated_at` for a pending batch, so markSynced can detect a late write. */
  updatedAtFor(kioskId: string, bucketStart: string): string | null {
    const row = this.conn
      .prepare('SELECT updated_at FROM footfall_buckets WHERE kiosk_id = ? AND bucket_start = ?')
      .get(kioskId, bucketStart) as { updated_at: string } | undefined;
    return row?.updated_at ?? null;
  }

  /** Every bucket for one local date, ascending by hour. */
  day(kioskId: string, localDate: string): FootfallBucket[] {
    const rows = this.conn
      .prepare(
        `SELECT * FROM footfall_buckets WHERE kiosk_id = ? AND local_date = ?
         ORDER BY hour ASC`,
      )
      .all(kioskId, localDate) as FootfallRow[];
    return rows.map(toDomain);
  }

  /** Drop synced buckets older than `cutoffDate` (`YYYY-MM-DD`). Returns rows removed. */
  pruneSyncedBefore(cutoffDate: string): number {
    const result = this.conn
      .prepare(`DELETE FROM footfall_buckets WHERE sync_state = 'synced' AND local_date < ?`)
      .run(cutoffDate);
    return result.changes;
  }
}
