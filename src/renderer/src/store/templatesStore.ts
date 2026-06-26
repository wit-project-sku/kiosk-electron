import { create } from 'zustand';
import type { Template } from '@shared/types/data';

interface TemplatesState {
  templates: Template[];
  /** Populate from the startup bootstrap payload (memory cache). */
  hydrate: (templates: Template[]) => void;
  byKey: (key: string) => Template | undefined;
}

/**
 * In-memory cache for templates — rarely-changing configuration loaded once at
 * startup. Pages read templates from here instantly instead of querying SQLite
 * on every navigation. This is config-cache only; it is NOT a database mirror.
 */
export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  templates: [],
  hydrate: (templates) => set({ templates }),
  byKey: (key) => get().templates.find((t) => t.key === key),
}));
