import { createLogger } from '@main/core/logger';
import { witteriaApiBase } from '@main/core/apiBase';

const log = createLogger('image-host');

/**
 * The upload endpoint, on the shared witteria API base. /api/photo-booth lives
 * on the same host as every other witteria call (api-stage-v3 / api-v3), so the
 * one WITTERIA_API_BASE line in .env picks stage or production for it too — no
 * separate full URL per kiosk.
 */
const PHOTO_BOOTH_PATH = '/api/photo-booth';

/**
 * witteria's standalone photo host — the endpoint the (working) Unity kiosk
 * uses. A separate service on its own fixed host (not from WITTERIA_API_BASE or
 * .env). Tried only when the photo-booth upload fails, so the visitor still gets
 * a working QR; it returns no shareUrl, so that QR goes through withphoto.
 */
const PHOTO_HOST_UPLOAD_URL = 'https://photo.witteria.com/api/images';

interface UploadResponse {
  success?: boolean;
  code?: number;
  message?: string;
  data?: { imageUrl?: string; shareUrl?: string };
}

/** A successful upload. */
export interface UploadedImage {
  /** The image itself — on-screen display, the 기부 hand-off. */
  imageUrl: string;
  /**
   * The phone pickup page (/api/photo-booth, 2026-10): save buttons per device,
   * an "open in browser" prompt inside KakaoTalk, expires after an hour. This is
   * what the QR carries. null when the upload went to photo.witteria.com, which
   * does not return one — the QR then falls back to withphoto.
   */
  shareUrl: string | null;
}

/**
 * Uploads a generated photo so the kiosk can put a phone-openable URL in the
 * save QR. The AR API returns only image bytes (no public URL), so without this
 * the QR points at a local `media://` path that a phone cannot open.
 *
 * Both hosts take multipart field `images` (image/jpeg):
 *   1. POST {WITTERIA_API_BASE}/api/photo-booth
 *      → { success, data: { imageUrl, shareUrl } } — the QR is data.shareUrl
 *        (the backend's 2026-10 request: phones go to the pickup page, not
 *        through Vercel).
 *   2. POST https://photo.witteria.com/api/images — fallback only (see above).
 *
 * Env:
 *   WITTERIA_API_BASE       — the shared API base (stage / production)
 *   PHOTO_PUBLIC_UPLOAD_URL — optional full-URL override for (1); normally unset
 */
export class ImageHostService {
  isConfigured(): boolean {
    return true; // a default host is always available
  }

  /** Returns the uploaded image's URLs, or null when both hosts fail. */
  async upload(buffer: Buffer, fileName: string): Promise<UploadedImage | null> {
    const photoBooth = process.env['PHOTO_PUBLIC_UPLOAD_URL'] || `${witteriaApiBase()}${PHOTO_BOOTH_PATH}`;
    return (await this.post(photoBooth, buffer, fileName)) ?? (await this.post(PHOTO_HOST_UPLOAD_URL, buffer, fileName));
  }

  /** One upload attempt. Null on any failure (logged), so the caller can try the next host. */
  private async post(url: string, buffer: Buffer, fileName: string): Promise<UploadedImage | null> {
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

      const shareUrl = json.data?.shareUrl?.trim() || null;
      log.info('Result uploaded to witteria photo host', { host: url, fileName, imageUrl, shareUrl });
      return { imageUrl, shareUrl };
    } catch (error) {
      log.warn('Public image upload failed', {
        host: url,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
