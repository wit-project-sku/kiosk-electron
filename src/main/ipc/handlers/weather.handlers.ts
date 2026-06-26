import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/**
 * Registers the weather read channel. The snapshot is produced and refreshed by
 * WeatherService in the main process; the renderer only reads the cached value
 * and subscribes to `WeatherChanged` (broadcast from WindowManager).
 */
export function registerWeatherHandlers(container: AppContainer): void {
  handle(IpcChannels.WeatherGet, () => container.weather.getCurrent());
}
