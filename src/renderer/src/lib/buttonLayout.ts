import { useMemo } from 'react';
import type { KioskButton } from '@shared/types/buttons';
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
 *  keys by `id`; older/fuller responses also carry `buttonName`, so we resolve
 *  both and match on whichever the response provides. */
function tileIdentity(kioskId: string, key: TileKey): { id: number | null; name: string | undefined } {
  if (key.slot != null) {
    return { id: buttonIdForSlot(kioskId, key.slot), name: buttonNameForSlot(kioskId, key.slot) };
  }
  const ref = resolveButton(kioskId, key.screen);
  return { id: ref?.id ?? null, name: ref?.buttonName };
}

/**
 * Group a layout's home tiles into rows ordered by the CMS layout
 * (GET /api/kiosks/{id}/buttons). Each tile is matched to its API row by its DB
 * `id` (the layout response keys by id; buttonName is used as a fallback), then
 * grouped by `line` (row) and sorted by `position` (column).
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
    const rows = new Map<number, { col: number; tile: T }[]>();
    const seen = new Set<string>();
    for (const tile of tiles) {
      const key = keyOf(tile);
      const { id, name } = tileIdentity(kioskId, key);
      const b = (id != null ? byId.get(id) : undefined) ?? (name != null ? byName.get(name) : undefined);
      if (!b) {
        console.warn(`${tag} FALLBACK — no API row for tile`, { key, expectedId: id, expectedName: name });
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
 * (matched by `buttonName`) over the hardcoded `BUTTON_IDS` mirror in
 * buttonCatalog — so click / dwell / menu-touch stats stay correct even if the
 * `buttons` table is reseeded and its primary keys change. Falls back to the
 * static id when the API layout isn't cached yet (offline / before first sync).
 */
export function useResolveButton(kioskId: string): (key: string) => KioskButtonRef | null {
  const buttons = useButtonStore((s) => s.buttons);
  return useMemo(() => {
    const idByName = new Map<string, number>(
      buttons.filter((b) => b.buttonName).map((b) => [b.buttonName as string, b.id]),
    );
    return (key: string) => {
      const ref = resolveButton(kioskId, key);
      if (!ref) return null;
      const apiId = idByName.get(ref.buttonName);
      return apiId != null ? { ...ref, id: apiId } : ref;
    };
  }, [buttons, kioskId]);
}
