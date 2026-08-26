import { create } from 'zustand';

interface AiState {
  /** Interest categories the user picked on the questionnaire (max 3, in order). */
  interests: string[];
  setInterests: (interests: string[]) => void;
  /**
   * Course key chosen on the result screen, carried into the course detail.
   * Only 제주 has a course chooser today (Osan/Hwaseong build their courses
   * directly from `interests`), so this stays empty on the other layouts.
   */
  course: string;
  setCourse: (course: string) => void;
  /**
   * The other questionnaire answers, kept so the course detail can show what the
   * visitor actually picked instead of a hardcoded value (제주's summary bar
   * shows 이동수단). Osan/Hwaseong collect these too but discard them, so they
   * stay empty there.
   */
  visitors: string;
  stay: string;
  transport: string;
  setAnswers: (answers: { visitors: string; stay: string; transport: string }) => void;
}

/** Carries the AI-search selections from the questionnaire into the result page. */
export const useAiStore = create<AiState>((set) => ({
  interests: [],
  setInterests: (interests) => set({ interests }),
  course: '',
  setCourse: (course) => set({ course }),
  visitors: '',
  stay: '',
  transport: '',
  setAnswers: (answers) => set(answers),
}));
