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
  HWASEONG: 'hwaseong.json',
  JEJU_AIRPORT: 'jeju-airport.json',
  JEJU_HERITAGE: 'jeju-heritage.json',
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

const FALLBACK_COLORS: Record<KioskLayoutId, KioskTheme['colors']> = {
  INSADONG: {
    primary: '#FE6C50',
    primaryHover: '#E85A40',
    secondary: '#F8ECDE',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    text: '#232323',
    textMuted: '#999999',
    accent: '#FE6C50',
  },
  NAM_INSADONG: {
    primary: '#FE6C50',
    primaryHover: '#E85A40',
    secondary: '#F8ECDE',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    text: '#232323',
    textMuted: '#999999',
    accent: '#FE6C50',
  },
  OSAN: {
    primary: '#1A4D7E',
    primaryHover: '#153D65',
    secondary: '#D3DFEC',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    text: '#232323',
    textMuted: '#999999',
    accent: '#1A4D7E',
  },
  HWASEONG: {
    primary: '#005AB4',
    primaryHover: '#004A96',
    secondary: '#DAECFE',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    text: '#232323',
    textMuted: '#999999',
    accent: '#005AB4',
  },
  JEJU_AIRPORT: {
    primary: '#4f8cff',
    primaryHover: '#3b73e8',
    secondary: '#e8f0fa',
    background: '#f5f6f8',
    surface: '#ffffff',
    text: '#1a1d23',
    textMuted: '#687087',
    accent: '#f5a623',
  },
  JEJU_HERITAGE: {
    primary: '#ff7f0f',
    primaryHover: '#e56f06',
    secondary: '#f5f1ef',
    background: '#ffffff',
    surface: '#ffffff',
    text: '#232323',
    textMuted: '#999999',
    accent: '#ff7f0f',
  },
};

function fallbackTheme(layout: KioskLayoutId): KioskTheme {
  const ID_MAP: Record<KioskLayoutId, string> = {
    INSADONG: 'insadong',
    NAM_INSADONG: 'nam-insadong',
    OSAN: 'osan',
    HWASEONG: 'hwaseong',
    JEJU_AIRPORT: 'jeju-airport',
    JEJU_HERITAGE: 'jeju-heritage',
  };
  const NAME_MAP: Record<KioskLayoutId, string> = {
    INSADONG: 'Insadong',
    NAM_INSADONG: 'Nam Insadong',
    OSAN: '오산시 오색시장',
    HWASEONG: '화성휴게소',
    JEJU_AIRPORT: '제주공항',
    JEJU_HERITAGE: '세계자연유산본부',
  };
  const theme: KioskTheme = {
    id: ID_MAP[layout] ?? layout.toLowerCase(),
    name: NAME_MAP[layout] ?? layout,
    colors: FALLBACK_COLORS[layout] ?? FALLBACK_COLORS.INSADONG,
    typography: {
      fontFamily: "'Noto Sans KR', 'Noto Sans SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
