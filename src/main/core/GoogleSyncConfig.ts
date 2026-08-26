import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface GoogleSyncConfig {
  sheetId: string;
  contentRange: string;
  analyticsTab: string;
  serviceAccount: ServiceAccountCredentials;
}

export interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri: string;
}

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export function getServiceAccount(): ServiceAccountCredentials | null {
  return loadServiceAccount();
}

export function isGoogleSyncConfigured(): boolean {
  return Boolean(process.env['GOOGLE_SHEETS_ID'] && loadServiceAccount());
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(process.env['GOOGLE_DRIVE_FOLDER_ID'] && loadServiceAccount());
}

export function getGoogleSyncConfig(): GoogleSyncConfig | null {
  const sheetId = process.env['GOOGLE_SHEETS_ID'];
  const credentials = loadServiceAccount();
  if (!sheetId || !credentials) return null;

  return {
    sheetId,
    contentRange: process.env['GOOGLE_SHEETS_CONTENT_RANGE'] ?? 'Content!A:E',
    analyticsTab: process.env['GOOGLE_SHEETS_ANALYTICS_TAB'] ?? 'Analytics',
    serviceAccount: credentials,
  };
}

export function getGoogleScopes(): string {
  const scopes: string[] = [];
  if (process.env['GOOGLE_SHEETS_ID']) scopes.push(SHEETS_SCOPE);
  if (process.env['GOOGLE_DRIVE_FOLDER_ID']) scopes.push(DRIVE_SCOPE);
  if (scopes.length === 0) return SHEETS_SCOPE;
  return scopes.join(' ');
}

/** Resolve a (possibly relative) secret path against cwd, then the packaged
 * resources dir, so it works in both dev and a Windows production build. */
function resolveSecretPath(p: string): string {
  const direct = resolve(p);
  if (existsSync(direct)) return direct;
  if (process.resourcesPath) {
    const inResources = resolve(process.resourcesPath, p);
    if (existsSync(inResources)) return inResources;
  }
  return direct;
}

function loadServiceAccount(): ServiceAccountCredentials | null {
  const raw = process.env['GOOGLE_SERVICE_ACCOUNT_JSON'];
  if (!raw) return null;

  try {
    const json = raw.trim().startsWith('{') ? raw : readFileSync(resolveSecretPath(raw), 'utf-8');
    const parsed = JSON.parse(json) as ServiceAccountCredentials;
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
      token_uri: parsed.token_uri ?? 'https://oauth2.googleapis.com/token',
    };
  } catch {
    return null;
  }
}
