/**
 * Per-machine kiosk identity persisted in electron-store.
 *
 * Set at deployment time (W001/W002/W003). Separate from user-facing settings
 * so operators cannot accidentally change the kiosk layout.
 */

import Store from 'electron-store';
import type { KioskConfig } from '@shared/types/kiosk';
import { DEFAULT_KIOSK_CONFIG } from '@shared/constants';
import { getKioskLayout } from '@shared/config/kioskLocations';

let store: Store<Partial<KioskConfig>> | null = null;

function getStore(): Store<Partial<KioskConfig>> {
  if (!store) {
    // No `defaults` here so an unprovisioned machine reads kioskId as undefined
    // (which lets the env/default fallback below kick in).
    store = new Store<Partial<KioskConfig>>({
      name: 'kiosk-config',
      clearInvalidConfig: true,
    });
  }
  return store;
}

export const kioskConfigStore = {
  get(): KioskConfig {
    // electron-store is the SINGLE source of truth, set PER MACHINE — so one
    // build serves every location. Provision each kiosk with:
    //   provision-kiosk.ps1 <W001|W002|W003>   (or the equivalent one-liner)
    // which writes {"kioskId":"W00x"} to %APPDATA%\kiosk-app\kiosk-config.json.
    // The default only applies to a machine that has not been provisioned yet.
    const s = getStore();
    const kioskId = (s.get('kioskId') as string | undefined)?.trim() || DEFAULT_KIOSK_CONFIG.kioskId;
    const rawShopId = s.get('shopApiKioskId');
    const shopApiKioskId = Number.isFinite(Number(rawShopId)) ? Number(rawShopId) : undefined;
    return { kioskId, layout: getKioskLayout(kioskId), shopApiKioskId };
  },

  update(changes: Partial<KioskConfig>): KioskConfig {
    const s = getStore();
    for (const [key, value] of Object.entries(changes)) {
      s.set(key, value as never);
    }
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
