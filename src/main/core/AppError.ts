/**
 * Typed application error for the main process.
 *
 * Services and repositories throw `AppError` with a stable `code`. The IPC
 * layer catches it and converts it into a `SerializableError` envelope, so the
 * renderer receives structured, type-safe failures instead of opaque strings.
 */

import type { AppErrorCode, SerializableError } from '@shared/types/result';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly fields: Record<string, string> | undefined;

  constructor(code: AppErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.fields = fields;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toSerializable(): SerializableError {
    return {
      code: this.code,
      message: this.message,
      ...(this.fields ? { fields: this.fields } : {}),
    };
  }

  static notFound(message: string): AppError {
    return new AppError('NOT_FOUND', message);
  }

  static validation(message: string, fields?: Record<string, string>): AppError {
    return new AppError('VALIDATION', message, fields);
  }

  static database(message: string): AppError {
    return new AppError('DATABASE', message);
  }

  static filesystem(message: string): AppError {
    return new AppError('FILESYSTEM', message);
  }

  /** Normalize any thrown value into a SerializableError. */
  static toSerializable(error: unknown): SerializableError {
    if (error instanceof AppError) {
      return error.toSerializable();
    }
    if (error instanceof Error) {
      return { code: 'UNKNOWN', message: error.message };
    }
    return { code: 'UNKNOWN', message: 'An unexpected error occurred.' };
  }
}
