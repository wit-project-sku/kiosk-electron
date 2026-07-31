/**
 * Channel-specific update schedules, all driven by env vars (no hardcoding).
 *
 *  Production (`latest`) — a WEEKLY maintenance window so kiosks don't churn
 *  through updates during business hours:
 *      UPDATE_DAY   (default Friday)   — day name or 0–6 (0=Sun)
 *      UPDATE_TIME  (default 17:00)    — HH:MM, local kiosk time
 *
 *  Beta (`beta`) — a fast polling INTERVAL so testers get builds quickly:
 *      UPDATE_BETA_INTERVAL_MIN (default 15) — minutes between checks
 *
 * All times are LOCAL to the kiosk (Date getters/setters are local time).
 */

import type { UpdateChannel } from '@shared/types/update';

export interface WeeklySchedule {
  kind: 'weekly';
  /** 0=Sunday … 6=Saturday. */
  dayOfWeek: number;
  hour: number;
  minute: number;
}

export interface IntervalSchedule {
  kind: 'interval';
  intervalMs: number;
}

export type UpdateSchedule = WeeklySchedule | IntervalSchedule;

const DAY_ALIASES: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/** Beta poll interval bounds (minutes). Spec asks for ~10–20; allow a bit wider. */
const BETA_MIN_MINUTES = 5;
const BETA_MAX_MINUTES = 240;
const BETA_DEFAULT_MINUTES = 15;

const DEFAULT_DAY = 5; // Friday
const DEFAULT_HOUR = 17; // 17:00
const DEFAULT_MINUTE = 0;

function parseDay(raw: string | undefined, fallback: number): number {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return fallback;
  if (value in DAY_ALIASES) return DAY_ALIASES[value]!;
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : fallback;
}

function parseTime(
  raw: string | undefined,
  fallbackHour: number,
  fallbackMinute: number,
): { hour: number; minute: number } {
  const match = (raw ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { hour: fallbackHour, minute: fallbackMinute };
  const hour = Number.parseInt(match[1]!, 10);
  const minute = Number.parseInt(match[2]!, 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hour: fallbackHour, minute: fallbackMinute };
  }
  return { hour, minute };
}

function parseIntervalMinutes(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt((raw ?? '').trim(), 10);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(BETA_MAX_MINUTES, Math.max(BETA_MIN_MINUTES, n));
}

/** Resolve the schedule for a channel from the environment. */
export function resolveUpdateSchedule(channel: UpdateChannel): UpdateSchedule {
  if (channel === 'beta') {
    const minutes = parseIntervalMinutes(process.env['UPDATE_BETA_INTERVAL_MIN'], BETA_DEFAULT_MINUTES);
    return { kind: 'interval', intervalMs: minutes * 60_000 };
  }
  return {
    kind: 'weekly',
    dayOfWeek: parseDay(process.env['UPDATE_DAY'], DEFAULT_DAY),
    ...parseTime(process.env['UPDATE_TIME'], DEFAULT_HOUR, DEFAULT_MINUTE),
  };
}

/** The window time on the same calendar day as `base`. */
function windowOnDay(base: Date, s: WeeklySchedule): Date {
  const d = new Date(base);
  d.setHours(s.hour, s.minute, 0, 0);
  return d;
}

/**
 * The most recent occurrence of the weekly window at or before `now`. Used to
 * detect a missed window on startup (compare against the last one handled).
 */
export function previousWeeklyWindow(now: Date, s: WeeklySchedule): Date {
  const daysBehind = (now.getDay() - s.dayOfWeek + 7) % 7;
  const candidate = windowOnDay(now, s);
  candidate.setDate(candidate.getDate() - daysBehind);
  // If today IS the window day but the time hasn't arrived yet, step back a week.
  if (candidate.getTime() > now.getTime()) candidate.setDate(candidate.getDate() - 7);
  return candidate;
}

/** The next occurrence of the weekly window strictly after `now`. */
export function nextWeeklyWindow(now: Date, s: WeeklySchedule): Date {
  const daysAhead = (s.dayOfWeek - now.getDay() + 7) % 7;
  const candidate = windowOnDay(now, s);
  candidate.setDate(candidate.getDate() + daysAhead);
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 7);
  return candidate;
}

/** Human-readable schedule summary for logs. */
export function describeSchedule(s: UpdateSchedule): string {
  if (s.kind === 'interval') return `every ${Math.round(s.intervalMs / 60_000)} min`;
  const day = Object.keys(DAY_ALIASES).find((k) => DAY_ALIASES[k] === s.dayOfWeek && k.length > 3) ?? String(s.dayOfWeek);
  const hh = String(s.hour).padStart(2, '0');
  const mm = String(s.minute).padStart(2, '0');
  return `weekly on ${day} at ${hh}:${mm} (local)`;
}
