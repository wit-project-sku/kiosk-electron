import type { KioskConfig, KioskTheme } from '@shared/types/kiosk';
import { getKioskRegion, type ContentRegion } from '@shared/config/kioskLocations';
import { kioskConfigStore } from '@main/core/KioskConfigStore';
import { kioskNumOf } from '@shared/config/testRig';
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
    return kioskNumOf(this.getConfig().kioskId);
  }

  /**
   * Who this machine is to the server — the provisioned id, even on the test rig
   * (W200 → 200) where {@link kioskNum} follows the preview site. Used for the
   * liveness signal (update-command) and crash reports only.
   */
  identityNum(): number {
    const cfg = this.getConfig();
    return kioskNumOf(cfg.identityKioskId ?? cfg.kioskId);
  }

  /** The provisioned kiosk code (W200 on the test rig). */
  identityCode(): string {
    const cfg = this.getConfig();
    return cfg.identityKioskId ?? cfg.kioskId;
  }

  /**
   * Content branch for the v2 endpoints (`/api/kiosks/{region}/…/v2`,
   * `?region=`), derived from the kiosk id — W005 → HWASEONG. `null` for a venue
   * with no CMS content (KADA); callers skip the request then.
   *
   * v2 keys content by venue, not by device number, so this replaces
   * {@link kioskNum} for every endpoint that moved to v2. `kioskNum` stays for
   * the ones that did not (stats, update-command, footfall, 인사동 courses).
   */
  region(): ContentRegion | null {
    return getKioskRegion(this.getConfig().kioskId);
  }
}
