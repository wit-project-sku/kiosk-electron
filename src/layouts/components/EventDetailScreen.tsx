import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { EventDetail } from '@shared/types/events';
import { useEventDetail } from '@renderer/hooks/useEvents';
import type { Lang } from '@renderer/lib/i18n';
import { useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { ui } from '@renderer/lib/uiText';
import styles from './EventDetailScreen.module.css';

/* ── Interactive map (오시는 길 안내) ────────────────────────────────────────
   The events API provides only latitude/longitude (no map URL), and the
   production CSP forbids embedding a hosted map (frame-src falls back to
   default-src 'self') while allowing any https IMAGE. So the map is built
   from OpenStreetMap raster tiles (plain <img> loads) with pan/zoom handled
   here. A hand-rolled engine is also what makes touch dragging track the
   finger 1:1 — the whole artboard is CSS-scaled (--kiosk-scale), which
   distorts pointer deltas for off-the-shelf map libraries like Leaflet. */

const MAP_W = 1514;
const MAP_H = 631;
/** Render each 256px OSM tile at 512 artboard px (the 2160px artboard ≈ 2× physical). */
const TILE_PX = 512;
const ZOOM_DEFAULT = 16;
const ZOOM_MIN = 7;
const ZOOM_MAX = 19; // OSM tile server maximum

interface LatLng {
  lat: number;
  lng: number;
}

/** Web-Mercator world-pixel position of a coordinate at `zoom` (TILE_PX tiles). */
function project(p: LatLng, zoom: number): { x: number; y: number } {
  const worldPx = 2 ** zoom * TILE_PX;
  const latRad = (p.lat * Math.PI) / 180;
  return {
    x: ((p.lng + 180) / 360) * worldPx,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * worldPx,
  };
}

/** Inverse of {@link project}. */
function unproject(x: number, y: number, zoom: number): LatLng {
  const worldPx = 2 ** zoom * TILE_PX;
  const lng = (x / worldPx) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / worldPx;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  // Keep the view inside the Mercator projection's valid latitude band.
  return { lat: Math.max(-85, Math.min(85, lat)), lng };
}

interface MapTile {
  key: string;
  url: string;
  left: number;
  top: number;
}

/** OSM tiles covering the viewport centered on `center` (+1 tile ring so
    freshly exposed edges during a drag are usually already loaded). */
function mapTiles(center: LatLng, zoom: number): MapTile[] {
  const n = 2 ** zoom;
  const c = project(center, zoom);
  const originX = c.x - MAP_W / 2;
  const originY = c.y - MAP_H / 2;

  const tiles: MapTile[] = [];
  const firstX = Math.floor(originX / TILE_PX) - 1;
  const lastX = Math.floor((originX + MAP_W) / TILE_PX) + 1;
  const firstY = Math.floor(originY / TILE_PX) - 1;
  const lastY = Math.floor((originY + MAP_H) / TILE_PX) + 1;
  for (let ty = firstY; ty <= lastY; ty++) {
    for (let tx = firstX; tx <= lastX; tx++) {
      if (ty < 0 || ty >= n) continue;
      const wrappedX = ((tx % n) + n) % n; // longitude wraps
      tiles.push({
        key: `${zoom}/${tx}/${ty}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
        left: tx * TILE_PX - originX,
        top: ty * TILE_PX - originY,
      });
    }
  }
  return tiles;
}

interface InteractiveMapProps {
  /** Event coordinates — the marker position and the initial/recenter view. */
  lat: number;
  lng: number;
}

/** Pinch zoom triggers a ±1 zoom step each time the finger distance grows or
    shrinks by this ratio since the last step. */
const PINCH_STEP_RATIO = 1.3;

/**
 * Drag-to-pan / pinch- and button-zoom slippy map. Pointer deltas arrive in
 * PHYSICAL pixels while the layout runs in 2160-wide artboard pixels, so all
 * gesture math divides by the live render scale (element width ÷ MAP_W) —
 * this is what keeps the map glued to the fingers on the scaled kiosk
 * display. Two-finger gestures pan with the midpoint and step the zoom
 * around it; a third finger is ignored.
 */
function InteractiveMap({ lat, lng }: InteractiveMapProps): JSX.Element {
  const [center, setCenter] = useState<LatLng>({ lat, lng });
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [dragging, setDragging] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /** Finger distance at the last pinch zoom step (null = not pinching). */
  const pinchBase = useRef<number | null>(null);

  /** Live render scale of the map element (physical px per artboard px). */
  const renderScale = (): number => {
    const rect = mapRef.current?.getBoundingClientRect();
    return rect && rect.width > 0 ? rect.width / MAP_W : 1;
  };

  /** Pan the view by a physical-pixel delta. */
  const panBy = (dxPhys: number, dyPhys: number): void => {
    const s = renderScale();
    const dx = dxPhys / s;
    const dy = dyPhys / s;
    setCenter((c) => {
      const w = project(c, zoom);
      return unproject(w.x - dx, w.y - dy, zoom);
    });
  };

  /** Step the zoom keeping the geographic point under `client` fixed. */
  const zoomAt = (client: { x: number; y: number }, delta: number): void => {
    const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + delta));
    if (next === zoom) return;
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) {
      setZoom(next);
      return;
    }
    const s = rect.width / MAP_W;
    // Anchor point in artboard container coordinates.
    const mx = (client.x - rect.left) / s;
    const my = (client.y - rect.top) / s;
    const view = project(center, zoom);
    const anchor = unproject(view.x - MAP_W / 2 + mx, view.y - MAP_H / 2 + my, zoom);
    const anchorNext = project(anchor, next);
    setCenter(unproject(anchorNext.x - mx + MAP_W / 2, anchorNext.y - my + MAP_H / 2, next));
    setZoom(next);
  };

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
    Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    // Presses on the zoom/recenter buttons are clicks, not drags — capturing
    // the pointer here would swallow them.
    if ((e.target as HTMLElement).closest('button')) return;
    if (pointers.current.size >= 2) return; // ignore a third finger
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    mapRef.current?.setPointerCapture(e.pointerId);
    setDragging(true);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchBase.current = dist(a!, b!);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;

    if (pointers.current.size === 2) {
      // Two-finger gesture: pan with the midpoint, step-zoom on pinch.
      const otherEntry = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)!;
      const other = otherEntry[1];
      const oldMid = mid(prev, other);
      const moved = { x: e.clientX, y: e.clientY };
      pointers.current.set(e.pointerId, moved);
      const newMid = mid(moved, other);
      panBy(newMid.x - oldMid.x, newMid.y - oldMid.y);

      const newDist = dist(moved, other);
      const base = pinchBase.current ?? newDist;
      if (newDist >= base * PINCH_STEP_RATIO) {
        zoomAt(newMid, 1);
        pinchBase.current = newDist;
      } else if (newDist <= base / PINCH_STEP_RATIO) {
        zoomAt(newMid, -1);
        pinchBase.current = newDist;
      }
      return;
    }

    // Single-finger drag.
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    panBy(e.clientX - prev.x, e.clientY - prev.y);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size < 2) pinchBase.current = null;
    if (pointers.current.size === 0) setDragging(false);
  };

  const zoomBy = (delta: number): void => {
    setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z + delta)));
  };

  const recenter = (): void => {
    setCenter({ lat, lng });
    setZoom(ZOOM_DEFAULT);
  };

  // Marker sits at the EVENT coordinates within the current view.
  const view = project(center, zoom);
  const markerWorld = project({ lat, lng }, zoom);
  const markerLeft = markerWorld.x - (view.x - MAP_W / 2);
  const markerTop = markerWorld.y - (view.y - MAP_H / 2);

  return (
    <div
      ref={mapRef}
      className={`${styles.map} ${dragging ? styles.mapDragging : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {mapTiles(center, zoom).map((tile) => (
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          className={styles.mapTile}
          style={{ left: tile.left, top: tile.top }}
          draggable={false}
        />
      ))}

      <svg className={styles.mapMarker} style={{ left: markerLeft, top: markerTop }} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 22s-7.5-6-7.5-11.5a7.5 7.5 0 1 1 15 0C19.5 16 12 22 12 22Z" />
        <circle cx="12" cy="10.5" r="2.8" fill="#ffffff" />
      </svg>

      <div className={styles.mapControls}>
        <button
          type="button"
          className={styles.mapBtn}
          onClick={() => zoomBy(1)}
          disabled={zoom >= ZOOM_MAX}
          aria-label="지도 확대"
        >
          +
        </button>
        <button
          type="button"
          className={styles.mapBtn}
          onClick={() => zoomBy(-1)}
          disabled={zoom <= ZOOM_MIN}
          aria-label="지도 축소"
        >
          −
        </button>
        <button type="button" className={styles.mapBtn} onClick={recenter} aria-label="위치로 이동">
          <svg className={styles.mapBtnIcon} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" fill="currentColor" />
            <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 1.5v3.4M12 19.1v3.4M1.5 12h3.4M19.1 12h3.4" />
          </svg>
        </button>
      </div>

      <span className={styles.mapAttribution}>© OpenStreetMap</span>
    </div>
  );
}

interface InfoRow {
  label: string;
  /** Value lines (기간 shows the date range + eventTime); empty fields show '-'. */
  lines: string[];
}

/** The fixed 6 rows of the Figma spec — empty values render as '-' (not hidden). */
function infoRows(d: EventDetail, lang: Lang): InfoRow[] {
  const price = d.price ?? (d.isFree === true ? t('Transport_Free', lang) : null);
  const period = [`${d.startDate} ~ ${d.endDate}`, ...(d.eventTime ? [d.eventTime] : [])];
  return [
    { label: ui('eventPlace', lang), lines: [d.location || '-'] },
    { label: ui('eventPeriod', lang), lines: period },
    { label: ui('eventTarget', lang), lines: [d.recruitTarget ?? '-'] },
    { label: ui('eventPrice', lang), lines: [price ?? '-'] },
    { label: ui('eventInquiry', lang), lines: [d.inquiry ?? '-'] },
    { label: ui('eventNotes', lang), lines: [d.description ?? '-'] },
  ];
}

export interface EventDetailScreenProps {
  /** Event to show; the screen fetches its full record itself. */
  eventId: number;
  /** Kiosk brand color (Hwaseong #005ab4 / Osan #1a4d7e / Insadong #fe6c50). */
  accent: string;
}

/**
 * Event detail PAGE body (Figma 5494:134776 / 157999 / 159061 — identical
 * layout on all three kiosks, only the surrounding chrome differs). Rendered
 * by each kiosk's events page IN PLACE of the grid + pagination — the header,
 * region/category tabs, QR footer and banner chrome stay visible around it.
 * One white card (1820×1825, r80) holds the poster + title + 6 info rows,
 * then 오시는 길 안내 with an interactive map centered on the event.
 */
export function EventDetailScreen({ eventId, accent }: EventDetailScreenProps): JSX.Element {
  const lang = useLang();
  const { detail, loading, error } = useEventDetail(eventId);
  const hasCoords = detail !== null && detail.latitude !== null && detail.longitude !== null;

  return (
    <div className={styles.root} style={{ '--event-accent': accent } as CSSProperties}>
      <div className={styles.card} />

      {loading && (
        <div className={styles.pending}>
          <span className={styles.spinner} />
          불러오는 중..
        </div>
      )}

      {!loading && (error || !detail) && <div className={styles.pending}>{ui('eventDetailFailed', lang)}</div>}

      {!loading && detail && (
        <>
          <div className={styles.poster}>
            {detail.mainImage && <img src={detail.mainImage} alt="" draggable={false} />}
          </div>

          <div className={styles.content}>
            <p className={styles.title}>{detail.title}</p>
            <div className={styles.info}>
              {infoRows(detail, lang).map((row) => (
                <div key={row.label} className={styles.infoRow}>
                  <span className={styles.infoLabel}>{row.label}</span>
                  <span className={styles.infoValue}>
                    {row.lines.map((line, i) => (
                      <span key={i} className={styles.infoLine}>
                        {line}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.mapHeading}>
            <svg className={styles.mapPin} viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Z"
              />
              <circle cx="12" cy="10" r="2.6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span className={styles.mapTitle}>{ui('directions', lang)}</span>
          </div>

          {hasCoords ? (
            <InteractiveMap key={detail.eventId} lat={detail.latitude!} lng={detail.longitude!} />
          ) : (
            <div className={styles.map}>
              <p className={styles.mapEmpty}>{ui('noMapInfo', lang)}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
