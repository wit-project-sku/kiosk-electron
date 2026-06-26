import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import type { WindowManager } from '@main/windows/WindowManager';
import { handle } from '../registry';

/**
 * Registers customer-display control channels. The display state lives in
 * DisplayService; WindowManager handles the physical window and broadcasting,
 * so these handlers stay thin and side-effect-explicit.
 */
export function registerDisplayHandlers(container: AppContainer, windows: WindowManager): void {
  const { display } = container;

  handle(IpcChannels.DisplayGetState, () => display.getState());

  handle(IpcChannels.DisplaySetState, (state) => {
    // Ensure the window exists before pushing content to it.
    windows.openDisplayWindow();
    return display.setState(state);
  });

  handle(IpcChannels.DisplayOpen, () => windows.openDisplayWindow());
  handle(IpcChannels.DisplayClose, () => windows.closeDisplayWindow());
  handle(IpcChannels.DisplayToggleFullscreen, () => windows.toggleDisplayFullscreen());
}
