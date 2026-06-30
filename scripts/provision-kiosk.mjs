#!/usr/bin/env node
/**
 * Provisions kiosk identity on a deployment machine.
 *
 * Writes electron-store kiosk-config.json before first launch (or to reset).
 *
 * Usage:
 *   node scripts/provision-kiosk.mjs W001
 *   node scripts/provision-kiosk.mjs W003
 *   node scripts/provision-kiosk.mjs W002 --data-dir "C:\Custom\Path"
 *   node scripts/provision-kiosk.mjs --kiosk-id W003 --layout NAM_INSADONG
 *
 * Presets:
 *   W001 → INSADONG (북인사마당)
 *   W002 → INSADONG (인사동센터)
 *   W003 → NAM_INSADONG (남인사마당)
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';

const PRESETS = {
  W001: { kioskId: 'W001', layout: 'INSADONG' },
  W002: { kioskId: 'W002', layout: 'INSADONG' },
  W003: { kioskId: 'W003', layout: 'NAM_INSADONG' },
  W004: { kioskId: 'W004', layout: 'OSAN' },
  W005: { kioskId: 'W005', layout: 'HWASEONG' },
};

const VALID_LAYOUTS = new Set(['INSADONG', 'NAM_INSADONG', 'OSAN', 'HWASEONG']);

function defaultDataDir() {
  // Must match Electron's app.getPath('userData'), which derives from the
  // package.json "name" ("kiosk-app") — NOT the electron-builder productName.
  const appName = 'kiosk-app';
  if (platform() === 'win32') {
    const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
    return join(appData, appName);
  }
  if (platform() === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', appName);
  }
  const xdg = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  return join(xdg, appName);
}

function parseArgs(argv) {
  let kioskId = null;
  let layout = null;
  let dataDir = null;
  let shopId = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--data-dir') {
      dataDir = argv[++i];
    } else if (arg === '--kiosk-id') {
      kioskId = argv[++i]?.toUpperCase();
    } else if (arg === '--layout') {
      layout = argv[++i]?.toUpperCase();
    } else if (arg === '--shop-id') {
      shopId = Number(argv[++i]);
    } else if (!arg.startsWith('-')) {
      kioskId = arg.toUpperCase();
    }
  }

  return { kioskId, layout, dataDir, shopId };
}

function printUsage() {
  console.log(`
Provision kiosk identity (kiosk-config.json)

  node scripts/provision-kiosk.mjs <W001|W002|W003|W004|W005>
  node scripts/provision-kiosk.mjs --kiosk-id W005 --layout HWASEONG
  node scripts/provision-kiosk.mjs W001 --data-dir "C:\\Custom\\Kiosk App"

Presets:
  W001  북인사마당        → INSADONG
  W002  인사동센터        → INSADONG
  W003  남인사마당        → NAM_INSADONG
  W004  오산시 오색시장   → OSAN
  W005  화성휴게소        → HWASEONG
`);
}

function main() {
  const { kioskId, layout, dataDir: customDir, shopId } = parseArgs(process.argv.slice(2));

  if (!kioskId) {
    printUsage();
    process.exit(1);
  }

  const preset = PRESETS[kioskId];
  const config = {
    kioskId,
    layout: layout ?? preset?.layout ?? 'INSADONG',
  };
  if (shopId != null && Number.isFinite(shopId) && shopId > 0) {
    config.shopApiKioskId = shopId;
  }

  if (!VALID_LAYOUTS.has(config.layout)) {
    console.error(`Invalid layout "${config.layout}". Use INSADONG or NAM_INSADONG.`);
    process.exit(1);
  }

  const dataDir = customDir ?? defaultDataDir();
  mkdirSync(dataDir, { recursive: true });

  const configPath = join(dataDir, 'kiosk-config.json');
  const existed = existsSync(configPath);

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  console.log(existed ? 'Updated' : 'Created', configPath);
  console.log(JSON.stringify(config, null, 2));
}

main();
