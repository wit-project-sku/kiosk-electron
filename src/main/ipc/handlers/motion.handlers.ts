import { IpcChannels } from '@shared/ipc/channels';
import type { MotionGameId, MotionGameReport } from '@shared/types/motionGame';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/**
 * 제주 모션 게임 IPC.
 *
 * Four calls, two directions. Monitor 1 (the touch screen) starts and stops;
 * Monitor 2 (the customer display) reports. Both read the result back off the
 * `MotionGameChanged` broadcast rather than from these return values — see
 * shared/types/motionGame.ts for why main is the only source of truth.
 */
export function registerMotionHandlers(container: AppContainer): void {
  handle(IpcChannels.MotionGet, () => container.motionGame.getState());

  handle(IpcChannels.MotionStart, (req: { game: MotionGameId }) =>
    container.motionGame.start(req.game),
  );

  handle(IpcChannels.MotionReport, (req: MotionGameReport) => container.motionGame.report(req));

  handle(IpcChannels.MotionStop, () => container.motionGame.stop());
}
