import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createLogger } from '@main/core/logger';
import { getServiceAccount, isGoogleDriveConfigured } from '@main/core/GoogleSyncConfig';
import { getGoogleAccessToken, clearTokenCache } from '@main/services/sync/google/GoogleAuth';
import type { FailedRequestService } from '@main/services/FailedRequestService';

const log = createLogger('google-drive');
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

/**
 * Uploads generated images to Google Drive using the service account.
 *
 * Environment variable:
 *   GOOGLE_DRIVE_FOLDER_ID — target folder for generated photos
 */
export class GoogleDriveService {
  constructor(private readonly failedRequests: FailedRequestService) {}

  isConfigured(): boolean {
    return isGoogleDriveConfigured();
  }

  async uploadFile(filePath: string, sessionId: string): Promise<string> {
    const credentials = getServiceAccount();
    const folderId = process.env['GOOGLE_DRIVE_FOLDER_ID'];
    if (!credentials || !folderId) {
      throw new Error('Google Drive is not configured.');
    }

    const fileName = basename(filePath);
    const fileBuffer = await readFile(filePath);
    const token = await getGoogleAccessToken(credentials);

    const metadata = JSON.stringify({
      name: fileName,
      parents: [folderId],
    });

    const boundary = `kiosk_boundary_${Date.now()}`;
    const body = buildMultipartBody(boundary, metadata, fileName, fileBuffer);

    const response = await fetch(DRIVE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (response.status === 401) clearTokenCache();

    if (!response.ok) {
      const errBody = await response.text();
      const message = `Drive upload failed (${response.status}): ${errBody}`;
      this.failedRequests.record(
        'drive_upload',
        { sessionId, filePath },
        message,
        `drive-${sessionId}`,
      );
      throw new Error(message);
    }

    const result = (await response.json()) as { id: string };
    log.info('Uploaded to Google Drive', { sessionId, fileId: result.id, fileName });
    return result.id;
  }
}

function buildMultipartBody(
  boundary: string,
  metadata: string,
  _fileName: string,
  fileBuffer: Buffer,
): Buffer {
  const parts: Buffer[] = [];

  parts.push(Buffer.from(`--${boundary}\r\n`));
  parts.push(Buffer.from('Content-Type: application/json; charset=UTF-8\r\n\r\n'));
  parts.push(Buffer.from(`${metadata}\r\n`));

  parts.push(Buffer.from(`--${boundary}\r\n`));
  parts.push(Buffer.from(`Content-Type: image/jpeg\r\n\r\n`));
  parts.push(fileBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--`));

  return Buffer.concat(parts);
}
