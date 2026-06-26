/**
 * Loads kiosk theme JSON from local files. Never fetches from the network.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import type { KioskLayoutId, KioskTheme } from '@shared/types/kiosk';
import { createLogger } from './logger';

const log = createLogger('theme-loader');

const THEME_FILES: Record<KioskLayoutId, string> = {
  INSADONG: 'insadong.json',
  NAM_INSADONG: 'nam-insadong.json',
  OSAN: 'osan.json',
};

function themesDirectory(): string {
  if (is.dev) {
    return join(process.cwd(), 'themes');
  }
  return join(process.resourcesPath, 'themes');
}

const cache = new Map<KioskLayoutId, KioskTheme>();

export function loadTheme(layout: KioskLayoutId): KioskTheme {
  const cached = cache.get(layout);
  if (cached) return cached;

  const fileName = THEME_FILES[layout];
  const filePath = join(themesDirectory(), fileName);

  if (!existsSync(filePath)) {
    log.warn('Theme file not found; using embedded fallback', { layout, filePath });
    return fallbackTheme(layout);
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const theme = JSON.parse(raw) as KioskTheme;
    cache.set(layout, theme);
    return theme;
  } catch (error) {
    log.error('Failed to load theme; using fallback', { layout, error });
    return fallbackTheme(layout);
  }
}

function fallbackTheme(layout: KioskLayoutId): KioskTheme {
  const theme: KioskTheme = {
    id: layout === 'INSADONG' ? 'insadong' : layout === 'NAM_INSADONG' ? 'nam-insadong' : 'osan',
    name: layout === 'INSADONG' ? 'Insadong' : layout === 'NAM_INSADONG' ? 'Nam Insadong' : '오산시 오색시장',
    colors: {
      primary: '#4f8cff',
      primaryHover: '#3b73e8',
      secondary: '#7cb686',
      background: '#f5f6f8',
      surface: '#ffffff',
      text: '#1a1d23',
      textMuted: '#687087',
      accent: '#f5a623',
    },
    typography: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      headingSize: '2.5rem',
      bodySize: '1.125rem',
      buttonSize: '1.25rem',
    },
    spacing: {
      screenPadding: '2rem',
      buttonGap: '1rem',
    },
  };
  cache.set(layout, theme);
  return theme;
}
