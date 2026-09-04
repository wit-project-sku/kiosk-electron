import { create } from 'zustand';
import type { WeatherEffectMode } from './weatherEffectMode';

/**
 * Preview override for ambient weather FX. `null` = follow live OpenWeatherMap.
 * Used so we can walk rain → sun → clouds on-device without waiting on the sky.
 */
export type WeatherFxPreview = WeatherEffectMode | null;

/** Cycle order for the weather-box long-press tester. */
export const WEATHER_FX_PREVIEW_CYCLE: WeatherEffectMode[] = [
  'clouds',
  'rain',
  'storm',
  'snow',
  'none', // sunny — soft rays only
];

interface WeatherFxPreviewState {
  preview: WeatherFxPreview;
  setPreview: (preview: WeatherFxPreview) => void;
  /**
   * Advance preview: clouds → rain → storm → snow → sun → live (cleared).
   * Returns the new preview value (`null` = following live weather again).
   */
  cyclePreview: () => WeatherFxPreview;
}

export const useWeatherFxPreviewStore = create<WeatherFxPreviewState>((set, get) => ({
  preview: null,
  setPreview: (preview) => set({ preview }),
  cyclePreview: () => {
    const cur = get().preview;
    const list = WEATHER_FX_PREVIEW_CYCLE;
    // After sunny, drop the override so the real sky drives FX again.
    if (cur === 'none') {
      set({ preview: null });
      return null;
    }
    const idx = cur == null ? -1 : list.indexOf(cur);
    const next = list[(idx + 1) % list.length]!;
    set({ preview: next });
    return next;
  },
}));

export function weatherFxLabel(mode: WeatherEffectMode): string {
  switch (mode) {
    case 'clouds':
      return 'CLOUDS';
    case 'rain':
      return 'RAIN';
    case 'storm':
      return 'STORM';
    case 'snow':
      return 'SNOW';
    case 'none':
      return 'SUN';
  }
}
