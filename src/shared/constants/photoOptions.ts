import type { PhotoOption } from '@shared/types/photo';

/** Default clothing options — overridden by local_cache key `photo_clothing`. */
export const DEFAULT_CLOTHING_OPTIONS: PhotoOption[] = [
  { key: 'hanbok', label: '한복' },
  { key: 'modern', label: '모던' },
  { key: 'traditional', label: '전통' },
  { key: 'casual', label: '캐주얼' },
];

/** Default style options — overridden by local_cache key `photo_styles`. */
export const DEFAULT_STYLE_OPTIONS: PhotoOption[] = [
  { key: 'classic', label: '클래식' },
  { key: 'vintage', label: '빈티지' },
  { key: 'artistic', label: '아트' },
  { key: 'portrait', label: '포트레이트' },
];

export const PHOTO_COUNTDOWN_SECONDS = 10;

/**
 * Degrees CLOCKWISE the raw camera frame must be turned to stand upright.
 *
 * The kiosk cameras are MOUNTED SIDEWAYS (2026-08-24): the sensor delivers a
 * 16:9 landscape frame whose content is rotated, and turning it 90° yields the
 * true 9:16 portrait stream the second screen shows. This one constant drives
 * BOTH consumers, which must never disagree:
 *   · the live preview  (JejuCameraGuide .feed)
 *   · the captured JPEG (useKioskCamera.capture) — the AR API must receive the
 *     upright photo, not the raw sideways frame
 * If a venue's camera is mounted the other way round, set 270; an unrotated
 * camera is 0. (Per-venue values can hang off kioskLocations if fleets ever
 * mix mountings.)
 */
export const PHOTO_CAMERA_ROTATION: 0 | 90 | 180 | 270 = 90;

export const AI_GENERATION_MESSAGE = 'AI is creating your image';
export const AI_GENERATION_ESTIMATE = '30–60 seconds';
