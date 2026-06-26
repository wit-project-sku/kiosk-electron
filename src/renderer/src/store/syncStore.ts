import { create } from 'zustand';
import type { SyncQueueStats } from '@shared/types/data';

const EMPTY: SyncQueueStats = { pending: 0, processing: 0, completed: 0, failed: 0 };

interface SyncState {
  stats: SyncQueueStats;
  /** True while there is outstanding work in the queue. */
  isSyncing: boolean;
  hydrate: (stats: SyncQueueStats) => void;
}

/**
 * Runtime indicator of background sync progress. Driven by the
 * `SyncStatsChanged` broadcast from the main process — this is UI status state,
 * not a copy of the sync_queue table.
 */
export const useSyncStore = create<SyncState>((set) => ({
  stats: EMPTY,
  isSyncing: false,
  hydrate: (stats) => set({ stats, isSyncing: stats.pending > 0 || stats.processing > 0 }),
}));
