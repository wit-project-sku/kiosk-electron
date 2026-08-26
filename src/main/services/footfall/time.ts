/**
 * Local-time helpers for 유동인구 bucketing.
 *
 * Everything here is deliberately LOCAL, never UTC. "How many people walked
 * past between 2pm and 3pm" is a question about the wall clock on the wall
 * behind the kiosk; bucketing in UTC would split every Korean business day
 * across two dates and make the backend's daily report wrong by nine hours.
 * The offset is carried in the string so the backend can still order events
 * globally without having to know where the machine is.
 */

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `+09:00` for the given instant, from the machine's own tz rules. */
function offsetSuffix(date: Date): string {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** `YYYY-MM-DD` in local time. */
export function localDateOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Start of the local hour containing `date`, e.g. `2026-08-24T14:00:00+09:00`. */
export function bucketStartOf(date: Date): string {
  return `${localDateOf(date)}T${pad(date.getHours())}:00:00${offsetSuffix(date)}`;
}

/** Full local ISO-8601 with offset, e.g. `2026-08-24T14:53:26+09:00`. */
export function localIso(date: Date = new Date()): string {
  return (
    `${localDateOf(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:` +
    `${pad(date.getSeconds())}${offsetSuffix(date)}`
  );
}

/** `YYYY-MM-DD` `days` before `from`, used for the retention cutoff. */
export function localDateDaysBefore(days: number, from: Date = new Date()): string {
  const date = new Date(from);
  date.setDate(date.getDate() - days);
  return localDateOf(date);
}

/**
 * Milliseconds until the next local `hour:minute`, always in the future.
 *
 * Recomputed from `new Date()` on every reschedule rather than by adding 24h to
 * the last fire, so a kiosk that was asleep, or whose clock was corrected by
 * NTP after a battery-flat boot, lands on the right wall-clock time tonight
 * instead of drifting a little further every day.
 */
export function msUntilLocalTime(hour: number, minute: number, now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}
