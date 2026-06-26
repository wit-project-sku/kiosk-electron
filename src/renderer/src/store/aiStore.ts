import { create } from 'zustand';

interface AiState {
  /** Interest categories the user picked on the questionnaire (max 3, in order). */
  interests: string[];
  setInterests: (interests: string[]) => void;
}

/** Carries the AI-search selections from the questionnaire into the result page. */
export const useAiStore = create<AiState>((set) => ({
  interests: [],
  setInterests: (interests) => set({ interests }),
}));
