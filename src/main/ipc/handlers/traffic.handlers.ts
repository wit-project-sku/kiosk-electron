import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/** 화성휴게소 home board's 도로교통상황 — polled by the renderer, see TrafficService. */
export function registerTrafficHandlers(container: AppContainer): void {
  handle(IpcChannels.TrafficExpresswayGet, () => container.traffic.getExpressway());
}
