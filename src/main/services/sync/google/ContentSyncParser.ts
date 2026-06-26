import { createLogger } from '@main/core/logger';
import { contentSheetRowSchema, type ScreenContent } from '@shared/validation/content.schema';

const log = createLogger('content-sync-parser');

const HEADER_ALIASES: Record<string, string> = {
  kiosk_id: 'kiosk_id',
  kioskid: 'kiosk_id',
  'kiosk id': 'kiosk_id',
  screen_key: 'screen_key',
  screenkey: 'screen_key',
  'screen key': 'screen_key',
  screen: 'screen_key',
  title: 'title',
  subtitle: 'subtitle',
  body: 'body',
  content: 'body',
};

export interface ParsedContentEntry {
  screenKey: string;
  content: ScreenContent;
}

/**
 * Parses a Google Sheets Content tab into validated local_cache entries
 * filtered by kiosk ID.
 */
export function parseContentSheet(
  rows: string[][],
  kioskId: string,
): ParsedContentEntry[] {
  if (rows.length < 2) {
    log.warn('Content sheet empty or missing header row');
    return [];
  }

  const header = rows[0]!.map(normalizeHeader);
  const columnIndex = buildColumnIndex(header);
  if (columnIndex.kiosk_id == null || columnIndex.screen_key == null || columnIndex.title == null) {
    log.error('Content sheet missing required columns', { header });
    return [];
  }

  const results: ParsedContentEntry[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i]!;
    const kiosk_id = cell(row, columnIndex.kiosk_id);
    if (kiosk_id.toUpperCase() !== kioskId.toUpperCase()) continue;

    const raw = {
      kiosk_id,
      screen_key: cell(row, columnIndex.screen_key),
      title: cell(row, columnIndex.title),
      subtitle: columnIndex.subtitle != null ? cell(row, columnIndex.subtitle) : '',
      body: columnIndex.body != null ? cell(row, columnIndex.body) : '',
    };

    const parsed = contentSheetRowSchema.safeParse(raw);
    if (!parsed.success) {
      log.warn('Skipping invalid content row', { row: i + 1, errors: parsed.error.flatten() });
      continue;
    }

    const { screen_key, title, subtitle, body } = parsed.data;
    results.push({
      screenKey: screen_key,
      content: {
        title,
        ...(subtitle ? { subtitle } : {}),
        body,
      },
    });
  }

  log.info('Parsed content sheet', { kioskId, entries: results.length });
  return results;
}

function normalizeHeader(value: string): string {
  return HEADER_ALIASES[value.trim().toLowerCase()] ?? value.trim().toLowerCase();
}

function buildColumnIndex(header: string[]): Record<string, number | undefined> {
  const index: Record<string, number | undefined> = {};
  for (let i = 0; i < header.length; i += 1) {
    const key = header[i];
    if (key) index[key] = i;
  }
  return index;
}

function cell(row: string[], index: number): string {
  return (row[index] ?? '').trim();
}
