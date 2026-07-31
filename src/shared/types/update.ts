/**
 * Auto-update status shared between the main-process UpdateService and the
 * renderer. This is the ONLY update-related shape the renderer sees — it never
 * touches electron-updater directly (see the preload bridge).
 */

/** Release channel. Production kiosks use `latest`; testing kiosks use `beta`. */
export type UpdateChannel = 'latest' | 'beta';

/**
 * Coarse state machine the UI renders from:
 *   idle        — not checked yet, or updater disabled (e.g. a dev build)
 *   checking    — a check is in flight
 *   available   — a newer version exists; background download is starting
 *   downloading — download in progress (see `progress`)
 *   downloaded  — staged; will install on restart
 *   up-to-date  — checked, already the newest on this channel
 *   error       — the last check/download failed (see `error`); the kiosk keeps
 *                 running the current version and retries later
 */
export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error';

export interface UpdateProgress {
  /** 0–100, rounded. */
  percent: number;
  /** Bytes downloaded so far. */
  transferred: number;
  /** Total bytes to download. */
  total: number;
  /** Current download speed in bytes/second. */
  bytesPerSecond: number;
}

export interface UpdateStatus {
  state: UpdateState;
  /** The channel this kiosk is pinned to (from UPDATE_CHANNEL). */
  channel: UpdateChannel;
  /** The version currently running. */
  currentVersion: string;
  /** The available/downloaded version, when a newer one was found. */
  availableVersion: string | null;
  /** Live download progress while `state === 'downloading'`, else null. */
  progress: UpdateProgress | null;
  /** Human-readable message for the most recent failure, else null. */
  error: string | null;
  /** True only in a packaged build wired to a real update feed. */
  enabled: boolean;
  /** epoch ms of the last check attempt (success or failure), or null. */
  lastCheckedAt: number | null;
  /** epoch ms of the next scheduled check (weekly window on production, or the
   *  next interval tick on beta), or null when unknown/disabled. */
  nextCheckAt: number | null;
}
