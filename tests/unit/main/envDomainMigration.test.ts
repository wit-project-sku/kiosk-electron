import { describe, expect, it } from 'vitest';
import { migrateRetiredDomain } from '../../../src/main/core/env';

describe('migrateRetiredDomain', () => {
  it('rewrites witteria.com values to witmarket.net and leaves others alone', () => {
    const env: NodeJS.ProcessEnv = {
      WITTERIA_API_BASE: 'https://api-v3.witteria.com',
      PHOTO_PUBLIC_UPLOAD_URL: 'https://photo.witteria.com/api/images',
      PAYMENT_CORS_ORIGINS: 'https://witteria.com,https://witglobaldonation.vercel.app',
      OPENWEATHER_API_KEY: 'abc',
    };
    const changed = migrateRetiredDomain(env);
    expect(env['WITTERIA_API_BASE']).toBe('https://api-v3.witmarket.net');
    expect(env['PHOTO_PUBLIC_UPLOAD_URL']).toBe('https://photo.witmarket.net/api/images');
    expect(env['PAYMENT_CORS_ORIGINS']).toBe(
      'https://witmarket.net,https://witglobaldonation.vercel.app',
    );
    expect(env['OPENWEATHER_API_KEY']).toBe('abc');
    expect(changed.sort()).toEqual([
      'PAYMENT_CORS_ORIGINS',
      'PHOTO_PUBLIC_UPLOAD_URL',
      'WITTERIA_API_BASE',
    ]);
  });

  it('is a no-op when nothing names the retired domain', () => {
    const env: NodeJS.ProcessEnv = { WITTERIA_API_BASE: 'https://api-v3.witmarket.net' };
    expect(migrateRetiredDomain(env)).toEqual([]);
    expect(env['WITTERIA_API_BASE']).toBe('https://api-v3.witmarket.net');
  });
});
