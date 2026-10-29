/**
 * 제주공항 (W008) 시스템 점검 notice — which kiosks show it, whether it is up,
 * and the hidden 5-tap switch staff use to flip between it and the app.
 *
 * The switch is the top-left corner of the screen on BOTH sides: the "JEJU"
 * marker on the home screen, and the same spot (blank sky in the art) on the
 * notice. Five taps within TAP_WINDOW_MS flip it — a single click used to lift
 * the notice for good, which staff hit by accident over TeamViewer and could
 * not undo (2026-10-29). Any pointer counts (TeamViewer mouse or a finger):
 * five quick taps on an empty corner is the guard, not the pointer type.
 *
 * The state survives a reboot (localStorage), same key as before so a kiosk
 * that was already lifted stays lifted.
 */
import { useCallback, useRef } from 'react';

/** 제주 kiosks showing the full-screen 시스템 점검 notice instead of the app. */
export const MAINTENANCE_KIOSKS: ReadonlySet<string> = new Set(['W008']);

/** '1' = lifted (the app shows). Anything else, or missing, = the notice. */
const MAINTENANCE_LIFTED_KEY = 'jeju.maintenanceLifted';

export const TAPS_TO_SWITCH = 5;
export const TAP_WINDOW_MS = 3_000;

export function readMaintenanceLifted(): boolean {
  try {
    return localStorage.getItem(MAINTENANCE_LIFTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeMaintenanceLifted(lifted: boolean): void {
  try {
    localStorage.setItem(MAINTENANCE_LIFTED_KEY, lifted ? '1' : '0');
  } catch {
    // Storage unavailable: the switch holds for this run only.
  }
}

/**
 * Add a tap at `now` to the recent taps and say whether it completes the
 * gesture. Taps older than `windowMs` drop out; on success the list empties so
 * a sixth tap starts a new count instead of flipping straight back.
 */
export function registerTap(
  taps: number[],
  now: number,
  required = TAPS_TO_SWITCH,
  windowMs = TAP_WINDOW_MS,
): { taps: number[]; triggered: boolean } {
  const recent = [...taps.filter((t) => now - t < windowMs), now];
  return recent.length >= required
    ? { taps: [], triggered: true }
    : { taps: recent, triggered: false };
}

/** Pointer-up handler that calls `onTrigger` on the fifth tap within the window. */
export function useMultiTap(onTrigger: () => void): () => void {
  const taps = useRef<number[]>([]);
  return useCallback(() => {
    const next = registerTap(taps.current, Date.now());
    taps.current = next.taps;
    if (next.triggered) onTrigger();
  }, [onTrigger]);
}
