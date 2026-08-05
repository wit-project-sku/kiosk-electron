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
 * TEMPORARY — vertical-camera testing.
 *
 * true  → no countdown and no automatic send. Monitor 2 streams the camera
 *         indefinitely and the shot is taken only when 촬영 is pressed on the
 *         touch screen, which is also where the mount-rotation toggle lives.
 * false → normal kiosk behaviour: 10s countdown, auto-capture, auto-send.
 *
 * Flip this one flag back to false to restore the production flow.
 */
export const PHOTO_MANUAL_CAPTURE = true;

export const AI_GENERATION_MESSAGE = 'AI is creating your image';
export const AI_GENERATION_ESTIMATE = '30–60 seconds';
