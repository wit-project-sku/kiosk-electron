/**
 * Which camera may take the photo — the one rule main and the renderer must
 * never disagree about.
 *
 * 제주 runs two cameras side by side: an Elgato that takes the picture, and a
 * ZED 2i that measures visitor height headlessly (see HeightService). The ZED
 * is a STEREO device — as a plain UVC camera it emits BOTH sensors in one
 * frame, so a photo taken with it shows the visitor twice, and that is what
 * would reach the AR API.
 *
 * It has to be excluded in two independent ways, because each one alone has a
 * hole:
 *
 *  · BY LABEL, which is cheap and exact — but `enumerateDevices()` returns
 *    EMPTY labels until camera permission has been granted, and an empty label
 *    matches nothing.
 *  · BY SHAPE, which needs no label at all. A stereo pair is far wider (or,
 *    on a rotated mount, far taller) than any real webcam, so the frame itself
 *    gives the device away once it is open.
 */

/** Depth/stereo cameras. Never valid as the photo camera. */
export const DEPTH_CAMERA_PATTERN = /\bzed\b|stereolabs/i;

/**
 * The FillMe 손톱 분석 hand camera — a third 제주 camera (Arducam 16MP, IMX298),
 * mounted looking down at the hand rest. It belongs to that screen alone
 * (`layouts/jeju/fillme/camera.ts`), so it is never valid as the photo, motion
 * or footfall camera: those would quietly open a close-up of a desk. Windows
 * also gives a UVC camera to one opener at a time, so footfall holding it would
 * leave the FillMe screen with "카메라를 사용할 수 없어요".
 *
 * No shape backstop exists for this one (it is 4:3 like any webcam), so every
 * opener also checks the opened TRACK's label — see `isReservedCamera`.
 */
export const HAND_CAMERA_PATTERN = /arducam/i;

/** The photo camera we prefer when several are available. */
export const PREFERRED_CAMERA_PATTERN = /elgato|facecam|cam link|prompter/i;

/**
 * Cameras that some other feature owns: the ZED (height sidecar) and the
 * Arducam (FillMe). The photo, motion and footfall paths skip these.
 *
 * Use it on the enumerated label AND on the opened track's label — a track's
 * label is always filled in, even when `enumerateDevices()` gave an empty one.
 */
export function isReservedCamera(label: string): boolean {
  return DEPTH_CAMERA_PATTERN.test(label) || HAND_CAMERA_PATTERN.test(label);
}

export type CameraVendor = 'elgato' | 'usb' | 'depth' | 'hand' | 'unknown';

export function classifyCamera(label: string): CameraVendor {
  // Checked FIRST: a depth sensor or the FillMe hand camera is disqualifying,
  // and no later branch may reclassify it as a usable camera.
  if (DEPTH_CAMERA_PATTERN.test(label)) return 'depth';
  if (HAND_CAMERA_PATTERN.test(label)) return 'hand';
  if (PREFERRED_CAMERA_PATTERN.test(label)) return 'elgato';
  if (label.trim().length > 0) return 'usb';
  return 'unknown';
}

/**
 * Does this frame look like a side-by-side (or stacked) stereo pair?
 *
 * The backstop for the empty-label case. A ZED 2i emits 2560x720 — an aspect of
 * 3.56 — or 720x2560 (0.28) when the driver has been set to rotate it. Ordinary
 * webcams live between 1.33 and 1.78, and even an anamorphic ultrawide stops
 * around 2.4, so the gap either side is wide and unambiguous.
 *
 * Deliberately checks BOTH orientations: the 제주 cameras are mounted rotated
 * 90°, and a stereo pair from a rotated mount is tall rather than wide.
 */
export function looksLikeStereoPair(width: number, height: number): boolean {
  if (!width || !height) return false;
  const aspect = width / height;
  return aspect > 2.6 || aspect < 1 / 2.6;
}
