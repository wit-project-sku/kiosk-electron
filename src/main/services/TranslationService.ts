import type { SupportedLanguage } from '@shared/types/kiosk';
import type { TranslationRepository } from '@main/database/repositories/TranslationRepository';

export type TranslationMap = {
  [key: string]: Partial<Record<SupportedLanguage, string>>;
};

/**
 * Translation facade. Loads from SQLite at startup and provides in-memory access.
 * Updated during night sync by GoogleSheetsSyncTransport.
 */
export class TranslationService {
  private map: TranslationMap = {};

  constructor(private readonly repo: TranslationRepository) {}

  /**
   * Load all translations for a language into memory.
   * Called at startup from bootstrap.
   */
  load(language: SupportedLanguage): void {
    const entries = this.repo.listByLanguage(language);
    for (const [key, text] of Object.entries(entries)) {
      if (!this.map[key]) {
        this.map[key] = {};
      }
      this.map[key][language] = text;
    }
  }

  /**
   * Load all available languages at once.
   * Called at startup to fully hydrate the in-memory map.
   */
  loadAll(): void {
    const languages = this.repo.getAvailableLanguages();
    for (const lang of languages) {
      this.load(lang);
    }
  }

  /**
   * Replace all translations for a language (called by sync).
   */
  replaceLanguage(language: SupportedLanguage, entries: Record<string, string>): void {
    // Clear old entries
    this.repo.deleteLanguage(language);
    // Insert batch
    const batch = Object.entries(entries).map(([key, text]) => ({ key, language, text }));
    this.repo.upsertBatch(batch);
    // Update in-memory map
    for (const [key, text] of Object.entries(entries)) {
      if (!this.map[key]) {
        this.map[key] = {};
      }
      this.map[key][language] = text;
    }
  }

  /** Drop all cached translations (e.g. when the kiosk's location changed) so a
   *  previous location's strings can't survive into the new one. */
  clearAll(): void {
    this.repo.deleteAll();
    this.map = {};
  }

  getInMemoryMap(): TranslationMap {
    return this.map;
  }
}
