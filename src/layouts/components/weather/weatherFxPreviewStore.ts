import { create } from 'zustand';
import type { WeatherEffectMode } from './weatherEffectMode';

/**
 * Preview override for ambient weather FX. `null` = follow live OpenWeatherMap.
 * Used so we can walk rain → sun → clouds on-device without waiting on the sky.
 */
export type WeatherFxPreview = WeatherEffectMode | null;

/** Cycle order for the weather-box long-press tester. */
export const WEATHER_FX_PREVIEW_CYCLE: WeatherEffectMode[] = [
  'sun',
  'clouds',
  'rain',
  'storm',
  'snow',
];

interface WeatherFxPreviewState {
  preview: WeatherFxPreview;
  setPreview: (preview: WeatherFxPreview) => void;
  /**
   * Advance preview: sun → clouds → rain → storm → snow → live (cleared).
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
    // If on the last mode (snow), drop the override so the real sky drives FX again.
    if (cur === 'snow') {
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
    case 'sun':
      return 'SUNNY';
    case 'clouds':
      return 'CLOUDS';
    case 'rain':
      return 'RAIN';
    case 'storm':
      return 'STORM';
    case 'snow':
      return 'SNOW';
    case 'none':
      return 'CLEAR';
  }
}
