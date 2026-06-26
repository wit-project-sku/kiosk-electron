/**
 * A serializable Result type used as the envelope for every IPC response.
 *
 * Electron's IPC bridge serializes values structurally; throwing across the
 * bridge loses the error type and stack. Instead, every handler returns a
 * `Result<T>` so the renderer can branch on success/failure with full type
 * safety and never has to deal with thrown values from the main process.
 */

export type AppErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DATABASE'
  | 'FILESYSTEM'
  | 'UNKNOWN';

export interface SerializableError {
  code: AppErrorCode;
  message: string;
  /** Optional field-level validation details keyed by field name. */
  fields?: Record<string, string>;
}

export interface Ok<T> {
  ok: true;
  value: T;
}

export interface Err {
  ok: false;
  error: SerializableError;
}

export type Result<T> = Ok<T> | Err;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const err = (error: SerializableError): Err => ({ ok: false, error });

/** Type guard that narrows a Result to its success branch. */
export const isOk = <T>(result: Result<T>): result is Ok<T> => result.ok;
