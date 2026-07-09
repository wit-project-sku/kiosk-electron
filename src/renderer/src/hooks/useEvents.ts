import { useEffect, useState } from 'react';
import { isOk } from '@shared/types/result';
import type { EventCategory, EventDetail, EventItem, EventRegion } from '@shared/types/events';

export interface UseEventsResult {
  items: EventItem[];
  totalPages: number;
  totalElements: number;
  last: boolean;
  loading: boolean;
  /** True when the last fetch failed (network/offline) — pages show an empty state. */
  error: boolean;
}

const EMPTY: UseEventsResult = {
  items: [],
  totalPages: 1,
  totalElements: 0,
  last: true,
  loading: false,
  error: false,
};

/**
 * Fetches one page of events from the witteria API (via the main process).
 * Refetches whenever region/category/keyword/page changes and ignores stale
 * responses so fast tab-switching can't flash an out-of-order page. Passing a
 * null region (the MBTI tab) skips fetching and returns the empty result.
 */
export function useEvents(
  region: EventRegion | null,
  category: EventCategory,
  page: number,
  pageSize: number,
  keyword = '',
): UseEventsResult {
  const [state, setState] = useState<UseEventsResult>(EMPTY);

  useEffect(() => {
    if (!region) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: false }));
    void window.api.eventsApi
      .list({ eventRegion: region, eventCategory: category, keyword, pageNum: page, pageSize })
      .then((res) => {
        if (cancelled) return;
        if (isOk(res)) {
          setState({
            items: res.value.content,
            totalPages: Math.max(1, res.value.totalPages),
            totalElements: res.value.totalElements,
            last: res.value.last,
            loading: false,
            error: false,
          });
        } else {
          setState({ ...EMPTY, error: true });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ ...EMPTY, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [region, category, page, pageSize, keyword]);

  return state;
}

export interface UseEventDetailResult {
  detail: EventDetail | null;
  loading: boolean;
  /** True when the fetch failed (network/offline). */
  error: boolean;
}

/**
 * Fetches one event's full record (the detail modal). Passing null skips
 * fetching (modal closed); stale responses are ignored so quickly tapping
 * between cards can't show the wrong event.
 */
export function useEventDetail(eventId: number | null): UseEventDetailResult {
  const [state, setState] = useState<UseEventDetailResult>({ detail: null, loading: false, error: false });

  useEffect(() => {
    if (eventId === null) {
      setState({ detail: null, loading: false, error: false });
      return;
    }
    let cancelled = false;
    setState({ detail: null, loading: true, error: false });
    void window.api.eventsApi
      .detail(eventId)
      .then((res) => {
        if (cancelled) return;
        if (isOk(res)) setState({ detail: res.value, loading: false, error: false });
        else setState({ detail: null, loading: false, error: true });
      })
      .catch(() => {
        if (!cancelled) setState({ detail: null, loading: false, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return state;
}

/**
 * A compact, sliding window of page numbers around `current` (so 50-page results
 * don't render 50 buttons). Returns 1-based page numbers, at most `size` of them.
 */
export function pageWindow(current: number, total: number, size = 5): number[] {
  const count = Math.min(size, Math.max(1, total));
  const start = Math.max(1, Math.min(current - Math.floor(count / 2), total - count + 1));
  return Array.from({ length: count }, (_, i) => start + i);
}
