import { create } from 'zustand';

interface SearchState {
  /** The active query shown/used on the 검색 results screen. */
  query: string;
  setQuery: (query: string) => void;
}

/** Holds the query carried from the home search bar into the 검색 screen. */
export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  setQuery: (query) => set({ query }),
}));
