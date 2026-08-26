import { createLogger } from '@main/core/logger';
import type { FailedRequestService } from '@main/services/FailedRequestService';
import type { AIGenerateOutput, AIGenerateParams, AITransport } from './AITransport';
import { ARImageTransport } from './ARImageTransport';

const log = createLogger('ai-service');

/**
 * AI image generation service. Delegates to a pluggable transport.
 * Failures are recorded in failed_requests for night-sync retry.
 */
export class AIService {
  private transport: AITransport;

  constructor(
    private readonly failedRequests: FailedRequestService,
    transport: AITransport = new ARImageTransport(),
  ) {
    this.transport = transport;
  }

  isConfigured(): boolean {
    return this.transport.isConfigured();
  }

  setTransport(transport: AITransport): void {
    this.transport = transport;
  }

  async generate(params: AIGenerateParams): Promise<AIGenerateOutput> {
    if (!this.transport.isConfigured()) {
      throw new Error('AI service is not configured.');
    }

    try {
      const result = await this.transport.generate(params);
      log.info('AI generation completed', { sessionId: params.sessionId, bytes: result.buffer.length });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI generation failed';
      this.failedRequests.record(
        'ai_generation',
        {
          sessionId: params.sessionId,
          clothingKey: params.clothingKey,
          styleKey: params.styleKey,
          capturePath: params.capturePath,
          // Recorded so a night-sync retry reproduces the visitor's 배경 테마
          // choice rather than silently falling back to no background.
          backgroundId: params.backgroundId,
        },
        message,
        `ai-${params.sessionId}`,
      );
      throw error;
    }
  }
}
