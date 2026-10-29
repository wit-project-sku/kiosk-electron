/**
 * 제주공항 (W008) 시스템 점검 notice — which kiosks show it, whether it is up,
 * and the hidden switch staff use to flip between it and the app.
 *
 * Five MOUSE clicks within TAP_WINDOW_MS flip it: on the home screen, the
 * "JEJU" marker turns the notice on; on the notice, the leftmost of the three
 * tangerines at the top right turns it off. A single click used to lift the
 * notice for good and there was no way back (2026-10-29).
 *
 * Mouse only — staff drive the kiosk over TeamViewer, which injects mouse
 * input, while the kiosk's touch panel reports finger taps as pointerType
 * 'touch'. Pointer events, not click/mousedown: Windows follows every tap with
 * emulated mouse events, which would otherwise read as a mouse. A visitor's
 * finger can never flip it.
 *
 * The state survives a reboot (localStorage), same key as before so a kiosk
 * that was already lifted stays lifted.
 */
import { useCallback, useRef, type PointerEvent } from 'react';

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

/** Pointer-up handler that calls `onTrigger` on the fifth MOUSE click within the
 *  window. Touch and pen are ignored and do not count towards the five. */
export function useMultiTap(onTrigger: () => void): (e: PointerEvent<HTMLElement>) => void {
  const taps = useRef<number[]>([]);
  return useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'mouse') return;
      const next = registerTap(taps.current, Date.now());
      taps.current = next.taps;
      if (next.triggered) onTrigger();
    },
    [onTrigger],
  );
}
