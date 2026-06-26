import type { CachedContent } from '@shared/types/kiosk';
import type { LocalCacheRepository } from '@main/database/repositories/LocalCacheRepository';

/**
 * Read/write facade for synced content cache. UI reads from here at startup
 * and after night sync — never from Google Sheets directly.
 */
export class LocalCacheService {
  constructor(private readonly repo: LocalCacheRepository) {}

  get(key: string): CachedContent | null {
    return this.repo.get(key);
  }

  listAll(): CachedContent[] {
    return this.repo.listAll();
  }

  upsert(key: string, data: Record<string, unknown>, source: string | null): CachedContent {
    return this.repo.upsert(key, data, source);
  }
}
