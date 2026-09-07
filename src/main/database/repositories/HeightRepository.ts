import type { HeightRecord } from '@shared/types/height';
import { BaseRepository } from './BaseRepository';
import type { Database } from '../Database';

interface HeightRow {
  id: number;
  kiosk_id: string;
  measured_at: string;
  local_date: string;
  hour: number;
  height_cm: number | null;
  confidence: number;
  samples: number;
  subjects: number;
  reason: string | null;
  created_at: string;
}

function toDomain(row: HeightRow): HeightRecord {
  return {
    kioskId: row.kiosk_id,
    measuredAt: row.measured_at,
    localDate: row.local_date,
    hour: row.hour,
    heightCm: row.height_cm,
    confidence: row.confidence,
    samples: row.samples,
    subjects: row.subjects,
    reason: row.reason,
  };
}

/**
 * 키 측정 rows — anonymous by construction. See migration 008 for why there is
 * no session id here and why adding one is a bigger change than it looks.
 *
 * Insert-only. Nothing updates a measurement: a capture happened, it produced a
 * number or it did not, and that is the end of the row's life until retention
 * sweeps it.
 */
export class HeightRepository extends BaseRepository {
  constructor(db: Database) {
    super(db);
  }

  insert(record: HeightRecord): void {
    this.conn
      .prepare(
        `INSERT INTO height_measurements
           (kiosk_id, measured_at, local_date, hour, height_cm,
            confidence, samples, subjects, reason, created_at)
         VALUES (@kioskId, @measuredAt, @localDate, @hour, @heightCm,
                 @confidence, @samples, @subjects, @reason, @createdAt)`,
      )
      .run({ ...record, createdAt: new Date().toISOString() });
  }

  /** Every measurement for one local date, oldest first. */
  day(localDate: string): HeightRecord[] {
    const rows = this.conn
      .prepare(
        `SELECT * FROM height_measurements
          WHERE local_date = ?
          ORDER BY measured_at ASC`,
      )
      .all(localDate) as HeightRow[];
    return rows.map(toDomain);
  }

  /**
   * Delete measurements older than `cutoff` (a local `YYYY-MM-DD`).
   *
   * Row-per-capture rather than 유동인구's row-per-hour, so this matters more
   * here than it does there — though at a few hundred captures a day it is a
   * housekeeping measure, not a disk-pressure one.
   */
  pruneBefore(cutoffLocalDate: string): number {
    const result = this.conn
      .prepare('DELETE FROM height_measurements WHERE local_date < ?')
      .run(cutoffLocalDate);
    return result.changes;
  }
}
