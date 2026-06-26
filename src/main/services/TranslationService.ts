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
   * Get a translation. Fallback chain: requested lang → Korean → key itself.
   */
  get(key: string, language: SupportedLanguage, fallbackLang: SupportedLanguage = 'ko'): string {
    // Try requested language
    if (this.map[key]?.[language]) {
      return this.map[key][language]!;
    }
    // Try fallback (Korean)
    if (this.map[key]?.[fallbackLang]) {
      return this.map[key][fallbackLang]!;
    }
    // Return the key itself (visible but functional)
    return key;
  }

  /**
   * Get all translations for a language (used by bootstrap).
   */
  getAllForLanguage(language: SupportedLanguage): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, variants] of Object.entries(this.map)) {
      const text = variants[language] ?? variants.ko ?? key;
      result[key] = text;
    }
    return result;
  }

  /**
   * Update single translation (usually called by sync).
   */
  updateOne(key: string, language: SupportedLanguage, text: string): void {
    if (!this.map[key]) {
      this.map[key] = {};
    }
    this.map[key][language] = text;
    this.repo.upsert(key, language, text);
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

  getInMemoryMap(): TranslationMap {
    return this.map;
  }
}
