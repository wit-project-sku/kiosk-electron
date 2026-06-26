import { createLogger } from '@main/core/logger';

const log = createLogger('image-host');

/** Witteria photo host — the same endpoint the (working) Unity kiosk uses. */
const WITTERIA_UPLOAD_URL = 'https://photo.witteria.com/api/images';

interface UploadResponse {
  success?: boolean;
  code?: number;
  message?: string;
  data?: { imageUrl?: string };
}

/**
 * Uploads a generated photo to witteria's photo host so the kiosk can put a
 * phone-openable URL in the save QR. The AR API returns only image bytes (no
 * public URL), so without this the QR points at a local `media://` path that a
 * phone cannot open.
 *
 * This mirrors the proven Unity/C++ kiosk flow exactly:
 *   POST https://photo.witteria.com/api/images
 *   multipart field `images` (image/jpeg)
 *   → { success, code: 201, data: { imageUrl } }
 * The QR then points at `${SAVE_BASE}<imageUrl>` so the phone page can load it.
 *
 * Env:
 *   PHOTO_PUBLIC_UPLOAD_URL — override the upload endpoint if it ever moves.
 */
export class ImageHostService {
  isConfigured(): boolean {
    return true; // a default host is always available
  }

  /** Returns the public image URL (the API's `data.imageUrl`), or null on failure. */
  async upload(buffer: Buffer, fileName: string): Promise<string | null> {
    const url = process.env['PHOTO_PUBLIC_UPLOAD_URL'] || WITTERIA_UPLOAD_URL;
    try {
      const form = new FormData();
      // Field name MUST be `images` (matches the witteria API / Unity client).
      form.append('images', new Blob([buffer], { type: 'image/jpeg' }), fileName);

      const res = await fetch(url, {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: form,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);

      const json = JSON.parse(text) as UploadResponse;
      const imageUrl = json.data?.imageUrl;
      if (!json.success || !imageUrl) {
        throw new Error(`Upload rejected (code ${json.code ?? '?'}): ${text.slice(0, 160)}`);
      }

      log.info('Result uploaded to witteria photo host', { fileName, imageUrl });
      return imageUrl;
    } catch (error) {
      log.warn('Public image upload failed (QR will fall back to local path)', {
        host: url,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
