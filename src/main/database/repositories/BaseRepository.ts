import type { Database } from '../Database';

/**
 * Base class for all repositories.
 *
 * Repositories are the ONLY place raw SQL is allowed. They translate between
 * persistence rows (snake_case) and domain entities (camelCase), keeping SQL
 * out of services and the rest of the app. Prepared statements are created on
 * demand and cached by better-sqlite3 internally.
 */
export abstract class BaseRepository {
  protected constructor(protected readonly db: Database) {}

  protected get conn() {
    return this.db.conn;
  }
}
