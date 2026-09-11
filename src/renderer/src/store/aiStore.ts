import { create } from 'zustand';
import type { JejuPickerPlan } from '@shared/types/jejuCourse';

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
  /**
   * How the visitor entered the 제주 course flow from the 뭐하지 landing (Figma
   * 7019:17890): 'custom' through AI 맞춤 추천 코스 → questionnaire → result →
   * detail, 'theme' by tapping a themed course card straight into the detail.
   * Decides where 뒤로 lands from the detail. '' before any entry, and on
   * every other layout.
   */
  entry: '' | 'custom' | 'theme';
  setEntry: (entry: '' | 'custom' | 'theme') => void;
  /**
   * One-shot: set by the result page's 뒤로 so the landing re-opens on the
   * questionnaire the visitor just filled in rather than on the course picker.
   * JejuAiSearch consumes and clears it on mount — a fresh entry from home never
   * sets it, so home always lands on the picker.
   */
  resumeQuestions: boolean;
  setResumeQuestions: (resume: boolean) => void;
  /**
   * The 지역 picked on the themed questionnaire's map (Figma 7088:24139), as a
   * JejuRegionId. ★ STORED, NOT SENT: the recommend API has no region field —
   * see jejuRegionMap.ts for why nothing is guessed onto the wire.
   */
  region: string;
  setRegion: (region: string) => void;
  /**
   * The 커스텀 코스 plan the picker built on the questionnaire
   * (`POST /api/jeju/courses/picker`), as it stood when 코스 추천받기 was
   * pressed. The course detail draws THIS instead of asking /recommend, so the
   * visitor sees exactly the places and times they watched fill the day. Null
   * when the picker was unreachable (the detail then falls back to /recommend),
   * and on every themed route.
   */
  pickerPlan: JejuPickerPlan | null;
  setPickerPlan: (plan: JejuPickerPlan | null) => void;
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
  entry: '',
  setEntry: (entry) => set({ entry }),
  resumeQuestions: false,
  setResumeQuestions: (resumeQuestions) => set({ resumeQuestions }),
  region: '',
  setRegion: (region) => set({ region }),
  pickerPlan: null,
  setPickerPlan: (pickerPlan) => set({ pickerPlan }),
}));
