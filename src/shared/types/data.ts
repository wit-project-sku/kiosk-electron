/**
 * Domain types for the data/analytics/sync layer.
 *
 * Kept separate from `domain.ts` to keep each file focused. No runtime logic
 * and no Node/Electron imports — safe to use from any process.
 */

import type { EntityId, IsoDateTime } from './domain';

/* ----------------------------- Analytics ------------------------------ */

/**
 * Known analytics event names. The `(string & {})` member keeps autocomplete
 * for the well-known events while still allowing custom event names without a
 * code change — analytics are append-only and must never be blocked by typing.
 */
export type AnalyticsEventName =
  | 'button_clicked'
  | 'page_view'
  | 'session_timeout'
  | 'ai_request_started'
  | 'ai_request_completed'
  | 'ai_request_failed'
  | 'photo_taken'
  | 'photo_deleted'
  | 'settings_changed'
  | 'session_started'
  | 'session_ended'
  | (string & {});

export type SyncState = 'pending' | 'synced';

/** An immutable analytics record. Events are never updated except to flip sync state. */
export interface AnalyticsEvent {
  readonly id: EntityId;
  readonly name: AnalyticsEventName;
  readonly payload: Record<string, unknown> | null;
  readonly sessionId: EntityId | null;
  readonly customerId: EntityId | null;
  readonly syncState: SyncState;
  readonly createdAt: IsoDateTime;
}

export interface CreateAnalyticsEvent {
  name: AnalyticsEventName;
  payload?: Record<string, unknown> | null;
  sessionId?: EntityId | null;
  customerId?: EntityId | null;
}

export interface AnalyticsReport {
  totalEvents: number;
  byName: { name: string; count: number }[];
  rangeStart: IsoDateTime | null;
  rangeEnd: IsoDateTime | null;
}

/* ----------------------------- Menu touch ----------------------------- */

/**
 * A completed menu-touch session: a menu button tap that left the home screen
 * paired with the moment the kiosk returned home. Sent renderer → main, which
 * adds the numeric `kioskId` and POSTs it to `/api/stats/menu-touch`.
 */
export interface MenuTouchInput {
  /** `buttons.id` of the menu button that left the home screen. */
  buttonId: number;
  /** `buttons.button_type` — the Korean label (only needed for the batch sync). */
  buttonType?: string | null;
  /** ISO-8601 with timezone offset, e.g. "2026-06-01T13:53:26+09:00". */
  touchedAt: IsoDateTime;
  /** ISO-8601 with timezone offset for when the kiosk returned to home. */
  backToHomeAt: IsoDateTime;
  /** Idempotency key (UUID v4) for the batch sync; generated in main if omitted. */
  eventId?: string;
}

/** The exact real-time POST body for `/api/stats/menu-touch` (no eventId/buttonType). */
export interface MenuTouchBody {
  /** Numeric kiosk id (1–5), derived from the kiosk config in the main process. */
  kioskId: number;
  buttonId: number;
  touchedAt: IsoDateTime;
  backToHomeAt: IsoDateTime;
}

/**
 * One item in the nightly batch body for `POST /api/stats/menu-touches/sync` —
 * menu touches whose real-time POST failed and were stored in local SQLite.
 * Adds `eventId` (idempotency) and `buttonType` over the real-time body.
 */
export interface MenuTouchSyncItem {
  /** Idempotency key — server dedupes; reused across batches. */
  eventId: string;
  kioskId: number;
  buttonId: number;
  buttonType: string | null;
  touchedAt: IsoDateTime;
  /** Nullable — a session that never returned home is saved with null. */
  backToHomeAt: IsoDateTime | null;
}

/* -------------------------------- Shots ------------------------------- */

/** Capture mode reported to the stats API: 혼자 찍기 vs 가상 캐릭터와 찍기. */
export type ShotType = 'SOLO' | 'TOGETHER';

/**
 * A completed photo capture (success or failure) reported to `/api/stats/shots`.
 * Fired from the main process at the end of the AI pipeline, which resolves the
 * numeric kioskId, timestamp, and idempotency key.
 */
export interface ShotInput {
  /** Whether the capture + AI generation pipeline succeeded. */
  isSuccess: boolean;
  /** Outfit code — alphanumeric, hyphen, dot (e.g. "1.1", "10.2-F"). */
  outfitCode: string;
  /** Numeric outfit id for the batch-sync endpoint; null when unknown. */
  outfitId?: number | null;
  /** SOLO / TOGETHER; omitted when the capture mode is unknown. */
  shotType?: ShotType;
  /** ISO-8601 with timezone; omitted → server stamps its current time. */
  shotAt?: IsoDateTime;
  /** Idempotency key (UUID v4); generated in main if omitted. */
  eventId?: string;
}

/** The exact POST body for `/api/stats/shots` (kioskId/eventId resolved in main). */
export interface ShotBody {
  /** Numeric kiosk id (1–5), derived from the kiosk config in the main process. */
  kioskId: number;
  shotAt: IsoDateTime | null;
  isSuccess: boolean;
  shotType: ShotType | null;
  outfitCode: string;
  /** Idempotency key — same value on retry blocks duplicate server records. */
  eventId: string;
}

/**
 * One item in the nightly batch body for `POST /api/stats/photo-shots/sync`.
 * Holds shots whose real-time `/api/stats/shots` POST failed and were stored in
 * local SQLite. Note: this endpoint takes `outfitId` (numeric, nullable) rather
 * than the real-time endpoint's `outfitCode`.
 */
export interface PhotoShotSyncItem {
  /** Idempotency key — server dedupes; reused across batches. */
  eventId: string;
  kioskId: number;
  /** Numeric outfit id; null saves the shot without an outfit. */
  outfitId: number | null;
  shotType: ShotType | null;
  isSuccess: boolean;
  /** ISO-8601 with timezone offset (KST +09:00 or UTC Z). */
  shotAt: IsoDateTime;
}

/* ------------------------------ Sessions ------------------------------ */

export type SessionStatus = 'active' | 'completed' | 'abandoned';

export interface Session {
  readonly id: EntityId;
  customerId: EntityId | null;
  status: SessionStatus;
  metadata: Record<string, unknown> | null;
  readonly startedAt: IsoDateTime;
  endedAt: IsoDateTime | null;
}

/* ------------------------------- Reports ------------------------------ */

export interface Report {
  readonly id: EntityId;
  title: string;
  type: string;
  data: Record<string, unknown>;
  readonly createdAt: IsoDateTime;
}

export type CreateReportInput = Pick<Report, 'title' | 'type' | 'data'>;

/* ------------------------------ Templates ----------------------------- */

/** Rarely-changing configuration loaded into memory at startup. */
export interface Template {
  readonly id: EntityId;
  key: string;
  name: string;
  content: Record<string, unknown>;
  enabled: boolean;
  readonly updatedAt: IsoDateTime;
}

/* ----------------------------- Sync queue ----------------------------- */

export type SyncJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type SyncJobType =
  | 'upload_image'
  | 'upload_analytics'
  | 'sync_customer'
  | 'sync_report'
  | (string & {});

export interface SyncJob {
  readonly id: EntityId;
  type: SyncJobType;
  payload: Record<string, unknown>;
  status: SyncJobStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  /** Earliest time the job may be retried (drives exponential backoff). */
  nextAttemptAt: IsoDateTime;
  readonly createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface SyncQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

/* --------------------------- Bootstrap / IO --------------------------- */

export type ExportFormat = 'csv' | 'excel' | 'json';
export type ExportEntity = 'customers' | 'analytics' | 'reports';

export interface ExportResult {
  filePath: string;
  rowCount: number;
}

export interface BackupResult {
  filePath: string;
  sizeBytes: number;
}

export interface RestoreResult {
  restored: boolean;
}
