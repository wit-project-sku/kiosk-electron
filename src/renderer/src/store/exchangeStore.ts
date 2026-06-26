import { create } from 'zustand';
import type { ExchangeSnapshot } from '@shared/types/exchange';

interface ExchangeState {
  exchange: ExchangeSnapshot | null;
  setExchange: (exchange: ExchangeSnapshot | null) => void;
}

/**
 * Latest FX snapshot mirrored from the main process. Populated by
 * {@link useExchangeSync}; read by the 환율 screen. SQLite/main remain the
 * source of truth — this is a UI mirror only.
 */
export const useExchangeStore = create<ExchangeState>((set) => ({
  exchange: null,
  setExchange: (exchange) => set({ exchange }),
}));
