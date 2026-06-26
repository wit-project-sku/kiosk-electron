import { useEffect, useRef } from 'react';

export interface UseInactivityResetOptions {
  /** When false the timer is disabled (no listeners, no countdown). */
  enabled?: boolean;
  /** Idle duration before `onIdle` fires, in milliseconds. */
  timeoutMs: number;
  /** Invoked once the kiosk has been idle for `timeoutMs`. */
  onIdle: () => void;
}

/** Interaction events that count as "the visitor is still using the kiosk". */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
];

/**
 * Kiosk attract-loop guard: invokes `onIdle` after `timeoutMs` with no user
 * interaction, and re-arms the countdown on any pointer/touch/key/wheel
 * activity on the host window.
 *
 * NOTE: interactions *inside* an Electron <webview> guest (위드마켓 / 인사동
 * 이벤트 / TAX-FREE) run in a separate process and do not bubble to the host
 * window, so they do not reset this timer on their own.
 */
export function useInactivityReset({ enabled = true, timeoutMs, onIdle }: UseInactivityResetOptions): void {
  // Keep the latest callback without re-subscribing listeners every render.
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) return;

    let timer = 0;
    const arm = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => onIdleRef.current(), timeoutMs);
    };

    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, arm, { passive: true });
    arm(); // start the first countdown immediately

    return () => {
      window.clearTimeout(timer);
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, arm);
    };
  }, [enabled, timeoutMs]);
}
