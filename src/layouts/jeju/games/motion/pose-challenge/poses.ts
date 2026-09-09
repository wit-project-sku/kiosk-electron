/**
 * The five 제주 poses, and the stick figures that show them.
 *
 * ══ ONE SPEC, TWO USES ════════════════════════════════════════════════
 * Each pose is a list of limb angles. That same list BOTH scores the visitor
 * (via `scorePose`) and draws the target diagram (via {@link poseFigure}) — so
 * the picture on screen and the thing being measured cannot drift apart. The
 * obvious alternative, an illustration per pose plus a scoring rule per pose,
 * has two sources of truth and eventually shows a visitor one shape while
 * grading them against another.
 *
 * ── Angles are in MIRRORED SCREEN SPACE ───────────────────────────────
 * 0° points right, 90° points DOWN (canvas convention), −90° points up. The
 * landmarks these are compared against have already been mirrored by
 * `toBodyLandmarks`, so "the arm on the left of the screen" is what LEFT_*
 * means here — which is also the arm the visitor sees on the left of their own
 * preview. Define new poses by looking at the preview, not by imagining the
 * camera's point of view.
 *
 * ── Upper body only, and that is not a shortcut ───────────────────────
 * 제주's camera is mounted portrait between the two screens and crops a
 * standing visitor at roughly the hip. Legs are not in frame. Every pose here
 * is therefore arms-and-torso, which also happens to be what a public kiosk
 * should ask of a stranger in an airport: nothing that requires balance,
 * crouching, or looking foolish in front of a queue.
 */
import type { LimbSpec } from '../poseMath';
import { LM } from '../poseTypes';
import type { MOTION } from '../motionText';

export interface JejuPose {
  id: string;
  /** Key into MOTION for the pose's display name. */
  nameKey: keyof typeof MOTION;
  glyph: string;
  limbs: LimbSpec[];
}

/**
 * Ordered easiest to hardest, as the brief's five rounds ask.
 *
 * The difficulty ramp is really about SYMMETRY: a symmetric pose is one shape
 * to copy, and the visitor can check themselves in the preview at a glance. An
 * asymmetric one has to be mirrored mentally, which is the genuinely harder
 * thing to do in front of a screen — so the last two are the asymmetric ones.
 */
export const POSES: JejuPose[] = [
  {
    // Hands resting on the belly, the way every 돌하르방 on the island stands.
    id: 'hareubang',
    nameKey: 'poseHareubang',
    glyph: '🗿',
    limbs: [
      { from: LM.LEFT_SHOULDER, to: LM.LEFT_ELBOW, angle: 100, weight: 1 },
      { from: LM.LEFT_ELBOW, to: LM.LEFT_WRIST, angle: 25, weight: 1.2 },
      { from: LM.RIGHT_SHOULDER, to: LM.RIGHT_ELBOW, angle: 80, weight: 1 },
      { from: LM.RIGHT_ELBOW, to: LM.RIGHT_WRIST, angle: 155, weight: 1.2 },
    ],
  },
  {
    // Both hands to the sky. The easiest pose there is, and the one everyone
    // does without being asked once they realise the camera is watching.
    id: 'sunshine',
    nameKey: 'poseSunshine',
    glyph: '☀️',
    limbs: [
      { from: LM.LEFT_SHOULDER, to: LM.LEFT_ELBOW, angle: -105, weight: 1.2 },
      { from: LM.LEFT_ELBOW, to: LM.LEFT_WRIST, angle: -95, weight: 1 },
      { from: LM.RIGHT_SHOULDER, to: LM.RIGHT_ELBOW, angle: -75, weight: 1.2 },
      { from: LM.RIGHT_ELBOW, to: LM.RIGHT_WRIST, angle: -85, weight: 1 },
    ],
  },
  {
    // Arms straight out — the horizon 제주 is surrounded by.
    id: 'ocean',
    nameKey: 'poseOcean',
    glyph: '🌊',
    limbs: [
      { from: LM.LEFT_SHOULDER, to: LM.LEFT_ELBOW, angle: 180, weight: 1.2 },
      { from: LM.LEFT_ELBOW, to: LM.LEFT_WRIST, angle: 180, weight: 1.2 },
      { from: LM.RIGHT_SHOULDER, to: LM.RIGHT_ELBOW, angle: 0, weight: 1.2 },
      { from: LM.RIGHT_ELBOW, to: LM.RIGHT_WRIST, angle: 0, weight: 1.2 },
    ],
  },
  {
    // 해녀 surfacing: both arms up and out at a diagonal.
    id: 'haenyeo',
    nameKey: 'poseHaenyeo',
    glyph: '🐚',
    limbs: [
      { from: LM.LEFT_SHOULDER, to: LM.LEFT_ELBOW, angle: -145, weight: 1.2 },
      { from: LM.LEFT_ELBOW, to: LM.LEFT_WRIST, angle: -145, weight: 1 },
      { from: LM.RIGHT_SHOULDER, to: LM.RIGHT_ELBOW, angle: -35, weight: 1.2 },
      { from: LM.RIGHT_ELBOW, to: LM.RIGHT_WRIST, angle: -35, weight: 1 },
    ],
  },
  {
    // 조랑말: one hand up on the reins, one out for balance. Asymmetric, so it
    // is the one that has to be thought about — hence last.
    id: 'horse',
    nameKey: 'poseHorse',
    glyph: '🐴',
    limbs: [
      { from: LM.LEFT_SHOULDER, to: LM.LEFT_ELBOW, angle: -95, weight: 1.2 },
      { from: LM.LEFT_ELBOW, to: LM.LEFT_WRIST, angle: -90, weight: 1 },
      { from: LM.RIGHT_SHOULDER, to: LM.RIGHT_ELBOW, angle: 5, weight: 1.2 },
      { from: LM.RIGHT_ELBOW, to: LM.RIGHT_WRIST, angle: 55, weight: 1 },
    ],
  },
];

/** A point in the diagram's 200×230 viewBox. */
export interface FigurePoint {
  x: number;
  y: number;
}

/** Figure proportions, in viewBox units. */
const SHOULDER_L: FigurePoint = { x: 74, y: 92 };
const SHOULDER_R: FigurePoint = { x: 126, y: 92 };
const UPPER_ARM = 40;
const FOREARM = 38;

function step(from: FigurePoint, angleDeg: number, length: number): FigurePoint {
  const a = (angleDeg * Math.PI) / 180;
  return { x: from.x + Math.cos(a) * length, y: from.y + Math.sin(a) * length };
}

/**
 * Turn a pose spec into the joint positions its diagram draws.
 *
 * Reads the angles straight out of `limbs`, so the figure IS the spec. A pose
 * whose limb list is edited redraws itself with no second edit.
 */
export function poseFigure(pose: JejuPose): {
  shoulderL: FigurePoint;
  shoulderR: FigurePoint;
  elbowL: FigurePoint;
  wristL: FigurePoint;
  elbowR: FigurePoint;
  wristR: FigurePoint;
} {
  const find = (from: number, to: number): number =>
    pose.limbs.find((l) => l.from === from && l.to === to)?.angle ?? 90;

  const elbowL = step(SHOULDER_L, find(LM.LEFT_SHOULDER, LM.LEFT_ELBOW), UPPER_ARM);
  const elbowR = step(SHOULDER_R, find(LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW), UPPER_ARM);
  return {
    shoulderL: SHOULDER_L,
    shoulderR: SHOULDER_R,
    elbowL,
    wristL: step(elbowL, find(LM.LEFT_ELBOW, LM.LEFT_WRIST), FOREARM),
    elbowR,
    wristR: step(elbowR, find(LM.RIGHT_ELBOW, LM.RIGHT_WRIST), FOREARM),
  };
}

/** Feedback band for a round's score. */
export type PoseGrade = 'perfect' | 'great' | 'good' | 'almost';

/**
 * The brief's bands. Note the bottom one is "almost", never "wrong" — a public
 * kiosk should not tell a stranger in an airport that they failed at standing.
 */
export function gradeOf(score: number): PoseGrade {
  if (score >= 0.95) return 'perfect';
  if (score >= 0.85) return 'great';
  if (score >= 0.7) return 'good';
  return 'almost';
}
