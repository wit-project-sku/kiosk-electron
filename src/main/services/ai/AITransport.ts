export interface AIGenerateParams {
  capturePath: string;
  clothingKey: string;
  styleKey: string;
  sessionId: string;
  /**
   * The 배경 테마 the visitor picked in step ② of the 제주 outfit screen, or null
   * when they picked none — which is also every kiosk that has no background set
   * assigned at all. Null is NOT "let the server decide": it means the CB
   * (change-background) template set must be skipped explicitly. See
   * ARImageTransport.generate.
   */
  backgroundId: number | null;
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
