/**
 * JEJU POINTS — the running total across the three waiting games.
 *
 * ── Session-scoped on purpose ─────────────────────────────────────────
 * Nothing here is persisted. This is a public kiosk with no login: a total that
 * survived a session would belong to whoever walked up next, which is worse
 * than useless — it would show a stranger's score as your own. The store is
 * reset when the game hub mounts (a new photo session) and again when it
 * unmounts, so a total only ever describes the person standing there.
 *
 * That is also why this is NOT in electron-store or the photo store: it is
 * throwaway UI state with a lifetime shorter than either.
 *
 * Kept as a zustand store rather than React state because the hub, each game's
 * result card and the header pill all read it, and threading it through three
 * component layers to no benefit is how prop drilling starts.
 */
import { create } from 'zustand';
import type { JejuGameId } from './gameTypes';

interface JejuPointsState {
  /** Best run per game — not the sum of every attempt. */
  byGame: Partial<Record<JejuGameId, number>>;
  /**
   * Bank a completed run.
   *
   * Takes the MAXIMUM, not the sum. A visitor who plays 감귤 받기 four times
   * while the AI works should see their best catch, not a number inflated by
   * repetition — the total is a souvenir, and a souvenir that only goes up with
   * grinding says nothing about them. It also keeps the total bounded, which
   * matters on a screen where the digits have a fixed slot.
   */
  award: (game: JejuGameId, points: number) => void;
  /** Wipe the board for a new visitor. */
  reset: () => void;
}

export const useJejuPointsStore = create<JejuPointsState>((set) => ({
  byGame: {},

  award: (game, points) =>
    set((state) => {
      const best = state.byGame[game] ?? 0;
      if (points <= best) return state;
      return { byGame: { ...state.byGame, [game]: points } };
    }),

  reset: () => set({ byGame: {} }),
}));

/**
 * Hook: the total across every game played this session.
 *
 * Selects the map and sums in the component rather than storing a `total`
 * field, so the two can never disagree.
 */
export function useJejuPointsTotal(): number {
  const byGame = useJejuPointsStore((s) => s.byGame);
  return Object.values(byGame).reduce<number>((sum, n) => sum + (n ?? 0), 0);
}
