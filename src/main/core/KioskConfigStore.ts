/**
 * Per-machine kiosk identity persisted in electron-store.
 *
 * Set at deployment time (W001/W002/W003). Separate from user-facing settings
 * so operators cannot accidentally change the kiosk layout.
 */

import { existsSync } from 'node:fs';
import Store from 'electron-store';
import type { KioskConfig } from '@shared/types/kiosk';
import { DEFAULT_KIOSK_CONFIG } from '@shared/constants';
import { getKioskLayout } from '@shared/config/kioskLocations';
import { isOfficePc, isStageApiBase, resolveKioskIdentity } from '@shared/config/testRig';
import { setupStateFor, type KioskSetupState, type SetupSiteCode } from '@shared/config/kioskSetup';
import { witteriaApiBase } from './apiBase';
import { e2eForcesStageServer } from './e2e';
import {
  JEJU_ID_SHIFT_FLAG,
  V224_ID_SHIFT_FLAG,
  migrateStoredSite,
} from '@shared/config/kioskRenumber';

type KioskConfigFile = Partial<KioskConfig> & {
  jejuIdShift202610?: boolean;
  kioskIdShift202611?: boolean;
};

let store: Store<KioskConfigFile> | null = null;
/** Whether the 지점 설정 screen opens this launch — see decideSetup(). */
let setupState: KioskSetupState | null = null;

function getStore(): Store<KioskConfigFile> {
  if (!store) {
    // No `defaults` here so an unprovisioned machine reads kioskId as undefined
    // (which lets the env/default fallback below kick in).
    store = new Store<KioskConfigFile>({
      name: 'kiosk-config',
      clearInvalidConfig: true,
    });
  }
  return store;
}

/** Apply the one-shot renumber moves (kioskRenumber.ts) and store their flags. */
function migratedKioskId(s: Store<KioskConfigFile>, kioskId: string): string {
  const jejuShifted = s.get(JEJU_ID_SHIFT_FLAG) === true;
  const v224Shifted = s.get(V224_ID_SHIFT_FLAG) === true;
  if (jejuShifted && v224Shifted) return kioskId;
  const previewSite = (s.get('previewSite' as never) as string | undefined)?.trim() || undefined;
  const next = migrateStoredSite({ kioskId, previewSite, jejuShifted, v224Shifted });
  if (next.changed.includes('kioskId')) s.set('kioskId', next.kioskId);
  if (next.changed.includes('previewSite'))
    s.set('previewSite' as never, next.previewSite as never);
  s.set(JEJU_ID_SHIFT_FLAG, true);
  s.set(V224_ID_SHIFT_FLAG, true);
  return next.kioskId;
}

/** A site written now is already in today's numbering — neither move may touch it. */
function markRenumbered(s: Store<KioskConfigFile>): void {
  s.set(JEJU_ID_SHIFT_FLAG, true);
  s.set(V224_ID_SHIFT_FLAG, true);
}

export const kioskConfigStore = {
  /**
   * Decide, once per launch, whether to open the 지점 설정 screen. Must run
   * BEFORE `database.init()` (which creates kiosk.db) and before the first
   * `get()` (which stores the 제주 renumber flag) — after either, every machine
   * would look like one that has run before.
   */
  decideSetup(databaseFile: string, argv: readonly string[]): KioskSetupState | null {
    const s = getStore();
    setupState = setupStateFor({
      storedKeys: Object.keys(s.store).length,
      databaseExists: existsSync(databaseFile),
      pending: s.get('setupPending' as never) === true,
      argv,
    });
    // This launch creates kiosk.db, so the next one would look like a machine that
    // has run before and boot as W001 if the window was closed without choosing.
    if (setupState === 'required') s.set('setupPending' as never, true as never);
    return setupState;
  },

  /**
   * Make this PC `code` — what provision-kiosk used to write. The 제주 renumber
   * flag goes with it (a fresh W008 must not be read as a pre-2026-10-26 id and
   * moved to W010), the shop-API id re-derives, and a venue drops any preview
   * site left from stage testing. The test kiosk keeps its preview site.
   */
  applySetup(code: SetupSiteCode): void {
    const s = getStore();
    s.set('kioskId', code);
    markRenumbered(s);
    s.delete('shopApiKioskId');
    s.delete('setupPending' as never);
    if (!isOfficePc(code)) s.delete('previewSite' as never);
    setupState = null;
  },

  get(): KioskConfig {
    // electron-store is the SINGLE source of truth, set PER MACHINE — so one
    // build serves every location. Provision each kiosk with:
    //   provision-kiosk.ps1 <W001|W002|W003>   (or the equivalent one-liner)
    // which writes {"kioskId":"W00x"} to %APPDATA%\kiosk-app\kiosk-config.json.
    // The default only applies to a machine that has not been provisioned yet.
    const s = getStore();
    // Codes from before the 2026-10-26 / 2026-11-25 renumbers are moved once (migratedKioskId), THEN the office
    // test rig (W200) — or, on a stage server, any machine — keeps its identity
    // but shows a switchable preview site.
    const storedId = migratedKioskId(
      s,
      (s.get('kioskId') as string | undefined)?.trim() || DEFAULT_KIOSK_CONFIG.kioskId,
    );
    const stageServer = isStageApiBase(witteriaApiBase()) || e2eForcesStageServer();
    const { kioskId, identityKioskId, testRig } = resolveKioskIdentity(
      storedId,
      (s.get('previewSite' as never) as string | undefined)?.trim(),
      { stageServer },
    );
    const testRigPayment = testRig && s.get('testRigPayment' as never) === true;
    const rawShopId = s.get('shopApiKioskId');
    const shopApiKioskId = Number.isFinite(Number(rawShopId)) ? Number(rawShopId) : undefined;
    // `apiBase` is derived like `layout`, not stored — see KioskConfig.apiBase.
    return {
      kioskId,
      identityKioskId,
      testRig,
      testRigPayment,
      stageServer,
      setup: setupState ?? undefined,
      layout: getKioskLayout(kioskId),
      shopApiKioskId,
      apiBase: witteriaApiBase(),
    };
  },

  update(changes: Partial<KioskConfig>): KioskConfig {
    const s = getStore();
    for (const [key, value] of Object.entries(changes)) {
      s.set(key, value as never);
    }
    if (changes.kioskId) markRenumbered(s);
    return this.get();
  },

  /**
   * Remove a persisted key so it falls back to its derived default.
   *
   * Needed when switching location: a stale `shopApiKioskId` left over from the
   * previous kiosk would keep pointing the shop API at the OLD location, so it
   * must be dropped (not overwritten) to let it re-derive from the new kioskId.
   * Mirrors what tools/location-tester does to kiosk-config.json.
   */
  delete(key: keyof KioskConfig): void {
    getStore().delete(key as never);
  },
};
