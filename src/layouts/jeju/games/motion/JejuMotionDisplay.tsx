/**
 * 제주 모션 게임 on the customer display — the Monitor 2 entry point.
 *
 * Mounted by CustomerDisplay whenever main says a camera game is running, and
 * unmounted the moment it says one is not. That unmount is the ONLY way a
 * motion game stops, which is what makes the cleanup story simple: the camera,
 * the inference loop, the animation loop and every timer belong to the game
 * component's subtree, so releasing them is React's job rather than a teardown
 * protocol nobody remembers to call.
 *
 * ── Why `key={runId}` is not optional ─────────────────────────────────
 * A visitor pressing 다시 하기 on the remote starts the SAME game again. Without
 * the key, `game` would not change between runs, React would keep the existing
 * component, and the second run would inherit the first one's finished state —
 * a result card that never goes away. `runId` changes on every start, so a new
 * run is always a fresh mount with a fresh camera lock.
 */
import type { MotionGameId } from '@shared/types/motionGame';
import { BodyCatch } from './body-catch/BodyCatch';
import { PoseChallenge } from './pose-challenge/PoseChallenge';
import { DodgeRocks } from './dodge-rocks/DodgeRocks';

interface Props {
  game: MotionGameId;
  runId: number;
}

export function JejuMotionDisplay({ game, runId }: Props): JSX.Element {
  switch (game) {
    case 'body-catch':
      return <BodyCatch key={runId} runId={runId} />;
    case 'pose':
      return <PoseChallenge key={runId} runId={runId} />;
    case 'dodge':
      return <DodgeRocks key={runId} runId={runId} />;
    default: {
      // A game id main knows about and this switch does not. Rendering nothing
      // is the safe reading — the remote still offers a way out.
      const exhaustive: never = game;
      void exhaustive;
      return <></>;
    }
  }
}
