import { weatherIconName } from '@renderer/assets/weather';
import type { WeatherSnapshot } from '@shared/types/weather';

/** Ambient home-screen weather FX. Clear/sunny stays empty so the photo bg wins. */
export type WeatherEffectMode = 'none' | 'clouds' | 'rain' | 'storm' | 'snow';

/**
 * Map the live snapshot to an ambient FX mode. Same glyph rules as the weather
 * box (`weatherIconName`), so the icon and the overlay always agree.
 */
export function weatherEffectMode(
  weather: WeatherSnapshot | null | undefined,
): WeatherEffectMode {
  if (!weather) return 'none';
  const glyph = weatherIconName(weather.icon, weather.main);
  switch (glyph) {
    case 'cloud':
    case 'sun_cloud':
      return 'clouds';
    case 'cloud_rain':
      return 'rain';
    case 'cloud_thunder':
      return 'storm';
    case 'cloud_snow':
      return 'snow';
    default:
      return 'none';
  }
}
