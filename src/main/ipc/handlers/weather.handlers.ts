import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/**
 * Registers the weather read channels. Both the current snapshot and the
 * multi-day outlook are produced and refreshed by WeatherService in the main
 * process; the renderer only reads the cached values and subscribes to
 * `WeatherChanged` / `WeatherForecastChanged` (broadcast from WindowManager).
 */
export function registerWeatherHandlers(container: AppContainer): void {
  handle(IpcChannels.WeatherGet, () => container.weather.getCurrent());
  handle(IpcChannels.WeatherForecastGet, () => container.weather.getForecast());
}
