/**
 * Domain types shared across the main and renderer processes.
 *
 * These types describe the application's core entities and are the single
 * source of truth for data shape. They contain no runtime logic and no
 * Node/Electron dependencies, so they can be imported from anywhere.
 */

/** ISO-8601 timestamp string (e.g. `2026-06-10T06:00:00.000Z`). */
export type IsoDateTime = string;

/** Unique identifier for a persisted entity. */
export type EntityId = number;

export interface Customer {
  readonly id: EntityId;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

/** Payload for creating a customer (server assigns id + timestamps). */
export type CreateCustomerInput = Pick<
  Customer,
  'firstName' | 'lastName' | 'email' | 'phone' | 'notes'
>;

/** Payload for updating a customer. All fields optional except id. */
export type UpdateCustomerInput = Partial<CreateCustomerInput>;

/** A media asset (image or video) stored on the local filesystem. */
export interface ImageAsset {
  readonly id: EntityId;
  customerId: EntityId | null;
  fileName: string;
  /** Absolute path to the original file on disk. */
  filePath: string;
  /** Absolute path to the generated thumbnail, if any. */
  thumbnailPath: string | null;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  readonly createdAt: IsoDateTime;
}

export type CreateImageInput = Pick<
  ImageAsset,
  | 'customerId'
  | 'fileName'
  | 'filePath'
  | 'thumbnailPath'
  | 'mimeType'
  | 'byteSize'
  | 'width'
  | 'height'
>;

/** Cursor-free pagination request. */
export interface PageQuery {
  /** Zero-based page index. */
  page: number;
  /** Items per page. */
  pageSize: number;
  /** Optional free-text search term. */
  search?: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export type DisplayMode =
  | 'attract'
  | 'camera'
  | 'countdown'
  | 'generating'
  | 'result'
  | 'idle'
  | 'image'
  | 'video'
  | 'slideshow';

/** Persisted application settings. */
export interface AppSettings {
  theme: ThemeMode;
  /** Whether the customer display window launches in kiosk mode. */
  displayKioskMode: boolean;
  /** Slideshow interval in milliseconds. */
  slideshowIntervalMs: number;
  /** Target display id for the customer window (null = auto-detect). */
  preferredDisplayId: number | null;
  businessName: string;
}

/** Content currently shown on the customer display window. */
export interface DisplayState {
  mode: DisplayMode;
  /** Asset ids for slideshow, or a single asset for image/video. */
  assetIds: EntityId[];
  /** Optional headline shown in idle/attract mode. */
  message: string | null;
  /** Active camera device for live preview on Monitor 2. */
  cameraDeviceId: string | null;
  /** Countdown value (3, 2, 1) shown on Monitor 2. */
  countdown: number | null;
  /** Generated result file name — served via media://generated/ */
  resultFileName: string | null;
}

/** Information about a connected monitor. */
export interface MonitorInfo {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  isPrimary: boolean;
}
