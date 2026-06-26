export interface AIGenerateParams {
  capturePath: string;
  clothingKey: string;
  styleKey: string;
  sessionId: string;
}

/** Generated image bytes plus the public result URL (when the API returns one). */
export interface AIGenerateOutput {
  buffer: Buffer;
  /** Public, phone-openable URL of the result, or null when only bytes are returned. */
  publicUrl: string | null;
}

/**
 * Pluggable AI image generation transport.
 */
export interface AITransport {
  isConfigured(): boolean;
  generate(params: AIGenerateParams): Promise<AIGenerateOutput>;
}
