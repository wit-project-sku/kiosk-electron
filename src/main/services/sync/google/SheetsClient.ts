import type { GoogleSyncConfig } from '@main/core/GoogleSyncConfig';
import { clearTokenCache, getGoogleAccessToken } from './GoogleAuth';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * Minimal Google Sheets REST client. All network calls stay in main process.
 */
export class SheetsClient {
  constructor(private readonly config: GoogleSyncConfig) {}

  async getValues(range: string): Promise<string[][]> {
    const url = `${SHEETS_API}/${this.config.sheetId}/values/${encodeURIComponent(range)}`;
    const response = await this.authorizedFetch(url);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Sheets read failed (${response.status}): ${body}`);
    }
    const data = (await response.json()) as { values?: string[][] };
    return data.values ?? [];
  }

  async appendRows(tab: string, rows: string[][]): Promise<void> {
    if (rows.length === 0) return;

    const range = `${tab}!A:E`;
    const url = `${SHEETS_API}/${this.config.sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    const response = await this.authorizedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Sheets append failed (${response.status}): ${body}`);
    }
  }

  private async authorizedFetch(url: string, init?: RequestInit): Promise<Response> {
    const token = await getGoogleAccessToken(this.config.serviceAccount);
    const response = await fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      clearTokenCache();
    }

    return response;
  }
}
