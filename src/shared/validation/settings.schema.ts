import { z } from 'zod';

export const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  displayKioskMode: z.boolean(),
  slideshowIntervalMs: z.number().int().min(1000).max(120_000),
  preferredDisplayId: z.number().int().nullable(),
  businessName: z.string().trim().min(1).max(120),
});

export const settingsUpdateSchema = settingsSchema.partial();

export type SettingsFormValues = z.infer<typeof settingsSchema>;
