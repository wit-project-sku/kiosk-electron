/** Weather glyph art (sun, sun_cloud, cloud, cloud_rain, cloud_snow, cloud_thunder). */
const modules = import.meta.glob('./*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function weatherIconUrl(name: string): string | undefined {
  return modules[`./${name}.png`];
}

/** Map an OpenWeatherMap icon code / condition to a glyph file name. */
export function weatherIconName(icon?: string, main?: string): string {
  const c = (icon ?? '').slice(0, 2);
  if (c === '01') return 'sun';
  if (c === '02') return 'sun_cloud';
  if (c === '03' || c === '04') return 'cloud';
  if (c === '09' || c === '10') return 'cloud_rain';
  if (c === '11') return 'cloud_thunder';
  if (c === '13') return 'cloud_snow';
  const m = (main ?? '').toLowerCase();
  if (m.includes('rain') || m.includes('drizzle')) return 'cloud_rain';
  if (m.includes('snow')) return 'cloud_snow';
  if (m.includes('thunder')) return 'cloud_thunder';
  if (m.includes('cloud')) return 'sun_cloud';
  return 'sun';
}
