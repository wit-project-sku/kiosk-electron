import { randomUUID } from 'node:crypto';
import type { EntityId } from '@shared/types/domain';
import type {
  CreateFailedRequestInput,
  FailedRequest,
  FailedRequestRepository,
} from '@main/database/repositories/FailedRequestRepository';
import { createLogger } from '@main/core/logger';

const log = createLogger('failed-request-service');

/**
 * Records every failed remote operation for durable retry during night sync.
 */
export class FailedRequestService {
  constructor(private readonly repo: FailedRequestRepository) {}

  record(
    type: string,
    payload: Record<string, unknown>,
    error: string | null,
    requestId?: string,
  ): FailedRequest {
    const input: CreateFailedRequestInput = {
      requestId: requestId ?? randomUUID(),
      type,
      payload,
      error,
    };
    const record = this.repo.create(input);
    log.warn('Recorded failed request', { type, requestId: record.requestId });
    return record;
  }

  listRetryable(limit: number): FailedRequest[] {
    return this.repo.listRetryable(limit);
  }

  /** Retryable requests of a single type (e.g. the nightly photo-shot batch). */
  listByType(type: string, limit: number): FailedRequest[] {
    return this.repo.listByType(type, limit);
  }

  markRetried(id: EntityId, error: string | null): void {
    this.repo.incrementRetry(id, error);
  }

  resolve(id: EntityId): void {
    this.repo.delete(id);
  }

  count(): number {
    return this.repo.count();
  }
}
