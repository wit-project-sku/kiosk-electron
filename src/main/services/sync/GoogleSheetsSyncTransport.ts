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
import { parseLocalizationSheet, rowsWithPrefix, type LocalizationByLang } from './google/LocalizationSyncParser';
import { parseVoiceSheet } from './google/VoiceSyncParser';
import { parseJejuAiCategories, parseJejuAirportFacilities } from './google/JejuSheetDataParser';
import { JEJU_AI_CATEGORIES_KEY, JEJU_AIRPORT_FACILITIES_KEY } from '@shared/constants/jejuSheetData';
import { parseLotteFacilities } from './google/LotteSheetDataParser';
import {
  LOTTE_FACILITIES_KEY,
  LOTTE_FACILITY_TABS,
  LOTTE_LOCALIZATION_RANGE,
  LOTTE_SHEET_ID,
} from '@shared/constants/lotteSheet';

const log = createLogger('google-sheets-transport');

/** Add `extra`'s entries to `target`, per language. */
function mergeInto(target: LocalizationByLang, extra: LocalizationByLang): void {
  for (const [lang, entries] of Object.entries(extra) as Array<[SupportedLanguage, Record<string, string>]>) {
    target[lang] = { ...target[lang], ...entries };
  }
}

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
  /** Tried in order when the sheet no longer has the `localizationRange` tab
   *  (Sheets answers 400 "Unable to parse range"). */
  fallbackRanges?: readonly string[];
  /** Voice guidance script (제주, 롯데), stored with the translations as `Voice_*` keys. */
  voiceRange?: string;
  /**
   * Rows this venue shows but another venue's sheet maintains: the `keyPrefix` rows of that
   * Localization tab, read at the same launch / 00:00 sync. This sheet's own rows win, so a
   * venue can take a row over by adding it to its own tab.
   */
  borrowedRows?: { sheetId: string; range: string; sourceLayout: KioskLayoutId; keyPrefix: string };
}

/** Text-to-speech_Script: Key in B, the eight languages in E–L, notes after. */
const JEJU_VOICE_RANGE = "'Text-to-speech_Script'!A:M";

/** 제주's data tabs read at launch, and the columns each generator in sync-sheet uses. */
const JEJU_AI_CATEGORY_RANGE = 'AICategory_Jeju!A:Z';
const JEJU_FACILITY_RANGE = 'AirportFacilityData_Jeju!A:AJ';

const CONTENT_SHEETS: Record<KioskLayoutId, ContentSheet> = {
  INSADONG: { sheetId: INSADONG_SHEET_ID, localizationRange: 'Localization_Insa!A:L' },
  NAM_INSADONG: { sheetId: INSADONG_SHEET_ID, localizationRange: 'Localization_Insa!A:L' },
  OSAN: { sheetId: OSAEK_SHEET_ID, localizationRange: 'Localization_Osaek!A:L' },
  // 2026-10-14 the tab was renamed Localization_Hwaseong_deprecated with no
  // replacement yet; read it until a live Localization_Hwaseong reappears
  // (mirrors genLocalizationHwaseong in scripts/sync-sheet.mjs).
  HWASEONG: {
    sheetId: HWASEONG_SHEET_ID,
    localizationRange: 'Localization_Hwaseong!A:L',
    fallbackRanges: ['Localization_Hwaseong_deprecated!A:L'],
  },
  // Localization_Jeju_v3 (2026-11-05) replaces _v2: the same rows without the Num
  // column, which parseLocalizationSheet handles. The old tabs are no longer read.
  JEJU_AIRPORT: {
    sheetId: JEJU_SHEET_ID,
    localizationRange: 'Localization_Jeju_v3!A:L',
    voiceRange: JEJU_VOICE_RANGE,
  },
  // Same tab as JEJU_AIRPORT on purpose — "#W6~8=제주_전체데이터" serves all three
  // 제주 venues; the mascot rows are split per layout in LocalizationSyncParser.
  JEJU_HERITAGE: {
    sheetId: JEJU_SHEET_ID,
    localizationRange: 'Localization_Jeju_v3!A:L',
    voiceRange: JEJU_VOICE_RANGE,
  },
  // KADA W202 has NO content spreadsheet, and is not waiting for one: its ten
  // strings are authored in layouts/kada/kadaText.ts because the venue has no
  // CMS and no one on site to maintain a tab (see that file). The empty sheetId
  // is the existing "no spreadsheet for this layout" signal — `downloadTranslations`
  // and `uploadAnalytics` both check it and skip rather than falling back to
  // another location's sheet.
  KADA: { sheetId: '', localizationRange: '' },
  // 롯데 W012~W014 share one sheet; site rows are `Key@W011` (see layouts/lotte/lotteText). Its
  // FacilityData_* tabs are read by downloadLotteData (@shared/constants/lotteSheet).
  // Its own Text-to-speech_Script tab (same name and columns as 제주's) carries the 롯데 voice lines.
  // FillMe (스마트 헬스케어) is the same Linkerverse service on both venues, and its 61 `Fillme_*`
  // rows — screen copy and the 개인정보처리방침 전문 (Fillme_PrivacyPolicyContent) — are kept in
  // the 제주 tab only; the 롯데 sheet has none (2026-11-20). Read them from there.
  LOTTE: {
    sheetId: LOTTE_SHEET_ID,
    localizationRange: LOTTE_LOCALIZATION_RANGE,
    voiceRange: JEJU_VOICE_RANGE,
    borrowedRows: {
      sheetId: JEJU_SHEET_ID,
      range: 'Localization_Jeju_v3!A:L',
      sourceLayout: 'JEJU_AIRPORT',
      keyPrefix: 'Fillme_',
    },
  },
};

/**
 * The content spreadsheet for a layout (`''` when it has none). Exported for
 * services that read another tab of the same sheet — SubtitleService's 제주
 * VideoSubtitle fallback — so the sheet id stays defined in one place.
 */
export function contentSheetIdFor(layout: KioskLayoutId): string {
  return CONTENT_SHEETS[layout].sheetId;
}

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
    await this.downloadJejuData(config);
    await this.downloadLotteData(config);
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
    const { sheetId, localizationRange, fallbackRanges = [], voiceRange, borrowedRows } = this.contentSheet();
    let range = localizationRange;
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
      const candidates = [localizationRange, ...fallbackRanges];
      let rows: Awaited<ReturnType<SheetsClient['getValues']>> | undefined;
      for (const [i, candidate] of candidates.entries()) {
        range = candidate;
        try {
          rows = await client.getValues(candidate);
          break;
        } catch (error) {
          const missingTab = error instanceof Error && /Unable to parse range/i.test(error.message);
          if (!missingTab || i === candidates.length - 1) throw error;
          log.warn('Localization tab missing; trying the next range', { range: candidate });
        }
      }
      if (!rows) return;
      let byLang = parseLocalizationSheet(rows, layout);
      if (borrowedRows) {
        // Borrowed first, own rows over them. Same batch for the same reason as the voice rows.
        const merged: LocalizationByLang = {};
        mergeInto(merged, await this.downloadBorrowed(config, borrowedRows));
        mergeInto(merged, byLang);
        byLang = merged;
      }
      // replaceLanguage rewrites a language's whole table, so the voice rows
      // have to ride in the same batch or this write would drop them.
      if (voiceRange) mergeInto(byLang, await this.downloadVoice(client, voiceRange));

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

  /**
   * Another venue's `keyPrefix` rows (see ContentSheet.borrowedRows). Best-effort: on failure the
   * kiosk keeps the copy bundled at build time.
   */
  private async downloadBorrowed(
    config: NonNullable<ReturnType<typeof getGoogleSyncConfig>>,
    { sheetId, range, sourceLayout, keyPrefix }: NonNullable<ContentSheet['borrowedRows']>,
  ): Promise<LocalizationByLang> {
    try {
      const client = new SheetsClient({ ...config, sheetId });
      const out = rowsWithPrefix(parseLocalizationSheet(await client.getValues(range), sourceLayout), keyPrefix);
      const total = Object.values(out).reduce((n, entries) => n + Object.keys(entries ?? {}).length, 0);
      log.info('Borrowed rows updated from Google Sheets', { range, keyPrefix, total });
      return out;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.warn('Borrowed rows download failed; keeping the bundled copy', { range, keyPrefix, error: message });
      return {};
    }
  }

  /**
   * The 제주 / 롯데 voice script. Best-effort: on failure the kiosk keeps speaking the
   * script bundled at build time, and the screen text still updates.
   */
  private async downloadVoice(client: SheetsClient, range: string): Promise<LocalizationByLang> {
    try {
      const byLang = parseVoiceSheet(await client.getValues(range));
      const total = Object.values(byLang).reduce((n, entries) => n + Object.keys(entries ?? {}).length, 0);
      log.info('Voice script updated from Google Sheets', { range, total });
      return byLang;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.warn('Voice script download failed; keeping the bundled script', { range, error: message });
      return {};
    }
  }

  /**
   * 제주's two data tabs, into the content cache that travels with the bootstrap.
   * Each is best-effort and independent: on a failure or an unreadable tab the
   * kiosk keeps its last good copy, or the bundled one.
   */
  private async downloadJejuData(config: NonNullable<ReturnType<typeof getGoogleSyncConfig>>): Promise<void> {
    const { sheetId, voiceRange } = this.contentSheet();
    // 제주 layouts only. Not keyed on voiceRange: 롯데 has a voice tab but not these two.
    if (!voiceRange || !getKioskLocation(this.kiosk.getConfig().kioskId).layout.startsWith('JEJU')) return;
    const client = new SheetsClient({ ...config, sheetId });
    const tabs = [
      { key: JEJU_AI_CATEGORIES_KEY, range: JEJU_AI_CATEGORY_RANGE, parse: parseJejuAiCategories },
      { key: JEJU_AIRPORT_FACILITIES_KEY, range: JEJU_FACILITY_RANGE, parse: parseJejuAirportFacilities },
    ];
    for (const { key, range, parse } of tabs) {
      try {
        const rows = parse(await client.getValues(range));
        if (rows.length === 0) {
          log.warn('Sheet data tab had no readable rows; keeping the last copy', { range });
          continue;
        }
        this.cache.upsert(key, { rows }, 'google_sheets');
        log.info('Sheet data updated from Google Sheets', { range, total: rows.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        log.warn('Sheet data download failed; keeping the last copy', { range, error: message });
      }
    }
  }

  /**
   * This 롯데 site's FacilityData tab, into the content cache that travels with the bootstrap —
   * the 시설안내 / 화장실 rows the shops API does not carry. Best-effort, like downloadJejuData:
   * on a failure or an unreadable tab the kiosk keeps its last good copy, or the bundled one.
   */
  private async downloadLotteData(config: NonNullable<ReturnType<typeof getGoogleSyncConfig>>): Promise<void> {
    const { kioskId } = this.kiosk.getConfig();
    if (getKioskLocation(kioskId).layout !== 'LOTTE') return;
    const tab = LOTTE_FACILITY_TABS[kioskId as keyof typeof LOTTE_FACILITY_TABS];
    if (!tab) return;
    const range = `${tab}!A:AJ`;
    try {
      const client = new SheetsClient({ ...config, sheetId: this.contentSheet().sheetId });
      const rows = parseLotteFacilities(await client.getValues(range));
      if (rows.length === 0) {
        log.warn('Sheet data tab had no readable rows; keeping the last copy', { range });
        return;
      }
      // The site rides along so a test-rig switch to another 롯데 site cannot show this one's rows.
      this.cache.upsert(LOTTE_FACILITIES_KEY, { kioskId, rows }, 'google_sheets');
      log.info('Sheet data updated from Google Sheets', { range, total: rows.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.warn('Sheet data download failed; keeping the last copy', { range, error: message });
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
