import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createLogger } from '@main/core/logger';
import type { AIGenerateOutput, AIGenerateParams, AITransport } from './AITransport';
import { parseImageResponse } from './parseImageResponse';

const log = createLogger('ar-image-transport');

/**
 * Digicon AR endpoints. Env overrides win, but we default to the known
 * production URLs so a packaged build that never loads `.env` still sends the
 * correct AR form (image/outfit/gender/together_with/request_ids) — never the
 * legacy generic shape.
 */
const DEFAULT_PROCESS_IMAGE_URL = 'https://kr-kiosk.digicon.pro/api/v2/process_image';
const DEFAULT_PROCESS_COMBINE_URL = 'https://kr-kiosk.digicon.pro/api/v2/process_and_combine';

/** Abort the AR request after this long. Override with VITE_AR_TIMEOUT_MS. */
const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Digicon AR hanbok transport. Two endpoints:
 *   solo     → process_image          (styleKey 'solo')
 *   together → process_and_combine     (styleKey 'withInsa', with 'INSA')
 *
 * Photo-workflow fields:
 *   clothingKey = "gender|code" outfit selection (see parseClothingKey)
 *   styleKey    = capture mode ('solo' | 'withInsa')
 */

/**
 * The renderer sends the clothing key as `"gender|code"` (e.g. "male|3.1",
 * "female|1.1", "female|10.1-F").
 *
 * The `gender|` prefix reflects the source folder (cat3-m-hanbok → male) but
 * must NOT be forwarded to the API for gender-specific category outfits like
 * "3.1" — those exist on the server without a suffix and the API would wrongly
 * try "3.1-M". Only unisex outfits (cat5-8) carry an explicit "-F"/"-M" suffix
 * in their code; that suffix is the sole signal for which gender to send.
 */
function parseClothingKey(key: string): { outfit: string; gender: 'm' | 'f' | undefined } {
  const [, rawCode = ''] = key.includes('|') ? key.split('|') : ['', key];
  const code = rawCode || key;
  const suffix = code.match(/-([mf])$/i);
  const outfit = suffix ? code.slice(0, -suffix[0].length) : code;
  const gender = suffix ? (suffix[1]!.toLowerCase() as 'm' | 'f') : undefined;
  return { outfit, gender };
}

export class ARImageTransport implements AITransport {
  private soloUrl(): string {
    return process.env['VITE_AR_PROCESS_IMAGE_API_URL'] || DEFAULT_PROCESS_IMAGE_URL;
  }
  private combineUrl(): string {
    return process.env['VITE_AR_PROCESS_API_URL'] || DEFAULT_PROCESS_COMBINE_URL;
  }
  private timeoutMs(): number {
    const raw = Number(process.env['VITE_AR_TIMEOUT_MS'] || '');
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
  }

  isConfigured(): boolean {
    return true; // endpoints always resolve (env override or built-in default)
  }

  async generate(params: AIGenerateParams): Promise<AIGenerateOutput> {
    const mode: 'solo' | 'together' = params.styleKey === 'withInsa' ? 'together' : 'solo';
    const endpoint = mode === 'together' ? this.combineUrl() : this.soloUrl();

    const { outfit, gender } = parseClothingKey(params.clothingKey);

    const imageBuffer = await readFile(params.capturePath);
    const form = new FormData();
    form.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), basename(params.capturePath));
    form.append('outfit', outfit);

    // together_with: '2'=Insa (app default), '3'=Jeong-i, '4'=Hue, 'GROUP'=Insa & Jeong-i.
    if (mode === 'together') {
      form.append('together_with', process.env['VITE_AR_TOGETHER_WITH'] || '2');
    }

    if (gender) form.append('gender', gender);

    if (params.sessionId) form.append('request_ids', params.sessionId);

    log.info('Sending AR generation request', {
      sessionId: params.sessionId,
      mode,
      endpoint,
      outfit,
      gender,
    });

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(this.timeoutMs()),
      });
    } catch (error) {
      // Keep the timeout case identifiable in logs/analytics; everything else
      // surfaces as a plain network-level failure.
      const aborted =
        error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      if (aborted) {
        throw new Error(`AR generation timed out after ${this.timeoutMs()}ms`, { cause: error });
      }
      const message = error instanceof Error ? error.message : 'AR request failed';
      throw new Error(`AR request failed: ${message}`, { cause: error });
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`AR generation failed (${response.status}): ${body}`);
    }

    const { buffer, url } = await parseImageResponse(response);
    return { buffer, publicUrl: url };
  }
}
