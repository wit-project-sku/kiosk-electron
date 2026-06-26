import { createSign } from 'node:crypto';
import type { ServiceAccountCredentials } from '@main/core/GoogleSyncConfig';
import { getGoogleScopes } from '@main/core/GoogleSyncConfig';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Service-account JWT auth for Google APIs. Uses Node crypto + fetch only.
 */
export async function getGoogleAccessToken(
  credentials: ServiceAccountCredentials,
): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const jwt = buildJwt(credentials);
  const response = await fetch(credentials.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as TokenResponse;
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return data.access_token;
}

/** Clear cached token (e.g. on auth failure). */
export function clearTokenCache(): void {
  cachedToken = null;
}

function buildJwt(credentials: ServiceAccountCredentials): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: getGoogleScopes(),
      aud: credentials.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  );

  const input = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(input);
  const signature = sign.sign(credentials.private_key, 'base64url');
  return `${input}.${signature}`;
}

function base64url(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64url');
}
