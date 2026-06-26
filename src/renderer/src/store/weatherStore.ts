import { create } from 'zustand';
import type { WeatherSnapshot } from '@shared/types/weather';

interface WeatherState {
  weather: WeatherSnapshot | null;
  setWeather: (weather: WeatherSnapshot | null) => void;
}

/**
 * Latest weather snapshot mirrored from the main process. Populated by
 * {@link useWeatherSync}; read by the kiosk header. SQLite/main remain the
 * source of truth — this is a UI mirror only.
 */
export const useWeatherStore = create<WeatherState>((set) => ({
  weather: null,
  setWeather: (weather) => set({ weather }),
}));
