import type { KioskConfig, KioskTheme } from '@shared/types/kiosk';
import { kioskConfigStore } from '@main/core/KioskConfigStore';
import { loadTheme } from '@main/core/ThemeLoader';

/**
 * Kiosk identity and theme resolution. All reads are local and synchronous.
 */
export class KioskService {
  getConfig(): KioskConfig {
    return kioskConfigStore.get();
  }

  getTheme(): KioskTheme {
    const { layout } = this.getConfig();
    return loadTheme(layout);
  }

  /**
   * Numeric kiosk id (1–5) used by the witteria APIs. Prefers the per-machine
   * provisioned `shopApiKioskId`; otherwise derives it from the kiosk id string
   * (e.g. "W003" → 3). Falls back to 1.
   */
  kioskNum(): number {
    const cfg = this.getConfig();
    if (cfg.shopApiKioskId != null && Number.isFinite(cfg.shopApiKioskId) && cfg.shopApiKioskId > 0) {
      return cfg.shopApiKioskId;
    }
    const digits = (cfg.kioskId.match(/\d+/)?.[0] ?? '1').replace(/^0+/, '');
    const n = Number(digits || '1');
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
}
