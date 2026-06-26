import type { AnalyticsEvent, SyncJob } from '@shared/types/data';
import { createLogger } from '@main/core/logger';
import { getGoogleSyncConfig, isGoogleSyncConfigured } from '@main/core/GoogleSyncConfig';
import type { SupportedLanguage } from '@shared/types/kiosk';
import { getKioskLocation } from '@shared/config/kioskLocations';
import type { LocalCacheService } from '@main/services/LocalCacheService';
import type { FailedRequestService } from '@main/services/FailedRequestService';
import type { KioskService } from '@main/services/KioskService';
import type { TranslationService } from '@main/services/TranslationService';
import type { SyncTransport } from './SyncTransport';
import { SheetsClient } from './google/SheetsClient';
import { parseContentSheet } from './google/ContentSyncParser';
import { parseLocalizationSheet } from './google/LocalizationSyncParser';

const log = createLogger('google-sheets-transport');

/**
 * Google Sheets transport — optional cloud enhancement, not required for operation.
 *
 * Night sync only (02:00 AM). When credentials are not configured the kiosk runs
 * fully offline with seeded local content.
 *
 * Environment variables (set at deploy time):
 *   GOOGLE_SHEETS_ID              — spreadsheet ID
 *   GOOGLE_SERVICE_ACCOUNT_JSON   — file path or inline JSON
 *   GOOGLE_SHEETS_CONTENT_RANGE   — default: Content!A:E
 *   GOOGLE_SHEETS_ANALYTICS_TAB   — default: Analytics
 */
export class GoogleSheetsSyncTransport implements SyncTransport {
  constructor(
    private readonly cache: LocalCacheService,
    private readonly failedRequests: FailedRequestService,
    private readonly kiosk: KioskService,
    private readonly translations: TranslationService,
  ) {}

  isConfigured(): boolean {
    return isGoogleSyncConfigured();
  }

  async process(job: SyncJob): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      switch (job.type) {
        case 'sync_content':
          await this.downloadContent();
          break;
        default:
          log.debug('No remote handler for job type', { type: job.type });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.failedRequests.record(job.type, job.payload, message, `job-${job.id}`);
      throw error;
    }
  }

  async uploadAnalytics(events: AnalyticsEvent[]): Promise<void> {
    if (!this.isConfigured() || events.length === 0) return;

    const config = getGoogleSyncConfig();
    if (!config) return;

    try {
      const client = new SheetsClient(config);
      const { kioskId } = this.kiosk.getConfig();

      const rows = events.map((event) => [
        String(event.id),
        kioskId,
        event.name,
        event.payload ? JSON.stringify(event.payload) : '',
        event.createdAt,
      ]);

      await client.appendRows(config.analyticsTab, rows);
      log.info('Uploaded analytics to Google Sheets', { count: events.length, tab: config.analyticsTab });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.failedRequests.record(
        'upload_analytics',
        { eventIds: events.map((e) => e.id) },
        message,
      );
      throw error;
    }
  }

  /** Download localization (primary) + legacy screen content from the sheet. */
  async downloadContent(): Promise<void> {
    const config = getGoogleSyncConfig();
    if (!config) return;

    await this.downloadTranslations(config);
    await this.downloadScreenContent(config); // best-effort; legacy "Content" tab
  }

  /** Localization_Insa → translations table (one batch per language). */
  private async downloadTranslations(config: NonNullable<ReturnType<typeof getGoogleSyncConfig>>): Promise<void> {
    // Tab is location-specific (W004 오색시장 uses Localization_Osaek); env overrides.
    const layout = getKioskLocation(this.kiosk.getConfig().kioskId).layout;
    const defaultRange = layout === 'OSAN' ? 'Localization_Osaek!A:L' : 'Localization_Insa!A:L';
    const range = process.env['GOOGLE_SHEETS_LOCALIZATION_RANGE'] ?? defaultRange;
    try {
      const client = new SheetsClient(config);
      const rows = await client.getValues(range);
      const byLang = parseLocalizationSheet(rows);

      let total = 0;
      for (const [lang, entries] of Object.entries(byLang)) {
        if (!entries || Object.keys(entries).length === 0) continue;
        this.translations.replaceLanguage(lang as SupportedLanguage, entries);
        total += Object.keys(entries).length;
      }
      log.info('Translations updated from Google Sheets', { range, total });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.failedRequests.record('sync_content', { range }, message);
      log.warn('Translation download failed', { range, error: message });
    }
  }

  /** Legacy per-kiosk screen content (Content!A:E). Only when explicitly configured. */
  private async downloadScreenContent(config: NonNullable<ReturnType<typeof getGoogleSyncConfig>>): Promise<void> {
    // The content sheet is optional and absent on localization-only sheets; skip
    // it entirely unless a range is explicitly set to avoid a noisy 400.
    if (!process.env['GOOGLE_SHEETS_CONTENT_RANGE']) return;

    const { kioskId } = this.kiosk.getConfig();
    try {
      const client = new SheetsClient(config);
      const rows = await client.getValues(config.contentRange);
      const entries = parseContentSheet(rows, kioskId);
      if (entries.length === 0) return;
      for (const entry of entries) {
        this.cache.upsert(entry.screenKey, entry.content, 'google_sheets');
      }
      log.info('Content cache updated from Google Sheets', { entries: entries.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.debug('Legacy content tab unavailable; skipping', { range: config.contentRange, error: message });
    }
  }
}
