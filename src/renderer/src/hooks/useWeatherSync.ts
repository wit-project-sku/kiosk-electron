import { useEffect } from 'react';
import { isOk } from '@shared/types/result';
import { useWeatherStore } from '@renderer/store/weatherStore';

/**
 * Mirrors the main-process weather snapshot into the renderer store: reads the
 * cached value once on mount, then subscribes to 30-minute refresh broadcasts.
 * Call once near the top of the kiosk tree.
 */
export function useWeatherSync(): void {
  const setWeather = useWeatherStore((s) => s.setWeather);

  useEffect(() => {
    void window.api.weather.get().then((r) => {
      if (isOk(r)) setWeather(r.value);
    });
    const off = window.api.events.onWeatherChanged((snapshot) => setWeather(snapshot));
    return off;
  }, [setWeather]);
}
