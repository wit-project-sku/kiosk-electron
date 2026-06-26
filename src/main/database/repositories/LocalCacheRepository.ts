import type { CachedContent } from '@shared/types/kiosk';
import { BaseRepository } from './BaseRepository';
import type { Database } from '../Database';
import { fromJson, toJson } from './serde';

interface CacheRow {
  cache_key: string;
  data: string;
  updated_at: string;
}

function toDomain(row: CacheRow): CachedContent {
  return {
    key: row.cache_key,
    data: fromJson<Record<string, unknown>>(row.data, {}),
    updatedAt: row.updated_at,
  };
}

/**
 * Local cache for synced remote content (e.g. Google Sheets rows).
 * Read at startup and during navigation — never fetched from network in UI.
 */
export class LocalCacheRepository extends BaseRepository {
  constructor(db: Database) {
    super(db);
  }

  get(key: string): CachedContent | null {
    const row = this.conn
      .prepare('SELECT cache_key, data, updated_at FROM local_cache WHERE cache_key = ?')
      .get(key) as CacheRow | undefined;
    return row ? toDomain(row) : null;
  }

  listAll(): CachedContent[] {
    const rows = this.conn
      .prepare('SELECT cache_key, data, updated_at FROM local_cache ORDER BY cache_key ASC')
      .all() as CacheRow[];
    return rows.map(toDomain);
  }

  upsert(key: string, data: Record<string, unknown>, source: string | null): CachedContent {
    const now = new Date().toISOString();
    this.conn
      .prepare(
        `INSERT INTO local_cache (cache_key, data, source, updated_at)
         VALUES (@key, @data, @source, @now)
         ON CONFLICT(cache_key) DO UPDATE SET
           data = excluded.data,
           source = excluded.source,
           updated_at = excluded.updated_at`,
      )
      .run({ key, data: toJson(data), source, now });
    return this.get(key)!;
  }

  delete(key: string): void {
    this.conn.prepare('DELETE FROM local_cache WHERE cache_key = ?').run(key);
  }
}
