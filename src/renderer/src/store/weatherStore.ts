import { create } from 'zustand';
import type { WeatherForecast, WeatherSnapshot } from '@shared/types/weather';

interface WeatherState {
  weather: WeatherSnapshot | null;
  forecast: WeatherForecast | null;
  setWeather: (weather: WeatherSnapshot | null) => void;
  setForecast: (forecast: WeatherForecast | null) => void;
}

/**
 * Latest weather snapshot and multi-day outlook mirrored from the main process.
 * Populated by {@link useWeatherSync}; the snapshot is read by the kiosk header,
 * the outlook by the 제주 weather panel. SQLite/main remain the source of truth —
 * this is a UI mirror only.
 */
export const useWeatherStore = create<WeatherState>((set) => ({
  weather: null,
  forecast: null,
  setWeather: (weather) => set({ weather }),
  setForecast: (forecast) => set({ forecast }),
}));
