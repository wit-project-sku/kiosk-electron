/**
 * A requestAnimationFrame loop that cannot outlive its component.
 *
 * ── Why this is a hook and not a `useEffect` in each game ─────────────
 * This kiosk runs for days without a reload, and a visitor is expected to play
 * game → exit → game → exit all afternoon. A single rAF chain that survives its
 * unmount is not a slow leak here, it is a permanent one: it keeps the entire
 * closure — entities, canvas, React state setters — alive for the life of the
 * process, and every subsequent game adds another. Three games hand-rolling the
 * same cleanup is three chances to get it wrong once.
 *
 * ── The two rules ─────────────────────────────────────────────────────
 *  1. The callback is read through a ref, so a game may close over fresh state
 *     without the loop being torn down and restarted on every render. Restarting
 *     it per render is the other classic version of this bug: the frame budget
 *     goes to cancel/schedule churn and `dt` collapses toward zero.
 *  2. `dt` is CLAMPED. A backgrounded window, a GC pause or the compositor
 *     stalling behind the photo upload can hand back a gap of seconds; fed
 *     straight into integration that teleports every falling tangerine past the
 *     basket at once. Clamping turns a stall into a dropped frame instead of a
 *     lost game.
 */
import { useEffect, useRef } from 'react';

/**
 * Longest step a frame may claim, in seconds (~5 frames at 60Hz).
 *
 * Below the threshold where a visitor would notice the world slowing, above any
 * ordinary frame, so only real stalls are clipped.
 */
const MAX_DT = 0.08;

/**
 * @param onFrame Called once per animation frame with the elapsed seconds since
 *   the previous frame, already clamped. Must not throw — it is the frame.
 * @param active When false the loop is not scheduled at all (a countdown, a
 *   result card). Restarting resets the clock, so the first frame after a pause
 *   is a normal-length one rather than the whole pause.
 */
export function useGameLoop(onFrame: (dt: number) => void, active: boolean): void {
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;

  useEffect(() => {
    if (!active) return;

    let raf = 0;
    let last = performance.now();
    /** Guards against a frame that was already queued when we tore down. */
    let stopped = false;

    const tick = (now: number): void => {
      if (stopped) return;
      const dt = Math.min((now - last) / 1000, MAX_DT);
      last = now;
      frameRef.current(dt);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [active]);
}
