import { useEffect } from 'react';
import { isOk } from '@shared/types/result';
import { useWeatherStore } from '@renderer/store/weatherStore';

/**
 * Mirrors the main-process weather snapshot and multi-day outlook into the
 * renderer store: reads the cached values once on mount, then subscribes to the
 * 30-minute refresh broadcasts. Call once near the top of the kiosk tree.
 */
export function useWeatherSync(): void {
  const setWeather = useWeatherStore((s) => s.setWeather);
  const setForecast = useWeatherStore((s) => s.setForecast);

  useEffect(() => {
    void window.api.weather.get().then((r) => {
      if (isOk(r)) setWeather(r.value);
    });
    void window.api.weather.getForecast().then((r) => {
      if (isOk(r)) setForecast(r.value);
    });
    const offWeather = window.api.events.onWeatherChanged((snapshot) => setWeather(snapshot));
    const offForecast = window.api.events.onWeatherForecastChanged((forecast) =>
      setForecast(forecast),
    );
    return () => {
      offWeather();
      offForecast();
    };
  }, [setWeather, setForecast]);
}
