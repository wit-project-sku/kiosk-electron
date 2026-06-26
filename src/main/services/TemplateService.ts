import type { Template } from '@shared/types/data';
import { createLogger } from '@main/core/logger';
import type { TemplateRepository } from '@main/database/repositories/TemplateRepository';

const log = createLogger('template-service');

/** Default templates seeded on first run. Rarely change; cached in memory. */
const DEFAULT_TEMPLATES: Pick<Template, 'key' | 'name' | 'content' | 'enabled'>[] = [
  {
    key: 'idle_welcome',
    name: 'Idle welcome message',
    content: { headline: 'Welcome!', subtext: 'Please wait to be served.' },
    enabled: true,
  },
  {
    key: 'slideshow_default',
    name: 'Default slideshow',
    content: { transitionMs: 800, fit: 'contain' },
    enabled: true,
  },
];

/**
 * Provides template configuration. Templates are read on every page that uses
 * them but change very rarely, so they are loaded once at startup and cached in
 * a renderer memory store — avoiding repeated database queries.
 */
export class TemplateService {
  constructor(private readonly repo: TemplateRepository) {}

  /** Seed defaults once if the table is empty. Idempotent. */
  ensureSeeded(): void {
    if (this.repo.count() > 0) return;
    for (const template of DEFAULT_TEMPLATES) {
      this.repo.upsert(template);
    }
    log.info('Seeded default templates', { count: DEFAULT_TEMPLATES.length });
  }

  list(): Template[] {
    return this.repo.list();
  }

  upsert(template: Pick<Template, 'key' | 'name' | 'content' | 'enabled'>): Template {
    return this.repo.upsert(template);
  }
}
