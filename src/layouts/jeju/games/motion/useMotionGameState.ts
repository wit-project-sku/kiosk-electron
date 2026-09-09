/**
 * The 모션 게임 state, as either window sees it.
 *
 * Main owns it; this seeds from `motion.get()` and then follows the broadcast.
 * Exactly the shape `usePhotoWorkflow` uses for the photo state, and for the
 * same reason: two renderer windows share no memory, so the only way they can
 * agree is to read the same broadcast rather than talk to each other.
 *
 * Both screens use this. Monitor 2 mounts the game from `game`/`runId`;
 * Monitor 1 draws its remote from `phase`/`score`/`tracking`.
 */
import { useEffect, useState } from 'react';
import { initialMotionGameState, type MotionGameState } from '@shared/types/motionGame';
import { isOk } from '@shared/types/result';

export function useMotionGameState(): MotionGameState {
  const [state, setState] = useState<MotionGameState>(initialMotionGameState);

  useEffect(() => {
    // Seed first: a window that opens (or reloads) mid-game must not sit on an
    // idle state until the next broadcast happens to arrive. The customer
    // display in particular is opened when a second monitor appears, which can
    // be long after a session started.
    void window.api.motion.get().then((result) => {
      if (isOk(result)) setState(result.value);
    });
    return window.api.events.onMotionGameChanged(setState);
  }, []);

  return state;
}
