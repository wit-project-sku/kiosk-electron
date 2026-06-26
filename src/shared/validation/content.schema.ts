import { z } from 'zod';
import type { KioskScreenId } from '../types/kiosk';

/**
 * Validated screen content stored in local_cache.
 * Layouts read only validated content — invalid rows are skipped during sync.
 */
export const screenContentSchema = z.object({
  title: z.string().trim().min(1),
  subtitle: z.string().trim().optional(),
  body: z.string().default(''),
});

export type ScreenContent = z.infer<typeof screenContentSchema>;

/**
 * Google Sheets CMS row format (Content tab).
 *
 * | kiosk_id | screen_key | title    | subtitle | body        |
 * | W001     | home       | 북인사마당 | ...      | ...         |
 * | W001     | intro      | 소개       |          | 본문 텍스트 |
 *
 * First row must be a header. screen_key maps to KioskScreenId cache keys.
 */
export const contentSheetRowSchema = z.object({
  kiosk_id: z.string().trim().min(1),
  screen_key: z.string().trim().min(1),
  title: z.string().trim().min(1),
  subtitle: z.string().trim().optional().default(''),
  body: z.string().default(''),
});

export type ContentSheetRow = z.infer<typeof contentSheetRowSchema>;

/** Known screen keys — used to warn on unknown keys without blocking sync. */
export const KNOWN_SCREEN_KEYS: readonly KioskScreenId[] = [
  'home',
  'intro',
  'guide',
  'events',
  'facilities',
  'food',
  'shopping',
  'culture',
];

export function parseScreenContent(data: Record<string, unknown>): ScreenContent | null {
  const result = screenContentSchema.safeParse(data);
  return result.success ? result.data : null;
}
