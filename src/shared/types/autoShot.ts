/**
 * 자동 촬영 — the kiosk takes a photo itself when the venue's daily minimum
 * (kioskLocations.autoShotDailyMin) is not yet met. Main decides WHEN, the
 * touch-screen window decides whether the moment is right (home screen, nobody
 * touching, nobody in front of the camera) and captures the frame.
 */

/** Whether a 자동 촬영 should be taken now. */
export interface AutoShotPlan {
  /** This venue takes 자동 촬영 at all — false everywhere but the venues with a minimum. */
  enabled: boolean;
  /** Take one now. */
  due: boolean;
  /** Why not (or `due`), for the log. */
  reason: 'off' | 'outside-hours' | 'met' | 'busy' | 'session' | 'due';
  /** Shots this PC recorded today. */
  today: number;
  /** How many there should be by now. */
  target: number;
  /** The venue's camera mount rotation — what the visitor flow captures with. */
  rotation: 0 | 90 | 180 | 270;
  /** How the touch-screen window paces itself (AutoShotTiming). */
  timing: AutoShotTiming;
}

/** The touch-screen window's pacing. Production values unless main's env says otherwise. */
export interface AutoShotTiming {
  /** First check after launch. */
  firstCheckMs: number;
  /** Between checks. */
  checkEveryMs: number;
  /** No touch for this long before the camera may open. */
  idleMs: number;
}

/** One 자동 촬영, captured by the touch-screen window. */
export interface AutoShotRunRequest {
  /** The camera frame (JPEG data URL), already upright. */
  dataUrl: string;
  /** "gender|code", as the visitor flow sends it. */
  clothingKey: string;
  /** 배경 테마, or null. */
  backgroundId: number | null;
}

export interface AutoShotRunResult {
  /** The shot was taken (whatever the AR result — a failed composite is still a shot). */
  taken: boolean;
  reason: AutoShotPlan['reason'];
}
