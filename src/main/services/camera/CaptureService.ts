import { writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { appPaths } from '@main/core/paths';
import { captureSequence } from '@main/core/CaptureSequenceStore';
import { createLogger } from '@main/core/logger';
import { AppError } from '@main/core/AppError';

const log = createLogger('capture-service');

/** Local calendar date as `YYYYMMDD` (e.g. 20260405). */
function formatCaptureDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Handles photo captures for the AI pipeline. Both the original capture (the
 * "token" image sent to the AI) and the generated result are kept permanently
 * in the same `generated` folder, paired by sessionId.
 */
export class CaptureService {
  /**
   * Save the original capture (the "token" image) permanently into the shared
   * photo folder (`C:\KioskPhotos` on Windows). Files are named
   * `Captured_<YYYYMMDD>_<n>` where `n` is a persistent, ever-increasing
   * sequence starting at 1 on the first launch. Returns absolute path and file
   * name.
   */
  async saveCapture(dataUrl: string, _sessionId: string): Promise<{ filePath: string; fileName: string }> {
    const match = /^data:image\/(\w+);base64,(.+)$/.exec(dataUrl);
    if (!match) {
      throw AppError.validation('Invalid capture data URL.');
    }

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1]!;
    const buffer = Buffer.from(match[2]!, 'base64');
    const sequence = captureSequence.next();
    const fileName = `Captured_${formatCaptureDate(new Date())}_${sequence}.${ext}`;
    const filePath = join(appPaths.generated, fileName);

    await writeFile(filePath, buffer);
    log.info('Capture saved', { fileName, bytes: buffer.length });
    return { filePath, fileName };
  }

  /**
   * Save a permanent AI-generated result, paired with its token capture. The
   * result reuses the capture's name with an `_Ai` suffix
   * (e.g. `Captured_20260405_1.jpg` → `Captured_20260405_1_Ai.jpg`). Returns
   * absolute path and file name.
   */
  async saveGenerated(
    imageBuffer: Buffer,
    captureFileName: string,
  ): Promise<{ filePath: string; fileName: string }> {
    const base = captureFileName.replace(/\.[^.]+$/, '');
    const fileName = `${base}_Ai.jpg`;
    const filePath = join(appPaths.generated, fileName);
    await writeFile(filePath, imageBuffer);
    log.info('Generated image saved', { fileName, bytes: imageBuffer.length });
    return { filePath, fileName };
  }

  resultFileNameFromPath(filePath: string): string {
    return basename(filePath);
  }
}
