import type { Session, SessionStatus } from '@shared/types/data';
import type { EntityId } from '@shared/types/domain';
import { AppError } from '@main/core/AppError';
import { createLogger } from '@main/core/logger';
import type { SessionRepository } from '@main/database/repositories/SessionRepository';
import type { AnalyticsService } from './AnalyticsService';

const log = createLogger('session-service');

/**
 * Manages customer interaction sessions. Starting/ending a session also records
 * an analytics event so session activity is captured in the immutable event log.
 */
export class SessionService {
  constructor(
    private readonly repo: SessionRepository,
    private readonly analytics: AnalyticsService,
  ) {}

  start(customerId: EntityId | null, metadata: Record<string, unknown> | null): Session {
    const session = this.repo.start(customerId, metadata);
    this.analytics.track({
      name: 'session_started',
      sessionId: session.id,
      customerId,
    });
    log.info('Session started', { id: session.id });
    return session;
  }

  end(id: EntityId, status: SessionStatus): Session {
    const session = this.repo.end(id, status);
    if (!session) throw AppError.notFound(`Session ${id} was not found.`);
    this.analytics.track({
      name: 'session_ended',
      sessionId: id,
      customerId: session.customerId,
      payload: { status },
    });
    log.info('Session ended', { id, status });
    return session;
  }

  listRecent(limit = 50): Session[] {
    return this.repo.listRecent(limit);
  }
}
