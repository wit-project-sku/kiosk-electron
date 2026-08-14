import type { AnalyticsEvent, SyncJob } from '@shared/types/data';
import { createLogger } from '@main/core/logger';
import { getGoogleSyncConfig, isGoogleSyncConfigured, type GoogleSyncConfig } from '@main/core/GoogleSyncConfig';
import type { KioskLayoutId, SupportedLanguage } from '@shared/types/kiosk';
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
 * Each deployment's content lives in its OWN spreadsheet (one build, many
 * locations). The sheet + localization tab are selected by the kiosk's layout —
 * NOT a single GOOGLE_SHEETS_ID env — so a W005 machine can never read W004's
 * data. Mirrors the build-time sheet IDs in scripts/sync-sheet.mjs; keep in sync.
 */
const INSADONG_SHEET_ID = '1AVZoyepjrlWIUtwXamGRYU6TWkKKKgVb7fzwEtbRDaw';
const OSAEK_SHEET_ID = '1_CkWFXfB7ud0sJw-cnIWGvFlTzF12UxDuNylp5HkOiw';
const HWASEONG_SHEET_ID = '14aWRWrJXPC_J-W4GpZqa_g-3fDjjUsy6BpAhDg8OvVU';
const JEJU_SHEET_ID = '1A90MnKneWksKeL2zEcCUn75JKbnMFj7-OBmQsTkI72I';

interface ContentSheet {
  sheetId: string;
  localizationRange: string;
}

const CONTENT_SHEETS: Record<KioskLayoutId, ContentSheet> = {
  INSADONG: { sheetId: INSADONG_SHEET_ID, localizationRange: 'Localization_Insa!A:L' },
  NAM_INSADONG: { sheetId: INSADONG_SHEET_ID, localizationRange: 'Localization_Insa!A:L' },
  OSAN: { sheetId: OSAEK_SHEET_ID, localizationRange: 'Localization_Osaek!A:L' },
  HWASEONG: { sheetId: HWASEONG_SHEET_ID, localizationRange: 'Localization_Hwaseong!A:L' },
  JEJU_AIRPORT: { sheetId: JEJU_SHEET_ID, localizationRange: 'Localization_Jeju!A:L' },
};

/**
 * Google Sheets transport — optional cloud enhancement, not required for operation.
 *
 * Night sync only (02:00 AM). When credentials are not configured the kiosk runs
 * fully offline with seeded local content.
 *
 * Environment variables (set at deploy time):
 *   GOOGLE_SHEETS_ID              — enable flag only; the actual spreadsheet is
 *                                   chosen by the kiosk layout (CONTENT_SHEETS)
 *   GOOGLE_SERVICE_ACCOUNT_JSON   — file path or inline JSON (shared across sheets)
 *   GOOGLE_SHEETS_CONTENT_RANGE   — default: Content!A:E (legacy, optional)
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

  /** Content sheet (id + localization tab) for the running kiosk's layout. */
  private contentSheet(): ContentSheet {
    const layout = getKioskLocation(this.kiosk.getConfig().kioskId).layout;
    return CONTENT_SHEETS[layout];
  }

  /** Base sync config with the spreadsheet id pinned to this kiosk's layout, so
   *  reads/writes always hit the correct location's sheet (never another kiosk's). */
  private layoutConfig(base: GoogleSyncConfig): GoogleSyncConfig {
    return { ...base, sheetId: this.contentSheet().sheetId };
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

    // No sheet for this layout yet → nowhere to append. Return without throwing,
    // exactly like the not-configured case above: the caller marks the batch
    // synced and the events are dropped from THIS sink only (the witteria stats
    // API is a separate, unaffected path). Better than appending a 제주 kiosk's
    // rows into another location's spreadsheet.
    if (!this.contentSheet().sheetId) return;

    try {
      const client = new SheetsClient(this.layoutConfig(config));
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

    this.clearStaleTranslations();
    await this.downloadTranslations(config);
    await this.downloadScreenContent(config); // best-effort; legacy "Content" tab
  }

  /** If this machine's layout has changed since the last sync (e.g. reprovisioned
   *  from W004 to W005), wipe the cached translations so the previous location's
   *  strings can't linger even if the new sheet read later fails. */
  private clearStaleTranslations(): void {
    const layout = getKioskLocation(this.kiosk.getConfig().kioskId).layout;
    const marker = this.cache.get('translations_layout')?.data?.['layout'] as string | undefined;
    if (marker && marker !== layout) {
      this.translations.clearAll();
      log.warn('Kiosk layout changed; cleared stale translations', { from: marker, to: layout });
    }
    this.cache.upsert('translations_layout', { layout }, 'sync');
  }

  /** Per-location Localization tab → translations table (one batch per language).
   *  Sheet + tab are both derived from the kiosk layout (W004 오색시장 →
   *  Localization_Osaek, W005 화성휴게소 → Localization_Hwaseong) so a kiosk never
   *  loads another location's strings — no env override (that caused cross-kiosk
   *  contamination). */
  private async downloadTranslations(config: NonNullable<ReturnType<typeof getGoogleSyncConfig>>): Promise<void> {
    const { sheetId, localizationRange: range } = this.contentSheet();
    const layout = getKioskLocation(this.kiosk.getConfig().kioskId).layout;
    // A layout with no spreadsheet yet (see CONTENT_SHEETS) must not fall back to
    // another location's sheet — that is exactly the cross-kiosk contamination
    // this per-layout mapping exists to prevent. Skip and keep the bundled table.
    if (!sheetId) {
      log.warn('No content sheet configured for this layout; skipping translation sync', { layout });
      return;
    }
    try {
      const client = new SheetsClient({ ...config, sheetId });
      const rows = await client.getValues(range);
      const byLang = parseLocalizationSheet(rows, layout);

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
      const client = new SheetsClient(this.layoutConfig(config));
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
