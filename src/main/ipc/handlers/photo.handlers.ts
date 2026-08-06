import { IpcChannels } from '@shared/ipc/channels';
import type { PhotoOption } from '@shared/types/photo';
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

  handle(IpcChannels.PhotoPauseCountdown, () => container.photoWorkflow.pauseCountdown());

  handle(IpcChannels.PhotoResumeCountdown, () => container.photoWorkflow.resumeCountdown());

  handle(IpcChannels.PhotoStartEffects, () => container.photoWorkflow.startEffects());

  // ── Wait-time mini game ───────────────────────────────────────────────────
  // Monitor 1 (touch) drives start/replay/show-result; Monitor 2 (big screen)
  // reports what the camera can see and when the run ends.
  handle(IpcChannels.GameStart, () => container.photoWorkflow.startGame());

  handle(IpcChannels.GameBegin, () => container.photoWorkflow.beginGame());

  handle(IpcChannels.GameOver, (req: { score: number }) =>
    container.photoWorkflow.endGame(Number.isFinite(req?.score) ? Math.max(0, req.score) : 0),
  );

  handle(IpcChannels.GameReplay, () => container.photoWorkflow.replayGame());

  handle(IpcChannels.GameShowResult, () => container.photoWorkflow.releaseResult());

  handle(IpcChannels.GameReportPose, (req: { poseReady: boolean; bodyTracked: boolean }) =>
    container.photoWorkflow.reportPose(!!req?.poseReady, !!req?.bodyTracked),
  );

  // Gesture-driven Instagram-effects capture: the filter is already baked into
  // the canvas data URL on Monitor 2, so we just persist it, get a phone-openable
  // URL for the save QR, and flip both monitors to the result. No AI involved.
  handle(IpcChannels.PhotoCaptureEffects, async (req: { dataUrl: string; filterId: string }) => {
    if (!req?.dataUrl || typeof req.dataUrl !== 'string') {
      throw AppError.validation('Invalid effects capture request.');
    }

    const workflow = container.photoWorkflow.getState();
    const sessionId = workflow.sessionId ?? 'effects';

    container.analytics.track({
      name: 'ai_request_started',
      payload: { sessionId, styleKey: 'effects', filterId: req.filterId },
    });

    try {
      const { filePath, fileName } = await container.capture.saveCapture(req.dataUrl, sessionId);
      // saveCapture already wrote the JPEG bytes; decode the same data URL for the
      // public-host upload that powers the phone save QR.
      const base64 = req.dataUrl.includes(',') ? req.dataUrl.split(',')[1] ?? '' : req.dataUrl;
      const buffer = Buffer.from(base64, 'base64');
      const resultUrl = await container.imageHost.upload(buffer, fileName);

      container.photoWorkflow.setResult(filePath, fileName, resultUrl);

      container.analytics.track({
        name: 'ai_request_completed',
        payload: { sessionId, resultFileName: fileName, styleKey: 'effects', filterId: req.filterId },
      });

      return { resultFileName: fileName, resultImagePath: filePath };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Effects capture failed';
      container.photoWorkflow.setError(message);
      throw new Error(message);
    }
  });

  handle(IpcChannels.PhotoReset, () => container.photoWorkflow.reset());

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

    try {
      const result = await container.photoGeneration.generate(
        { sessionId, dataUrl, clothingKey, styleKey },
        (message) => container.photoWorkflow.setGenerating(message),
      );

      // The photo is ready, but it is not necessarily the visitor's moment.
      // If they are mid-run in the wait-time game we hold it back and let the
      // touch screen offer it once they crash; if they never played, this is
      // just the advertised 60s the customer display counts down.
      container.photoWorkflow.markResultReady(result.resultFileName);
      await container.photoWorkflow.waitForResultRelease();

      container.photoWorkflow.setResult(result.session.resultImagePath, result.resultFileName, result.resultUrl);
      return {
        sessionId,
        resultFileName: result.resultFileName,
        resultImagePath: result.session.resultImagePath,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed';
      container.photoWorkflow.setError(message);
      throw new Error(message);
    }
  });
}
