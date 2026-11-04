import type { KioskConfig, KioskTheme } from '@shared/types/kiosk';
import { getKioskRegion, type ContentRegion } from '@shared/config/kioskLocations';
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
   * being true at W009 and is now off by two orders of magnitude).
   *
   * It deliberately ignores `shopApiKioskId`: that field is the SHOP endpoint's
   * id, and the two are not always the same number. 제주공항 used to prove it —
   * shops filed under 7 while `/api/kiosks/6/banners` carried the banners — so
   * honouring the shop id here would blank the banner rail. See ShopService.
   *
   * 2026-10-26 device ids: W008 → 8 (제주공항), W009 → 9 (여객터미널), W010 → 10
   * (유산본부). 6 is the office rig WITH-I-001, not one of these venues.
   */
  kioskNum(): number {
    const cfg = this.getConfig();
    const digits = (cfg.kioskId.match(/\d+/)?.[0] ?? '1').replace(/^0+/, '');
    const n = Number(digits || '1');
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  /**
   * Content branch for the v2 endpoints (`/api/kiosks/{region}/…/v2`,
   * `?region=`), derived from the kiosk id — W005 → HWASEONG. `null` for a venue
   * with no CMS content (KADA); callers skip the request then.
   *
   * v2 keys content by venue, not by device number, so this replaces
   * {@link kioskNum} for every endpoint that moved to v2. `kioskNum` stays for
   * the ones that did not (stats, update-command, footfall).
   */
  region(): ContentRegion | null {
    return getKioskRegion(this.getConfig().kioskId);
  }
}
