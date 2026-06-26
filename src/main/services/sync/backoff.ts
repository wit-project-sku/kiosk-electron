/** Exponential backoff with jitter for sync-job retries. */

const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 5 * 60 * 1000; // Cap at 5 minutes.

/**
 * Compute the next retry timestamp after `attempts` failures.
 * delay = min(MAX, BASE * 2^attempts) ± 20% jitter, to avoid thundering herds.
 */
export function nextAttemptAt(attempts: number, now: number = Date.now()): string {
  const exponential = BASE_DELAY_MS * 2 ** Math.max(0, attempts);
  const capped = Math.min(MAX_DELAY_MS, exponential);
  const jitter = capped * 0.2 * (Math.random() - 0.5);
  return new Date(now + capped + jitter).toISOString();
}
