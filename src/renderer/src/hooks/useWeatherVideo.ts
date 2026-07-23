import { useCallback } from 'react';
import { weatherPlayKey } from '@shared/config/weatherVideo';
import { useWeatherStore } from '@renderer/store/weatherStore';

/**
 * Home weather box → customer display, shared by every kiosk layout.
 *
 * Returns a tap handler that plays the clip for the CURRENT condition
 * (Weather_Rain / Weather_Cold / Weather_Sunny) rather than advancing to the
 * next idle clip: the box shows today's weather, so the video it triggers
 * should be about today's weather — tap it on a rainy day and 인사 tells you to
 * bring an umbrella.
 *
 * No-ops until a weather snapshot exists (never fetched, nothing cached to
 * hydrate from) — with no condition to match, doing nothing beats guessing one.
 */
export function useWeatherVideo(): () => void {
  const weather = useWeatherStore((s) => s.weather);

  return useCallback(() => {
    const key = weatherPlayKey(weather);
    if (!key) return;
    void window.api.kiosk.playWeatherVideo(key);
  }, [weather]);
}
