import { z } from 'zod';

export const photoOptionSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  imageKey: z.string().trim().optional(),
});

export const photoOptionsListSchema = z.array(photoOptionSchema).min(1);

export const photoCaptureRequestSchema = z.object({
  sessionId: z.string().uuid(),
  dataUrl: z.string().startsWith('data:image/'),
  clothingKey: z.string().min(1),
  styleKey: z.string().min(1),
  // No backgroundId here on purpose: the capture handler reads the visitor's
  // 배경 테마 off the authoritative workflow state, not off this request.
});

export const photoSelectionSchema = z.object({
  clothingKey: z.string().min(1).optional(),
  styleKey: z.string().min(1).optional(),
  /** 제주 배경 테마 (witteria `backgrounds.id`) → AR `background_to_use`. */
  backgroundId: z.number().int().positive().nullable().optional(),
});
