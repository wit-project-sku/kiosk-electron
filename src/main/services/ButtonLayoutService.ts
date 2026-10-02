import type { KioskButton } from '@shared/types/buttons';
import { createLogger } from '@main/core/logger';
import type { LocalCacheService } from '@main/services/LocalCacheService';
import type { KioskService } from '@main/services/KioskService';

const log = createLogger('button-layout-service');
/**
 * Cache key for this kiosk's button layout.
 *
 * ★ Kiosk-scoped since 2026-09-29. It used to be the bare string `'buttons'`,
 * one row for the whole machine, so the LAST kiosk id to sync successfully owned
 * it. Re-provisioning (or the operator DEV location switcher, see
 * OPERATOR_DEV_MODE) therefore left the previous venue's layout in place until
 * the next successful refresh — and if the API was unreachable, indefinitely.
 * Observed on a W003 남인사마당 machine whose cache held a 제주 kiosk's 21 rows
 * ('제주' 뭐하지, 제주도 이벤트, …), which drives the home grid's ordering and the
 * 지도 ⇄ 기부 swap. Keying by kiosk makes a stale entry unreachable rather than
 * wrong; the old bare-'buttons' row is simply never read again.
 */
const cacheKeyFor = (kioskNum: number): string => `buttons:${kioskNum}`;
const DEFAULT_API_BASE = 'https://api-v3.witteria.com';

/**
 * Fetches the home button layout from the witteria API and caches it in SQLite
 * so the kiosk reads it instantly and works offline. Refreshed on launch ONLY —
 * unlike the shop catalogue, this is NOT re-pulled during the nightly sync. The
 * Electron main process exits on close and re-runs on reopen, so the layout is
 * only refreshed when the app is closed and reopened; otherwise it serves cache.
 *
 * The renderer uses each button's `line`/`position`/`span` to place the existing
 * (local-asset, sheet-labelled) home tiles — icons and labels are unchanged.
 *
 * Env:
 *   BUTTONS_API_URL     — full endpoint override (wins if set)
 *   WITTERIA_API_BASE   — shared API base, default https://api-v3.witteria.com
 *
 * The API kiosk id is read per-machine from electron-store (shopApiKioskId),
 * set via provision-kiosk.ps1 — see KioskService.kioskNum().
 */
export class ButtonLayoutService {
  constructor(
    private readonly cache: LocalCacheService,
    private readonly kiosk: KioskService,
  ) {}

  private baseUrl(): string {
    if (process.env['BUTTONS_API_URL']) return process.env['BUTTONS_API_URL'];
    const base = (process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE).replace(/\/+$/, '');
    return `${base}/api/kiosks`;
  }

  /** Cached buttons (from the last successful refresh). Empty until first sync. */
  list(): KioskButton[] {
    const cached = this.cache.get(cacheKeyFor(this.kiosk.kioskNum()));
    const buttons = cached?.data?.['buttons'];
    return Array.isArray(buttons) ? (buttons as KioskButton[]) : [];
  }

  /** Pull the full button layout for this kiosk and cache it. */
  async refresh(): Promise<number> {
    const region = this.kiosk.region();
    if (!region) return this.list().length;
    const url = `${this.baseUrl()}/${region}/buttons/v2`;
    log.info('Fetching buttons from API', { url, kioskId: this.kiosk.getConfig().kioskId, region });
    try {
      const res = await fetch(url);
      log.info('Buttons API responded', { status: res.status, ok: res.ok });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data?: KioskButton[] };
      const buttons = Array.isArray(json.data) ? json.data : [];
      // Dump every row's placement fields so a CMS reorder is visible in the log
      // without needing to re-fetch the API by hand.
      log.info(
        'Buttons API rows',
        buttons
          .slice()
          .sort((a, b) => a.line - b.line || a.position - b.position)
          .map((b) => ({
            id: b.id,
            name: b.buttonName,
            placement: b.placement,
            line: b.line,
            position: b.position,
            span: b.span,
          })),
      );
      if (buttons.length > 0) {
        this.cache.upsert(cacheKeyFor(this.kiosk.kioskNum()), { buttons }, 'buttons_api');
        log.info('Buttons cached from API', { count: buttons.length });
      } else {
        log.warn('Buttons API returned no rows', { url });
      }
      return buttons.length;
    } catch (error) {
      log.warn('Buttons refresh failed (using cached)', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.list().length;
    }
  }
}
