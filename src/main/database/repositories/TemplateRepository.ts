import type { Template } from '@shared/types/data';
import { BaseRepository } from './BaseRepository';
import type { Database } from '../Database';
import { fromJson, toJson } from './serde';

interface TemplateRow {
  id: number;
  key: string;
  name: string;
  content: string;
  enabled: number;
  updated_at: string;
}

function toDomain(row: TemplateRow): Template {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    content: fromJson<Record<string, unknown>>(row.content, {}),
    enabled: row.enabled === 1,
    updatedAt: row.updated_at,
  };
}

/**
 * Templates are rarely-changing configuration loaded into memory at startup.
 * They are read far more often than written, so the renderer caches them in a
 * dedicated store and only re-reads on explicit changes.
 */
export class TemplateRepository extends BaseRepository {
  constructor(db: Database) {
    super(db);
  }

  list(): Template[] {
    const rows = this.conn
      .prepare('SELECT * FROM templates ORDER BY name COLLATE NOCASE')
      .all() as TemplateRow[];
    return rows.map(toDomain);
  }

  findByKey(key: string): Template | null {
    const row = this.conn.prepare('SELECT * FROM templates WHERE key = ?').get(key) as
      | TemplateRow
      | undefined;
    return row ? toDomain(row) : null;
  }

  upsert(template: Pick<Template, 'key' | 'name' | 'content' | 'enabled'>): Template {
    this.conn
      .prepare(
        `INSERT INTO templates (key, name, content, enabled, updated_at)
         VALUES (@key, @name, @content, @enabled, @updatedAt)
         ON CONFLICT(key) DO UPDATE SET
           name = excluded.name,
           content = excluded.content,
           enabled = excluded.enabled,
           updated_at = excluded.updated_at`,
      )
      .run({
        key: template.key,
        name: template.name,
        content: toJson(template.content),
        enabled: template.enabled ? 1 : 0,
        updatedAt: new Date().toISOString(),
      });
    return this.findByKey(template.key)!;
  }

  count(): number {
    return (this.conn.prepare('SELECT COUNT(*) AS n FROM templates').get() as { n: number }).n;
  }
}
