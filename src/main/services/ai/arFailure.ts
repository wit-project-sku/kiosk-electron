import type { ArFailure } from '@shared/types/data';

/** The server keeps the first 1000 characters of the AR message (photo_shot.ar_error_message). */
const MESSAGE_MAX = 1000;

/** undici's own timeouts — no answer in time, as opposed to never reaching the server. */
const TIMEOUT_CODES = new Set(['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']);

/**
 * A failed AR compose call, carrying why it failed so the shot report can say so.
 * `message` stays the text the app logged before (`AR generation failed (400): …`).
 */
export class ArGenerationError extends Error {
  constructor(
    message: string,
    readonly failure: ArFailure,
  ) {
    super(message);
    this.name = 'ArGenerationError';
  }
}

/** The failure to report for an error thrown by the photo pipeline; null when it was not the AR call. */
export function arFailureOf(error: unknown): ArFailure | null {
  return error instanceof ArGenerationError ? error.failure : null;
}

function clip(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  return t.length <= MESSAGE_MAX ? t : t.slice(0, MESSAGE_MAX);
}

/**
 * The AR server answered with an error status. Every Digicon error body is
 * `{ success: false, message, request_id }` — report its `message`, else the raw body.
 */
export function httpFailure(status: number, body: string): ArFailure {
  let message: string | null = null;
  try {
    const json = JSON.parse(body) as { message?: unknown; detail?: unknown };
    if (typeof json.message === 'string') message = json.message;
    else if (json.detail !== undefined) message = JSON.stringify(json.detail); // 422 validation detail
  } catch {
    // not JSON — keep the raw text
  }
  return { kind: 'HTTP', status, message: clip(message ?? body) };
}

/**
 * fetch itself threw: the request never got an answer. Node's fetch throws
 * `TypeError('fetch failed')` with the real reason (ECONNREFUSED, ENOTFOUND,
 * UND_ERR_HEADERS_TIMEOUT, …) on `cause.code`.
 */
export function fetchFailure(error: unknown): ArFailure {
  const err = error instanceof Error ? error : new Error(String(error));
  const cause = (err as { cause?: { code?: unknown } }).cause;
  const code = typeof cause?.code === 'string' ? cause.code : null;
  const timedOut =
    err.name === 'TimeoutError' ||
    err.name === 'AbortError' ||
    (code !== null && TIMEOUT_CODES.has(code));
  return {
    kind: timedOut ? 'TIMEOUT' : 'NETWORK',
    status: null,
    message: clip(code ? `${err.message} (${code})` : err.message),
  };
}

/** The AR server answered 200 but the photo could not be read from the answer. */
export function invalidResponseFailure(status: number, error: unknown): ArFailure {
  // The body stream breaking mid-read is a network failure, not a bad answer.
  if (error instanceof TypeError && (error as { cause?: unknown }).cause !== undefined) {
    return fetchFailure(error);
  }
  const message = error instanceof Error ? error.message : String(error);
  return { kind: 'INVALID_RESPONSE', status, message: clip(message) };
}
