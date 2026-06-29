import gat from '@renderer/assets/effects/gat.svg';
import partyHat from '@renderer/assets/effects/party-hat.svg';
import sunglasses from '@renderer/assets/effects/sunglasses.svg';
import crown from '@renderer/assets/effects/crown.svg';
import flowerCrown from '@renderer/assets/effects/flower-crown.svg';
import bunnyEars from '@renderer/assets/effects/bunny-ears.svg';
import type { LangText } from '@renderer/data/types';

/**
 * AR wearables for the 인스타 효과 screen. Each is a transparent cut-out anchored
 * to the face by FaceLandmarker on Monitor 2 (and composited into the capture).
 *
 * `hat` anchors above the forehead and scales to face width; `glasses` anchors on
 * the eye line and scales to the eye distance. The tuning factors below are
 * starting points — adjust against the live kiosk if a prop sits too high/wide.
 * SVG props are placeholders; drop in photoreal transparent PNGs the same way.
 */

export type WearableType = 'hat' | 'glasses';

export interface Wearable {
  id: string;
  name: LangText;
  src: string;
  type: WearableType;
  /** Overlay width as a multiple of the anchor span (face width / eye distance). */
  widthFactor: number;
  /** SVG width ÷ height — keeps the overlay undistorted. */
  aspect: number;
  /** Shift the overlay centre up from the anchor, as a fraction of overlay height. */
  offsetYFactor: number;
}

export const WEARABLES: readonly Wearable[] = [
  { id: 'gat', name: { ko: '갓', en: 'Gat', ja: 'カッ', zh: '笠帽' }, src: gat, type: 'hat', widthFactor: 2.0, aspect: 1.6, offsetYFactor: 0.45 },
  { id: 'crown', name: { ko: '왕관', en: 'Crown', ja: '王冠', zh: '皇冠' }, src: crown, type: 'hat', widthFactor: 1.5, aspect: 1.538, offsetYFactor: 0.42 },
  { id: 'flower', name: { ko: '꽃관', en: 'Flowers', ja: '花冠', zh: '花冠' }, src: flowerCrown, type: 'hat', widthFactor: 1.9, aspect: 2.0, offsetYFactor: 0.35 },
  { id: 'party', name: { ko: '파티모자', en: 'Party Hat', ja: 'パーティ帽', zh: '派对帽' }, src: partyHat, type: 'hat', widthFactor: 1.1, aspect: 0.778, offsetYFactor: 0.5 },
  { id: 'bunny', name: { ko: '토끼귀', en: 'Bunny Ears', ja: 'うさ耳', zh: '兔耳朵' }, src: bunnyEars, type: 'hat', widthFactor: 1.7, aspect: 1.0, offsetYFactor: 0.5 },
  { id: 'sunglasses', name: { ko: '선글라스', en: 'Sunglasses', ja: 'サングラス', zh: '墨镜' }, src: sunglasses, type: 'glasses', widthFactor: 1.45, aspect: 2.667, offsetYFactor: 0.0 },
] as const;

export function wearableById(id: string): Wearable | null {
  return WEARABLES.find((w) => w.id === id) ?? null;
}
