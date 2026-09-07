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
   * Numeric kiosk id for the PER-KIOSK witteria endpoints —
   * `/api/kiosks/{n}/banners`, `/buttons`, `/subtitles`, stats, update-command.
   * Derived from the kiosk id string (e.g. "W003" → 3), falling back to 1.
   *
   * NOT a small sequence: the digits are whatever the venue's code carries, and
   * KADA is W202 → 202. Nothing here may assume a range (it never did — this is
   * a plain digit extraction — but the note used to say "1–6", which stopped
   * being true at W007 and is now off by two orders of magnitude).
   *
   * It deliberately ignores `shopApiKioskId`: that field is the SHOP endpoint's
   * id, and the two are not always the same number. 제주 W006 is the case that
   * proves it — its shops are filed under 7, but `/api/kiosks/6/banners` carries
   * the banners and 7 has none, so honouring it here would blank the banner rail
   * on every 제주 kiosk provisioned with `-ShopId 7`. See ShopService.kioskNum.
   */
  kioskNum(): number {
    const cfg = this.getConfig();
    const digits = (cfg.kioskId.match(/\d+/)?.[0] ?? '1').replace(/^0+/, '');
    const n = Number(digits || '1');
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
}
