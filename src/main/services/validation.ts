import type { z } from 'zod';
import { AppError } from '@main/core/AppError';

/**
 * Parse a value with a Zod schema, converting failures into a structured
 * `AppError` with field-level messages the renderer can map onto form inputs.
 */
export function parseOrThrow<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  throw AppError.validation('The submitted data is invalid.', fields);
}
