import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { IpcChannels } from '@shared/ipc/channels';
import type { PhotoOption } from '@shared/types/photo';
import { appPaths } from '@main/core/paths';
import {
  DEFAULT_CLOTHING_OPTIONS,
  DEFAULT_STYLE_OPTIONS,
} from '@shared/constants/photoOptions';
import { photoCaptureRequestSchema } from '@shared/validation/photo.schema';
import type { AppContainer } from '@main/container';
import { AppError } from '@main/core/AppError';
import { handle } from '../registry';

function parseOptions(
  cacheKey: string,
  defaults: PhotoOption[],
  container: AppContainer,
): PhotoOption[] {
  const cached = container.cache.get(cacheKey);
  if (!cached?.data['options']) return defaults;
  const options = cached.data['options'];
  if (!Array.isArray(options)) return defaults;
  return options as PhotoOption[];
}

/** Map a generated file's extension to an image mime type for the data URL. */
function mimeForExt(fileName: string): string {
  switch (extname(fileName).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'image/jpeg';
  }
}

/**
 * Read a generated AI photo off local disk and return it as a base64 data URL.
 * Used by the donation webview so the image is delivered to the donation app as
 * bytes (→ blob → its own backend/storage) instead of routing through the public
 * witteria URL. Path is confined to appPaths.generated (no traversal).
 */
async function readGeneratedDataUrl(fileName: string): Promise<string | null> {
  if (!fileName) return null;
  const baseDir = appPaths.generated;
  const target = normalize(join(baseDir, fileName));
  if (!target.startsWith(baseDir + sep)) return null;
  try {
    const buffer = await readFile(target);
    return `data:${mimeForExt(fileName)};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export function registerPhotoHandlers(container: AppContainer): void {
  handle(IpcChannels.PhotoGetOptions, () => ({
    clothing: parseOptions('photo_clothing', DEFAULT_CLOTHING_OPTIONS, container),
    styles: parseOptions('photo_styles', DEFAULT_STYLE_OPTIONS, container),
  }));

  handle(IpcChannels.PhotoGetWorkflow, () => container.photoWorkflow.getState());

  handle(IpcChannels.PhotoStartWorkflow, () => container.photoWorkflow.startWorkflow());

  handle(
    IpcChannels.PhotoSelectClothing,
    (req: { clothingKey: string }) => container.photoWorkflow.selectClothing(req.clothingKey),
  );

  handle(IpcChannels.PhotoSelectStyle, (req: { styleKey: string }) => {
    const deviceId = container.photoWorkflow.resolveCameraDevice();
    return container.photoWorkflow.selectStyle(req.styleKey, deviceId);
  });

  handle(IpcChannels.PhotoBeginCountdown, () => container.photoWorkflow.beginCountdown());

  handle(IpcChannels.PhotoReset, () => container.photoWorkflow.reset());

  handle(
    IpcChannels.PhotoGetResultDataUrl,
    (req: { fileName: string }) => readGeneratedDataUrl(req.fileName),
  );

  handle(IpcChannels.PhotoCaptureAndGenerate, async (req: unknown) => {
    const parsed = photoCaptureRequestSchema.safeParse(req);
    if (!parsed.success) {
      throw AppError.validation('Invalid capture request.');
    }

    const { sessionId, dataUrl, clothingKey, styleKey } = parsed.data;
    const workflow = container.photoWorkflow.getState();

    if (workflow.sessionId !== sessionId) {
      throw AppError.validation('Session mismatch.');
    }

    container.photoWorkflow.setGenerating('AI is creating your image…');

    // The customer display counts down 60s while generating; hold the result
    // until that countdown completes (even if the AI finishes earlier).
    const GENERATING_MIN_MS = 60_000;
    const startedAt = Date.now();

    // The workflow is a singleton whose sessionId is nulled by reset() (fired when
    // the user presses Home / cancels). If that happens while we're generating or
    // holding, we must NOT touch Monitor 2 — otherwise a late AI result would
    // override the home/attract video the user is now looking at.
    const isActiveSession = (): boolean =>
      container.photoWorkflow.getState().sessionId === sessionId;

    try {
      const result = await container.photoGeneration.generate(
        { sessionId, dataUrl, clothingKey, styleKey },
        (message) => {
          if (isActiveSession()) container.photoWorkflow.setGenerating(message);
        },
      );

      const remaining = GENERATING_MIN_MS - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));

      // Dropped if the user left the flow while generating — leave Monitor 2 on
      // whatever the kiosk is now showing (home video) instead of the AI result.
      if (isActiveSession()) {
        container.photoWorkflow.setResult(
          result.session.resultImagePath,
          result.resultFileName,
          result.resultUrl,
        );
      }

      return {
        sessionId,
        resultFileName: result.resultFileName,
        resultImagePath: result.session.resultImagePath,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed';
      // Only surface the error on Monitor 2 if this session is still active.
      if (isActiveSession()) container.photoWorkflow.setError(message);
      throw new Error(message);
    }
  });
}
