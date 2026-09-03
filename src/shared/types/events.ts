/**
 * Events API types (GET /api/events).
 *
 * Returns a paginated list of local events for a kiosk's region, filtered by
 * category and an optional search keyword. Shared between the main-process
 * EventsService (which fetches + normalizes) and the renderer events pages.
 */

/** Region query values accepted by the API. */
export type EventRegion = 'JONGNO' | 'INSA' | 'HWASEONG' | 'OSAN' | 'JEJU';

/** Category query values accepted by the API (ALL = no filter). */
export type EventCategory = 'ALL' | 'SHOW' | 'EXHIBITION' | 'FESTIVAL' | 'EDUEXP' | 'ETC';

/** Query parameters for a single events page request. */
export interface EventsQuery {
  eventRegion: EventRegion;
  eventCategory: EventCategory;
  /** Optional free-text search. */
  keyword?: string;
  /** 1-based page number. */
  pageNum: number;
  pageSize: number;
}

/** A single event row as returned by the API (mainImage resolved to an absolute URL). */
export interface EventItem {
  eventId: number;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  eventCategory: EventCategory;
  /** Absolute image URL (empty when the event has no image). */
  mainImage: string;
}

/** One page of events plus the API's pagination metadata. */
export interface EventsPage {
  content: EventItem[];
  totalElements: number;
  totalPages: number;
  pageNum: number;
  pageSize: number;
  last: boolean;
}

/**
 * Raw API envelope shape (before normalization). Prod returns a paginated
 * EventsPage; the stage API returns the full filtered list as a bare array
 * (pageNum/pageSize ignored) — EventsService paginates that client-side.
 */
export interface EventsApiResponse {
  success: boolean;
  code: number;
  message: string;
  data: EventsPage | EventItem[];
}

/** Query for the MBTI recommendation endpoint (GET /api/events/recommend). */
export interface EventsRecommendQuery {
  region: EventRegion;
  /** Selected MBTI letters in canonical order (e.g. "ENFP"; may be partial). */
  mbti: string;
}

/** A recommended event — a lighter shape than EventItem (no date/category/location). */
export interface EventRecommendation {
  eventId: number;
  title: string;
  /** Absolute image URL (empty when the event has no image). */
  mainImage: string;
}

/** Raw envelope for the recommendation endpoint (data is a bare array). */
export interface EventsRecommendApiResponse {
  success: boolean;
  code: number;
  message: string;
  data: EventRecommendation[];
}

/**
 * Full event record returned by GET /api/events/{eventId}. Most extended
 * fields are nullable — the admin only fills them in for some events — so the
 * detail UI hides empty rows. `eventCategory` is a raw string here because the
 * detail endpoint emits values outside the list-filter union (e.g.
 * MUSICAL_OPERA).
 */
export interface EventDetail {
  eventId: number;
  title: string;
  location: string;
  /**
   * Nullable in practice, whatever the endpoint's docs say: the admin can save
   * an event with no dates, and the detail endpoint then sends `null` for both.
   * Typed honestly because the one place that reads them printed the literal
   * "null ~ null" on the kiosk while they were `string` — see infoRows.
   */
  startDate: string | null;
  endDate: string | null;
  eventTime: string | null;
  eventCategory: string;
  orgName: string | null;
  recruitTarget: string | null;
  price: string | null;
  inquiry: string | null;
  description: string | null;
  orgLink: string | null;
  /** Absolute image URL (empty when the event has no image). */
  mainImage: string;
  latitude: number | null;
  longitude: number | null;
  isFree: boolean | null;
}

/** Raw envelope for the detail endpoint. */
export interface EventDetailApiResponse {
  success: boolean;
  code: number;
  message: string;
  data: EventDetail | null;
}
