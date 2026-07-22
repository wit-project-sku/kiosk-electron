import { randomUUID } from 'node:crypto';
import { createLogger } from '@main/core/logger';
import type { PhotoSession } from '@shared/types/photo';
import type { ShotType } from '@shared/types/data';
import type { AnalyticsService } from '@main/services/AnalyticsService';
import { localIso, type StatsService } from '@main/services/StatsService';
import type { PhotoSessionRepository } from '@main/database/repositories/PhotoSessionRepository';
import type { CaptureService } from '@main/services/camera/CaptureService';
import type { AIService } from '@main/services/ai/AIService';
import type { GoogleDriveService } from '@main/services/drive/GoogleDriveService';
import type { ImageHostService } from './ImageHostService';

const log = createLogger('photo-generation');

/** Capture mode (styleKey) → stats API shotType; undefined when unknown. */
function shotTypeOf(styleKey: string): ShotType | undefined {
  if (styleKey === 'solo') return 'SOLO';
  if (styleKey === 'withInsa') return 'TOGETHER';
  return undefined;
}

/**
 * The outfit code for the stats API. `clothingKey` arrives as "gender|code"
 * (e.g. "female|1.1"); the API only accepts the bare code (alphanumeric/-/.).
 */
function outfitCodeOf(clothingKey: string): string {
  return clothingKey.includes('|') ? clothingKey.slice(clothingKey.lastIndexOf('|') + 1) : clothingKey;
}

export interface GeneratePhotoInput {
  sessionId: string;
  dataUrl: string;
  clothingKey: string;
  styleKey: string;
}

export interface GeneratePhotoResult {
  session: PhotoSession;
  resultFileName: string;
  /** Public phone-openable URL of the result, when the AI returns one. */
  resultUrl: string | null;
}

type ProgressCallback = (message: string) => void;

/**
 * Orchestrates the full AI photo pipeline:
 *   temp capture → AI generate → save result → delete temp → record metadata → Drive upload
 */
export class PhotoGenerationService {
  constructor(
    private readonly capture: CaptureService,
    private readonly ai: AIService,
    private readonly drive: GoogleDriveService,
    private readonly sessions: PhotoSessionRepository,
    private readonly analytics: AnalyticsService,
    private readonly imageHost: ImageHostService,
    private readonly stats: StatsService,
  ) {}

  async generate(input: GeneratePhotoInput, onProgress?: ProgressCallback): Promise<GeneratePhotoResult> {
    const { sessionId, dataUrl, clothingKey, styleKey } = input;

    // One shot = "original saved + AI generation started". eventId/shotAt are
    // pinned at that moment (right after saveCapture) and shared by the
    // success AND failure recordShot so the server counts one idempotent event
    // stamped at generation start, not at whenever the outcome landed.
    let eventId: string | undefined;
    let shotAt: string | undefined;
    const outfitCode = outfitCodeOf(clothingKey);
    const shotType = shotTypeOf(styleKey);

    try {
      this.analytics.track({
        name: 'ai_request_started',
        payload: { sessionId, clothingKey, styleKey },
      });

      onProgress?.('Preparing your photo…');
      // The original capture (the token image) is kept permanently in the same
      // folder as the result, paired by sessionId.
      const capture = await this.capture.saveCapture(dataUrl, sessionId);

      // Original saved — the shot officially exists from here on.
      eventId = randomUUID();
      shotAt = localIso();

      onProgress?.('AI is creating your image…');
      const { buffer: resultBuffer, publicUrl } = await this.ai.generate({
        sessionId,
        capturePath: capture.filePath,
        clothingKey,
        styleKey,
      });

      onProgress?.('Saving your result…');
      const { filePath, fileName } = await this.capture.saveGenerated(resultBuffer, capture.fileName);

      // The AR API returns only image bytes, so upload to a public host to get a
      // phone-openable URL for the save QR (falls back to the API URL if it ever
      // provides one).
      const resultUrl = publicUrl ?? (await this.imageHost.upload(resultBuffer, fileName));

      const session = this.sessions.create({
        sessionId,
        clothingKey,
        styleKey,
        resultImagePath: filePath,
      });

      this.analytics.track({
        name: 'ai_request_completed',
        payload: { sessionId, resultFileName: fileName, captureFileName: capture.fileName },
      });

      // Report the successful capture to the witteria shots API (fire-and-forget,
      // offline-queued + idempotent; never blocks the result). shotAt/eventId
      // are the values pinned at generation start.
      void this.stats.recordShot({
        isSuccess: true,
        outfitCode,
        shotType,
        shotAt,
        eventId,
      });

      void this.uploadToDrive(session);

      log.info('Photo generation complete', {
        sessionId,
        fileName,
        capture: capture.fileName,
        // Phone QR: the public URL (from the host upload, since the AR API only
        // returns bytes). null means the upload failed → QR falls back to local.
        resultUrl: resultUrl ?? '(none — public upload failed)',
      });
      return { session, resultFileName: fileName, resultUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed';
      this.analytics.track({
        name: 'ai_request_failed',
        payload: { sessionId, error: message },
      });
      // Report the failed capture so the shots stats reflect real success rates.
      // Only when the original was saved (eventId pinned): "no original photo
      // = not a shot" — a saveCapture failure must not be counted at all.
      if (eventId !== undefined) {
        void this.stats.recordShot({
          isSuccess: false,
          outfitCode,
          shotType,
          shotAt,
          eventId,
        });
      }
      throw error;
    }
  }

  /** Upload to Drive in background; failures queued for night sync. */
  private async uploadToDrive(session: PhotoSession): Promise<void> {
    if (!this.drive.isConfigured()) return;

    try {
      const fileId = await this.drive.uploadFile(session.resultImagePath, session.sessionId);
      this.sessions.markDriveSynced(session.id, fileId);
    } catch (error) {
      log.warn('Drive upload deferred to night sync', { sessionId: session.sessionId, error });
    }
  }

  async retryDriveUpload(session: PhotoSession): Promise<void> {
    if (!this.drive.isConfigured()) return;
    const fileId = await this.drive.uploadFile(session.resultImagePath, session.sessionId);
    this.sessions.markDriveSynced(session.id, fileId);
  }

  listPendingDriveUploads(limit: number): PhotoSession[] {
    return this.sessions.listPendingDriveSync(limit);
  }
}
