import { dialog } from 'electron';
import { IpcChannels } from '@shared/ipc/channels';
import { SUPPORTED_IMAGE_EXT, SUPPORTED_VIDEO_EXT } from '@shared/constants';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

function stripDots(exts: readonly string[]): string[] {
  return exts.map((e) => e.replace('.', ''));
}

/**
 * Registers image/media channels. The import handler resolves absolute source
 * paths via the OS dialog (renderers cannot read arbitrary filesystem paths),
 * which keeps file selection secure and inside the main process.
 */
export function registerImageHandlers(container: AppContainer): void {
  const { images } = container;

  handle(IpcChannels.ImageList, ({ customerId }) => images.list(customerId));

  handle(IpcChannels.ImageImport, async ({ customerId, sourcePaths }) => {
    let paths = sourcePaths;
    if (paths.length === 0) {
      const result = await dialog.showOpenDialog({
        title: 'Import media',
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: 'Media',
            extensions: [...stripDots(SUPPORTED_IMAGE_EXT), ...stripDots(SUPPORTED_VIDEO_EXT)],
          },
        ],
      });
      if (result.canceled) return [];
      paths = result.filePaths;
    }
    return images.importMany(customerId, paths);
  });

  handle(IpcChannels.ImageSaveCapture, ({ customerId, dataUrl, fileName }) =>
    images.saveCapture(customerId, dataUrl, fileName),
  );

  handle(IpcChannels.ImageDelete, (id) => images.delete(id));
}
