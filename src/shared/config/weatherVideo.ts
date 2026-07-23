import type { WeatherSnapshot } from '../types/weather';

/**
 * The three weather clips every kiosk's subtitles API carries (playKey →
 * video + per-language subtitle):
 *
 *  - `Weather_Rain`  — precipitation. The copy covers rain AND snow ("비(눈)이
 *                      내린다고 해요 / 우산 꼭 챙기시고요"), so snow maps here too.
 *  - `Weather_Cold`  — cold but dry ("옷을 따뜻하게 입고…").
 *  - `Weather_Sunny` — the fair-weather default ("화창하고 맑아요").
 *
 * Tapping the home weather box plays the clip that matches the CURRENT weather
 * instead of just advancing to the next idle clip — the box shows today's
 * condition, so the video it triggers should talk about that condition.
 */
export type WeatherPlayKey = 'Weather_Rain' | 'Weather_Cold' | 'Weather_Sunny';

/** At or below this °C the cold clip wins over the fair-weather one. */
const COLD_MAX_C = 5;

/**
 * OpenWeatherMap icon-code prefixes meaning precipitation — 09 drizzle,
 * 10 rain, 11 thunderstorm, 13 snow. Same prefixes the header glyph keys off
 * (see `weatherIconName`), so the box art and the clip always agree.
 */
const PRECIPITATION_ICONS = new Set(['09', '10', '11', '13']);

/** Condition groups (`main`) meaning precipitation, when the icon code is
 *  missing or unrecognised. */
const PRECIPITATION_RE = /rain|drizzle|snow|thunder|sleet/i;

/**
 * Pick the weather clip for a snapshot. Precipitation wins over cold: telling
 * someone to bring an umbrella is more actionable than telling them to dress
 * warmly, and the rain copy already mentions snow. Everything that is neither
 * wet nor cold falls through to Sunny — the API offers no fourth bucket.
 *
 * Returns null when there is no snapshot yet (weather never fetched, and no
 * SQLite cache to hydrate from), so callers can leave the display alone rather
 * than claim a condition we don't know.
 */
export function weatherPlayKey(weather: WeatherSnapshot | null | undefined): WeatherPlayKey | null {
  if (!weather) return null;
  const icon = (weather.icon ?? '').slice(0, 2);
  const wet = icon
    ? PRECIPITATION_ICONS.has(icon)
    : PRECIPITATION_RE.test(weather.main ?? '');
  if (wet) return 'Weather_Rain';
  return weather.tempC <= COLD_MAX_C ? 'Weather_Cold' : 'Weather_Sunny';
}
