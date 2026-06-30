import type { SupportedLanguage } from '@shared/types/kiosk';
import { BaseRepository } from './BaseRepository';
import type { Database } from '../Database';

interface TranslationRow {
  key: string;
  language: SupportedLanguage;
  text: string;
  last_synced: string | null;
}

/**
 * Translation storage for multi-language kiosk UI.
 * Downloaded during night sync from Google Sheets translations tab.
 */
export class TranslationRepository extends BaseRepository {
  constructor(db: Database) {
    super(db);
  }

  get(key: string, language: SupportedLanguage): string | null {
    const row = this.conn
      .prepare('SELECT text FROM translations WHERE key = ? AND language = ?')
      .get(key, language) as { text: string } | undefined;
    return row?.text ?? null;
  }

  listByLanguage(language: SupportedLanguage): Record<string, string> {
    const rows = this.conn
      .prepare('SELECT key, text FROM translations WHERE language = ? ORDER BY key ASC')
      .all(language) as TranslationRow[];
    return Object.fromEntries(rows.map((r) => [r.key, r.text]));
  }

  upsert(key: string, language: SupportedLanguage, text: string): void {
    const now = new Date().toISOString();
    this.conn
      .prepare(
        `INSERT INTO translations (key, language, text, last_synced, created_at)
         VALUES (@key, @language, @text, @now, @now)
         ON CONFLICT(key, language) DO UPDATE SET
           text = excluded.text,
           last_synced = excluded.last_synced`,
      )
      .run({ key, language, text, now });
  }

  upsertBatch(entries: Array<{ key: string; language: SupportedLanguage; text: string }>): void {
    const transaction = this.conn.transaction(() => {
      for (const entry of entries) {
        this.upsert(entry.key, entry.language, entry.text);
      }
    });
    transaction();
  }

  deleteLanguage(language: SupportedLanguage): number {
    const stmt = this.conn.prepare('DELETE FROM translations WHERE language = ?');
    const result = stmt.run(language);
    return (result.changes || 0) as number;
  }

  /** Wipe every translation (used when the kiosk's location/layout changes, so
   *  another location's cached strings can't linger). */
  deleteAll(): number {
    const result = this.conn.prepare('DELETE FROM translations').run();
    return (result.changes || 0) as number;
  }

  getAvailableLanguages(): SupportedLanguage[] {
    const rows = this.conn
      .prepare('SELECT DISTINCT language FROM translations ORDER BY language ASC')
      .all() as Array<{ language: SupportedLanguage }>;
    return rows.map((r) => r.language);
  }
}
