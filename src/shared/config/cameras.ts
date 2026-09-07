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

/** The photo camera we prefer when several are available. */
export const PREFERRED_CAMERA_PATTERN = /elgato|facecam|cam link|prompter/i;

export type CameraVendor = 'elgato' | 'usb' | 'depth' | 'unknown';

export function classifyCamera(label: string): CameraVendor {
  // Checked FIRST: a depth sensor is disqualifying, and no later branch may
  // reclassify it as a usable camera.
  if (DEPTH_CAMERA_PATTERN.test(label)) return 'depth';
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
