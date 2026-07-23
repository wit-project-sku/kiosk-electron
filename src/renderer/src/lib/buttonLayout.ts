import { useMemo } from 'react';
import type { KioskButton } from '@shared/types/buttons';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { resolveButton, buttonIdForSlot, type KioskButtonRef } from '@renderer/lib/buttonCatalog';
import { useButtonStore } from '@renderer/store/buttonStore';

/** Identifies a home tile's backing button: its screen key, or an explicit DB
 *  slot when a screen key is shared across tiles (Hwaseong rest_info → 16/17/18). */
export interface TileKey {
  screen: string;
  slot?: number;
}

/** Build the `buttons.button_name` join key for an explicit slot (e.g. #W005_아이콘16). */
function buttonNameForSlot(kioskId: string, slot: number): string {
  return `#${kioskId}_아이콘${String(slot).padStart(2, '0')}`;
}

/** A tile's DB identity used to join it to an API layout row. The layout response
 *  keys by `id` and carries `buttonType`; older/fuller responses also carry
 *  `buttonName`. We resolve all three and match on whichever the response
 *  provides — see {@link useApiTileRows} for the precedence. */
function tileIdentity(
  kioskId: string,
  key: TileKey,
): { id: number | null; name: string | undefined; type: string | undefined } {
  if (key.slot != null) {
    return {
      id: buttonIdForSlot(kioskId, key.slot),
      name: buttonNameForSlot(kioskId, key.slot),
      type: undefined,
    };
  }
  const ref = resolveButton(kioskId, key.screen);
  return { id: ref?.id ?? null, name: ref?.buttonName, type: ref?.buttonType };
}

/**
 * Group a layout's home tiles into rows ordered by the CMS layout
 * (GET /api/kiosks/{id}/buttons), grouped by `line` (row) and sorted by
 * `position` (column).
 *
 * Each tile is matched to its API row by DB `id` first, then `buttonName`, then
 * `buttonType`. The buttonType pass is what carries rows that have no id in the
 * static mirror — 기부, whose id differs per API environment (see buttonCatalog's
 * `dynamicId`). Today's responses carry only id/buttonType/line/position/span, so
 * the buttonName pass never fires against them; it remains for fuller responses.
 *
 * A single tile that fails to match drops the WHOLE grid to the authored fallback
 * below, so a tile must only be rendered on kiosks whose CMS actually has its row
 * — that is why the 지도/기부 swap is decided per kiosk (useHasDonationTile)
 * rather than by rendering both and hiding one.
 *
 * IMPORTANT — `line`/`position` are used ONLY for relative ordering, never as CSS
 * grid coordinates: different response variants are 0- or 1-indexed, so absolute
 * values are not portable. The wide flag comes from the caller's own tile config.
 *
 * Returns `null` — so the caller keeps its authored order — when nothing is
 * cached yet, a tile has no matching API row, or two tiles collide on one cell.
 * That keeps the home grid safe offline and never half-applied.
 */
export function useApiTileRows<T>(
  kioskId: string,
  tiles: readonly T[],
  keyOf: (tile: T) => TileKey,
): T[][] | null {
  const buttons = useButtonStore((s) => s.buttons);
  return useMemo(() => {
    const tag = `[buttonLayout:${kioskId}]`;
    if (buttons.length === 0) {
      console.info(`${tag} no cached buttons yet — using authored order`);
      return null;
    }
    const byId = new Map<number, KioskButton>(buttons.map((b) => [b.id, b]));
    const byName = new Map<string, KioskButton>(
      buttons.filter((b) => b.buttonName).map((b) => [b.buttonName as string, b]),
    );
    // buttonType → row, but ONLY for types that appear exactly once: a duplicate
    // type identifies nothing, and silently picking one row would misplace a tile.
    const byType = new Map<string, KioskButton | null>();
    for (const b of buttons) {
      if (!b.buttonType) continue;
      byType.set(b.buttonType, byType.has(b.buttonType) ? null : b);
    }
    const rows = new Map<number, { col: number; tile: T }[]>();
    const seen = new Set<string>();
    for (const tile of tiles) {
      const key = keyOf(tile);
      const { id, name, type } = tileIdentity(kioskId, key);
      const b =
        (id != null ? byId.get(id) : undefined) ??
        (name != null ? byName.get(name) : undefined) ??
        (type != null ? byType.get(type) ?? undefined : undefined);
      if (!b) {
        console.warn(`${tag} FALLBACK — no API row for tile`, {
          key,
          expectedId: id,
          expectedName: name,
          expectedType: type,
        });
        return null;
      }
      const cell = `${b.line}:${b.position}`;
      if (seen.has(cell)) {
        console.warn(`${tag} FALLBACK — collision`, { key, cell, buttonId: b.id });
        return null;
      }
      seen.add(cell);
      const list = rows.get(b.line) ?? [];
      list.push({ col: b.position, tile });
      rows.set(b.line, list);
    }
    const result = [...rows.entries()]
      .sort(([a], [b]) => a - b)
      .map(([line, list]) => ({ line, cols: list.sort((a, b) => a.col - b.col) }));
    console.info(
      `${tag} applied CMS order`,
      result.map((r) => ({ line: r.line, order: r.cols.map((c) => `${JSON.stringify(keyOf(c.tile))}@${c.col}`) })),
    );
    return result.map((r) => r.cols.map((e) => e.tile));
  }, [buttons, kioskId, tiles, keyOf]);
}

/**
 * Flattened {@link useApiTileRows}: the tiles in CMS order for auto-flow grids
 * (Insadong/Osan render into a 4-column CSS grid, so a plain reorder — with the
 * wide tile keeping its `span 2` class — reproduces the layout). Falls back to
 * the authored `tiles` when no layout is cached.
 */
export function useOrderedTiles<T>(
  kioskId: string,
  tiles: readonly T[],
  keyOf: (tile: T) => TileKey,
): readonly T[] {
  const rows = useApiTileRows(kioskId, tiles, keyOf);
  return rows ? rows.flat() : tiles;
}

/**
 * Resolver returning a button's analytics identity, preferring the LIVE API `id`
 * (matched by `buttonName`, then by unique `buttonType`) over the hardcoded
 * `BUTTON_IDS` mirror in buttonCatalog — so click / dwell / menu-touch stats stay
 * correct even if the `buttons` table is reseeded and its primary keys change.
 * Falls back to the static id when the API layout isn't cached yet (offline /
 * before first sync).
 *
 * The buttonType pass is required for `dynamicId` rows such as 기부, which have no
 * static id at all: matching by name alone would log them as `id: null`, since
 * today's API response carries no buttonName field.
 */
export function useResolveButton(kioskId: string): (key: string) => KioskButtonRef | null {
  const buttons = useButtonStore((s) => s.buttons);
  return useMemo(() => {
    const idByName = new Map<string, number>(
      buttons.filter((b) => b.buttonName).map((b) => [b.buttonName as string, b.id]),
    );
    // Ambiguous types identify nothing — a duplicate must not silently pick a row.
    const idByType = new Map<string, number | null>();
    for (const b of buttons) {
      if (!b.buttonType) continue;
      idByType.set(b.buttonType, idByType.has(b.buttonType) ? null : b.id);
    }
    return (key: string) => {
      const ref = resolveButton(kioskId, key);
      if (!ref) return null;
      const apiId = idByName.get(ref.buttonName) ?? idByType.get(ref.buttonType) ?? null;
      return apiId != null ? { ...ref, id: apiId } : ref;
    };
  }, [buttons, kioskId]);
}

/** DB `button_type` of the 기부 row — the only join key the CMS exposes for it. */
const DONATION_BUTTON_TYPE = '기부';

/**
 * Whether this kiosk should render the 기부 tile in place of its 지도 tile.
 *
 * The live CMS is the authority: 기부 shows wherever the buttons API returns a
 * 기부 row (today W003/W004/W005, consistent across production and stage), so
 * adding or removing the row in the CMS moves the tile with no code change.
 *
 * Until the layout is cached — first boot, or offline — the API says nothing, and
 * we fall back to the authored `hasDonation` flag rather than guessing `false`,
 * which would flash the wrong tile on every cold start.
 */
export function useHasDonationTile(kioskId: string): boolean {
  const buttons = useButtonStore((s) => s.buttons);
  return useMemo(() => {
    if (buttons.length === 0) return getKioskLocation(kioskId).hasDonation;
    return buttons.some((b) => b.buttonType === DONATION_BUTTON_TYPE);
  }, [buttons, kioskId]);
}
