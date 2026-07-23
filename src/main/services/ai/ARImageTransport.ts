import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createLogger } from '@main/core/logger';
import { kioskConfigStore } from '@main/core/KioskConfigStore';
import { getKioskLocation } from '@shared/config/kioskLocations';
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

/**
 * Digicon AR hanbok transport. Two endpoints:
 *   solo     → process_image           (styleKey 'solo')
 *   together → process_and_combine     (styleKey 'withInsa')
 *
 * Photo-workflow fields:
 *   clothingKey = "gender|code" outfit selection (see parseClothingKey)
 *   styleKey    = capture mode ('solo' | 'withInsa')
 *
 * NOTE 'withInsa' names the MODE (together), not the character — despite the
 * name it does not mean "with 인사". Which mascot appears is a separate,
 * per-kiosk decision: see togetherWith().
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

  /**
   * The mascot a 같이찍기 photo is composited with, resolved from THIS machine's
   * kiosk id: 인사 on Insadong, 정이 on 오색시장, 휴 on 화성휴게소.
   *
   * One build serves every location, so a fixed value is wrong somewhere — this
   * used to default to '2' (인사) for the whole fleet, which composited 오색시장 and
   * 화성휴게소 visitors with the Insadong character. The env var stays as a manual
   * override for testing, but it must not be the source of truth.
   */
  private togetherWith(): string {
    const override = process.env['VITE_AR_TOGETHER_WITH'];
    if (override) return override;
    return getKioskLocation(kioskConfigStore.get().kioskId).aiCompanion;
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

    // together_with: '2'=Insa, '3'=Jeong-i, '4'=Hue, 'GROUP'=Insa & Jeong-i.
    const togetherWith = mode === 'together' ? this.togetherWith() : undefined;
    if (togetherWith) form.append('together_with', togetherWith);

    if (gender) form.append('gender', gender);

    if (params.sessionId) form.append('request_ids', params.sessionId);

    log.info('Sending AR generation request', {
      sessionId: params.sessionId,
      mode,
      endpoint,
      outfit,
      gender,
      togetherWith,
    });

    const response = await fetch(endpoint, { method: 'POST', body: form });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AR generation failed (${response.status}): ${body}`);
    }

    const { buffer, url } = await parseImageResponse(response);
    return { buffer, publicUrl: url };
  }
}
