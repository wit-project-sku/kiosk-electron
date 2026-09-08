/**
 * 관광명소 지도 — Figma node 6876:62701, the 1812×767 map that opens the
 * 여기는 제주도 > 관광명소 grid.
 *
 * ── Why raster tiles and not the Google Maps SDK ──────────────────────
 * The frame draws a Google Maps screenshot, but the SDK cannot run here: the
 * production CSP is `script-src 'self' appres:` / `connect-src 'self' appres:`
 * (main/core/security.ts), so a hosted map script is refused outright and so is
 * every XHR it would make. `img-src` allows any https origin, which is why the
 * events screen already ships a hand-rolled slippy map over OSM raster tiles —
 * this is that engine, generalised from one marker to a whole catalogue.
 * Swapping tile providers is {@link TILE_URL} and nothing else; a provider whose
 * tiles need a key or a signature also needs its origin added to `img-src`.
 *
 * A hand-rolled engine is also what keeps dragging glued to the finger. The
 * whole artboard is CSS-scaled (--kiosk-scale) and pointer deltas arrive in
 * PHYSICAL pixels while the layout runs in 2160-wide artboard pixels, so every
 * gesture divides by the live render scale. Off-the-shelf libraries (Leaflet et
 * al) assume the two are the same and drift under the finger.
 *
 * ── The Airbnb behaviour ──────────────────────────────────────────────
 * The map OWNS the list below it. It opens fitted to every attraction, which is
 * the "no filter" state; once the visitor pans or zooms, {@link Props.onViewportChange}
 * reports the ids still on screen and the grid narrows to them. 전체 보기 refits
 * and hands the full list back. Reporting is deliberately settled (see
 * SETTLE_MS) — re-filtering a 101-card grid on every pointermove drops frames on
 * kiosk hardware, and updating when the map comes to rest is what Airbnb does
 * anyway.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { pick, type Lang } from '@renderer/lib/i18n';
import styles from './JejuSpotMap.module.css';

/**
 * Default drawn size — Figma 6876:62701, the map filling the 관광명소 grid
 * column. The 상세 card draws the same map at 1514 × 631 (6876:62703) and passes
 * its own, which is why every helper below takes the box rather than closing
 * over a constant.
 */
const MAP_W = 1812;
const MAP_H = 767;

/** The drawn box, in artboard px. */
interface Box {
  w: number;
  h: number;
}

/**
 * Tile source. OSM's public server is the one raster provider that needs neither
 * a key nor a signed URL, so it is the only one that works under the CSP as it
 * stands — see the file header before swapping it.
 */
const TILE_URL = (z: number, x: number, y: number): string =>
  `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

/**
 * Base size a 256px tile is drawn at, at a whole zoom level: 512 artboard px,
 * because the 2160-wide artboard is ≈2× the physical panel. Zoom is CONTINUOUS
 * here (see {@link fitView}), so the size actually used scales off this by the
 * fractional part — `mapTiles` works it out.
 */
const TILE_PX = 512;
/** 제주 spans ~73km east-west; z8 shows the whole island with sea around it. */
const ZOOM_MIN = 8;
const ZOOM_MAX = 18;
/** Fit zoom for a single pin (or several on one spot) — no span to solve for. */
const ZOOM_SINGLE = 14;
/** Used only when the catalogue has no usable coordinates at all. */
const JEJU_CENTER: LatLng = { lat: 33.3846, lng: 126.5535 };
const ZOOM_FALLBACK = 10;

/** Pins closer together than this (artboard px) collapse into a count bubble. */
const CLUSTER_PX = 190;
/** Above this many markers on screen, drop the name labels — they overlap. */
const LABEL_LIMIT = 8;
/** Fit padding, so a pin on the edge of the set is not drawn half off the map. */
const FIT_PAD = 130;
/** Pinch steps the zoom each time finger distance changes by this ratio. */
const PINCH_STEP_RATIO = 1.3;
/**
 * How long the map must be still before the grid re-filters. Long enough that a
 * pan-pause-pan gesture does not re-render the grid mid-drag, short enough that
 * letting go feels like it answered immediately.
 */
const SETTLE_MS = 260;

interface LatLng {
  lat: number;
  lng: number;
}

/** One pinnable attraction. The parent narrows `Shop | Attraction` down to this. */
export interface MapSpot {
  id: number;
  lat: number;
  lng: number;
  name: string;
  address: string;
  photo?: string;
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
  return {
    // Keep the view inside the Mercator projection's valid latitude band.
    lat: Math.max(
      -85,
      Math.min(85, (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))),
    ),
    lng,
  };
}

interface View {
  center: LatLng;
  zoom: number;
}

/**
 * The view that puts every spot on screen with {@link FIT_PAD} to spare.
 *
 * ★ Zoom is CONTINUOUS, and that is the whole point of this function. 제주 is
 * about 1.5:1 in Mercator against a 2.36:1 map, so the height binds — and at
 * whole zoom levels the island either overflows the frame (z10) or fills barely
 * half of it with sea all round (z9), with nothing in between. Solving for the
 * exact zoom instead of walking down to the nearest whole one is what lets the
 * island actually fill the frame. `mapTiles` renders the fractional part by
 * scaling the tiles, so nothing downstream has to care.
 *
 * The span is measured once at zoom 0 and scaled, rather than re-projected per
 * candidate zoom: world pixels are linear in 2^zoom, so one projection pass
 * answers both axes exactly.
 */
function fitView(spots: readonly MapSpot[], box: Box): View {
  if (spots.length === 0) return { center: JEJU_CENTER, zoom: ZOOM_FALLBACK };

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of spots) {
    const p = project(s, 0);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  // One spot, or several on the same coordinate: there is no span to solve for.
  const zoom =
    spanX <= 0 && spanY <= 0
      ? ZOOM_SINGLE
      : Math.min(
          spanX > 0 ? Math.log2((box.w - FIT_PAD * 2) / spanX) : ZOOM_MAX,
          spanY > 0 ? Math.log2((box.h - FIT_PAD * 2) / spanY) : ZOOM_MAX,
        );

  const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
  return { center: unproject((minX + maxX) / 2, (minY + maxY) / 2, 0), zoom: clamped };
}

interface MapTile {
  key: string;
  url: string;
  left: number;
  top: number;
  size: number;
}

/**
 * Tiles covering the viewport (+1 ring, so a drag exposes loaded edges).
 *
 * Tiles only EXIST at whole zoom levels, so the nearest one is fetched and drawn
 * at `TILE_PX × 2^(zoom − tileZ)` — the fractional part of a continuous zoom
 * becomes tile size. Rounding rather than flooring keeps the served resolution
 * within half a level of what is drawn, so the tiles are never scaled by more
 * than √2 in either direction and stay sharp.
 */
function mapTiles(view: View, box: Box): MapTile[] {
  const tileZ = Math.max(0, Math.round(view.zoom));
  const size = TILE_PX * 2 ** (view.zoom - tileZ);
  const n = 2 ** tileZ;
  const c = project(view.center, view.zoom);
  const originX = c.x - box.w / 2;
  const originY = c.y - box.h / 2;

  const tiles: MapTile[] = [];
  const lastY = Math.floor((originY + box.h) / size) + 1;
  const lastX = Math.floor((originX + box.w) / size) + 1;
  for (let ty = Math.floor(originY / size) - 1; ty <= lastY; ty += 1) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(originX / size) - 1; tx <= lastX; tx += 1) {
      const wrappedX = ((tx % n) + n) % n; // longitude wraps
      tiles.push({
        key: `${tileZ}/${tx}/${ty}`,
        url: TILE_URL(tileZ, wrappedX, ty),
        left: tx * size - originX,
        top: ty * size - originY,
        // +1 closes the sub-pixel hairlines a fractional tile size leaves
        // between neighbours; the overlap is under a pixel of a 512px tile.
        size: size + 1,
      });
    }
  }
  return tiles;
}

/** A pin, or a bubble standing in for several that would overlap. */
interface Marker {
  key: string;
  left: number;
  top: number;
  spots: MapSpot[];
}

/**
 * Screen-space clustering: bucket the on-screen pins into {@link CLUSTER_PX}
 * cells and draw one marker per occupied cell, positioned on the cell's mean.
 *
 * Grid bucketing rather than true distance clustering because it is O(n) and
 * runs on every pan frame; the artefact it can produce — two pins either side of
 * a cell edge staying separate — is invisible at 190px cells on a 1812px map,
 * and one more zoom step separates them anyway.
 */
function clusterMarkers(
  spots: readonly MapSpot[],
  view: View,
  box: Box,
  activeId: number | null,
): Marker[] {
  const c = project(view.center, view.zoom);
  const originX = c.x - box.w / 2;
  const originY = c.y - box.h / 2;

  const cells = new Map<string, { left: number; top: number; spots: MapSpot[] }>();
  for (const s of spots) {
    const p = project(s, view.zoom);
    const left = p.x - originX;
    const top = p.y - originY;
    // Cull off-screen pins generously — a marker just past the edge still has
    // its label and shadow inside the frame.
    if (left < -CLUSTER_PX || left > box.w + CLUSTER_PX) continue;
    if (top < -CLUSTER_PX || top > box.h + CLUSTER_PX) continue;

    // The selected spot never joins a cluster: it is the one the visitor asked
    // to see, and hiding it inside a bubble is the one place clustering is wrong.
    const cell =
      s.id === activeId
        ? `active:${s.id}`
        : `${Math.floor(left / CLUSTER_PX)}:${Math.floor(top / CLUSTER_PX)}`;
    const found = cells.get(cell);
    if (found) {
      found.left += left;
      found.top += top;
      found.spots.push(s);
    } else {
      cells.set(cell, { left, top, spots: [s] });
    }
  }

  return [...cells.entries()].map(([key, cell]) => ({
    key,
    left: cell.left / cell.spots.length,
    top: cell.top / cell.spots.length,
    spots: cell.spots,
  }));
}

const RESET = {
  ko: '전체 보기',
  en: 'Show all',
  ja: 'すべて表示',
  zh: '查看全部',
  vi: 'Xem tất cả',
  th: 'ดูทั้งหมด',
  ru: 'Показать все',
  id: 'Lihat semua',
};

/** 전체 보기's counterpart on a map that filters nothing — the 상세 card's. */
const RECENTER = {
  ko: '처음 위치',
  en: 'Recenter',
  ja: '元の位置',
  zh: '回到原位',
  vi: 'Về vị trí ban đầu',
  th: 'กลับตำแหน่งเดิม',
  ru: 'К месту',
  id: 'Ke posisi awal',
};

/** The count pill — `{n}` is the number of attractions currently on the map. */
const IN_VIEW = {
  ko: '이 지역 {n}곳',
  en: '{n} in this area',
  ja: 'このエリア {n}件',
  zh: '该区域 {n} 处',
  vi: '{n} địa điểm ở đây',
  th: 'บริเวณนี้ {n} แห่ง',
  ru: 'В этой области: {n}',
  id: '{n} tempat di area ini',
};

interface Props {
  /** Only spots that HAVE coordinates — the parent drops the rest. */
  spots: readonly MapSpot[];
  /** Drawn size in artboard px. Defaults to the 관광명소 grid map's 1812 × 767. */
  width?: number;
  height?: number;
  /** The spot whose callout is open, or null. */
  activeId?: number | null;
  /**
   * Omit on a map that only SHOWS its pins (the 상세 card's, which has exactly
   * one and the card names it already). Without it the pins are inert markers
   * rather than buttons, so a drag that starts on one still pans the map.
   */
  onSelect?: (id: number | null) => void;
  /** Tapping the callout — opens the 상세 card. */
  onOpen?: (id: number) => void;
  /**
   * Ids the map is currently showing, or NULL for "not filtering" (the opening
   * fit, and after 전체 보기). Null and "every id" are deliberately different:
   * only null lets the parent keep listing spots that carry no coordinates.
   *
   * Omit it entirely on a map that drives no list: the count pill goes with it,
   * because a count that narrows nothing is just a number on a map.
   */
  onViewportChange?: (ids: number[] | null) => void;
  lang: Lang;
  className?: string;
}

export function JejuSpotMap({
  spots,
  width = MAP_W,
  height = MAP_H,
  activeId = null,
  onSelect,
  onOpen,
  onViewportChange,
  lang,
  className,
}: Props): JSX.Element {
  const box = useMemo<Box>(() => ({ w: width, h: height }), [width, height]);
  /** Pins are buttons only where tapping one means something. */
  const interactive = onSelect != null;
  const filtering = onViewportChange != null;
  const fit = useMemo(() => fitView(spots, box), [spots, box]);
  const [view, setView] = useState<View>(fit);
  /** Has the visitor moved the map off the fitted view? Drives the filtering. */
  const [moved, setMoved] = useState(false);
  const [dragging, setDragging] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /** Finger distance at the last pinch step (null = not pinching). */
  const pinchBase = useRef<number | null>(null);
  /** False until a gesture actually moves — a tap must not count as a pan. */
  const gestureMoved = useRef(false);

  /** A new catalogue (초성 filter, or the API landing) refits and un-filters. */
  useEffect(() => {
    setView(fit);
    setMoved(false);
  }, [fit]);

  const markers = useMemo(
    () => clusterMarkers(spots, view, box, activeId),
    [spots, view, box, activeId],
  );
  const inView = useMemo(() => markers.reduce((n, m) => n + m.spots.length, 0), [markers]);

  /**
   * Report the viewport once the map settles. The callback is held in a ref so a
   * parent passing an inline arrow does not restart the timer on every render —
   * the effect must depend on the VIEW, not on the callback's identity.
   */
  const reportRef = useRef(onViewportChange);
  reportRef.current = onViewportChange;
  useEffect(() => {
    const report = reportRef.current;
    if (!report) return;
    const timer = window.setTimeout(() => {
      if (!moved) {
        report(null);
        return;
      }
      const c = project(view.center, view.zoom);
      const originX = c.x - box.w / 2;
      const originY = c.y - box.h / 2;
      const ids: number[] = [];
      for (const s of spots) {
        const p = project(s, view.zoom);
        const left = p.x - originX;
        const top = p.y - originY;
        if (left >= 0 && left <= box.w && top >= 0 && top <= box.h) ids.push(s.id);
      }
      report(ids);
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [view, moved, spots, box]);

  /** Live render scale of the map element (physical px per artboard px). */
  const renderScale = (): number => {
    const rect = mapRef.current?.getBoundingClientRect();
    return rect && rect.width > 0 ? rect.width / box.w : 1;
  };

  /** Pan by a PHYSICAL-pixel delta. */
  const panBy = (dxPhys: number, dyPhys: number): void => {
    const s = renderScale();
    setView((v) => {
      const w = project(v.center, v.zoom);
      return { ...v, center: unproject(w.x - dxPhys / s, w.y - dyPhys / s, v.zoom) };
    });
    setMoved(true);
  };

  /** Step the zoom keeping the geographic point under `client` fixed. */
  const zoomAt = (client: { x: number; y: number } | null, delta: number): void => {
    // Measured OUT here rather than inside the updater: an updater has to be
    // pure enough to run twice (StrictMode does exactly that), and a layout read
    // that far from the event is also the one most likely to be stale.
    const rect = mapRef.current?.getBoundingClientRect();
    setView((v) => {
      const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom + delta));
      if (next === v.zoom) return v;
      // No anchor (the +/− buttons) or no box yet: zoom about the centre.
      if (!client || !rect || rect.width === 0) return { ...v, zoom: next };
      const s = rect.width / box.w;
      const mx = (client.x - rect.left) / s;
      const my = (client.y - rect.top) / s;
      const world = project(v.center, v.zoom);
      const anchor = unproject(world.x - box.w / 2 + mx, world.y - box.h / 2 + my, v.zoom);
      const anchorNext = project(anchor, next);
      return {
        center: unproject(anchorNext.x - mx + box.w / 2, anchorNext.y - my + box.h / 2, next),
        zoom: next,
      };
    });
    setMoved(true);
  };

  const reset = useCallback((): void => {
    setView(fit);
    setMoved(false);
    onSelect?.(null);
  }, [fit, onSelect]);

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
    Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ): { x: number; y: number } => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    // Markers, the callout and the controls are taps, not drags — capturing the
    // pointer here would swallow them.
    if ((e.target as HTMLElement).closest('button')) return;
    if (pointers.current.size >= 2) return; // ignore a third finger
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    mapRef.current?.setPointerCapture(e.pointerId);
    setDragging(true);
    gestureMoved.current = false;
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
      const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)![1];
      const oldMid = mid(prev, other);
      const now = { x: e.clientX, y: e.clientY };
      pointers.current.set(e.pointerId, now);
      const newMid = mid(now, other);
      gestureMoved.current = true;
      panBy(newMid.x - oldMid.x, newMid.y - oldMid.y);

      const newDist = dist(now, other);
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

    // Single-finger drag. A couple of physical pixels of jitter while a finger
    // rests on the map is not a pan — treating it as one would re-filter the
    // grid out from under a visitor who only meant to touch the screen.
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    if (!gestureMoved.current && Math.hypot(dx, dy) < 4) return;
    gestureMoved.current = true;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    panBy(dx, dy);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size < 2) pinchBase.current = null;
    if (pointers.current.size === 0) {
      setDragging(false);
      // A tap on bare map dismisses the callout, the way tapping off a popover
      // does. A drag that happens to END on bare map must not.
      if (!gestureMoved.current && activeId !== null) onSelect?.(null);
    }
  };

  const active = activeId === null ? null : (spots.find((s) => s.id === activeId) ?? null);
  const activeMarker = active
    ? (markers.find((m) => m.spots.length === 1 && m.spots[0]!.id === active.id) ?? null)
    : null;
  const showLabels = markers.length <= LABEL_LIMIT;

  return (
    <div
      ref={mapRef}
      className={[styles.map, dragging ? styles.dragging : '', className].filter(Boolean).join(' ')}
      style={{ width: box.w, height: box.h }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {mapTiles(view, box).map((tile) => (
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          className={styles.tile}
          style={{ left: tile.left, top: tile.top, width: tile.size, height: tile.size }}
          draggable={false}
        />
      ))}

      {markers.map((m) =>
        m.spots.length > 1 ? (
          /* Cluster — tapping it dives two levels in, centred on the bubble,
             which is what pulls the pins underneath it apart. */
          <button
            key={m.key}
            type="button"
            className={styles.cluster}
            style={{ left: m.left, top: m.top }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              zoomAt({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, 2);
            }}
            aria-label={String(m.spots.length)}
          >
            {m.spots.length}
          </button>
        ) : /* A pin is a button only where tapping it does something. On the 상세
              card's map it is a <span>, so a drag that starts on the pin — easy
              to do when the pin is the thing you are looking at — pans the map
              instead of being swallowed by the button guard in onPointerDown. */
        !interactive ? (
          <span
            key={m.key}
            className={styles.pin}
            style={{ left: m.left, top: m.top }}
            aria-hidden="true"
          >
            <svg className={styles.pinGlyph} viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 22s-7.5-6-7.5-11.5a7.5 7.5 0 1 1 15 0C19.5 16 12 22 12 22Z"
              />
              <circle cx="12" cy="10.5" r="2.8" fill="#ffffff" />
            </svg>
            {showLabels && <span className={styles.pinLabel}>{m.spots[0]!.name}</span>}
          </span>
        ) : (
          <button
            key={m.key}
            type="button"
            className={`${styles.pin} ${m.spots[0]!.id === activeId ? styles.pinActive : ''}`}
            style={{ left: m.left, top: m.top }}
            onClick={() => onSelect(m.spots[0]!.id === activeId ? null : m.spots[0]!.id)}
            aria-label={m.spots[0]!.name}
          >
            <svg className={styles.pinGlyph} viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 22s-7.5-6-7.5-11.5a7.5 7.5 0 1 1 15 0C19.5 16 12 22 12 22Z"
              />
              <circle cx="12" cy="10.5" r="2.8" fill="#ffffff" />
            </svg>
            {showLabels && m.spots[0]!.id !== activeId && (
              <span className={styles.pinLabel}>{m.spots[0]!.name}</span>
            )}
          </button>
        ),
      )}

      {/* Callout — the selected pin's card, anchored above its tip. Only drawn
          when that pin is actually on screen and un-clustered; panning it away
          leaves the selection intact for the grid without a card floating over
          the wrong place. */}
      {active && activeMarker && onOpen && (
        <button
          type="button"
          className={styles.callout}
          style={{ left: activeMarker.left, top: activeMarker.top }}
          onClick={() => onOpen(active.id)}
        >
          <span className={styles.calloutPhoto}>
            {(active.photo ?? jejuIconUrl('noimage')) && (
              <img src={active.photo ?? jejuIconUrl('noimage')} alt="" draggable={false} />
            )}
          </span>
          <span className={styles.calloutBody}>
            <span className={styles.calloutName}>{active.name}</span>
            <span className={styles.calloutAddress}>{active.address}</span>
          </span>
        </button>
      )}

      {/* The count is the link between this map and the list it narrows, so it
          belongs only on a map that HAS a list. */}
      {filtering && (
        <span className={styles.count}>{pick(IN_VIEW, lang).replace('{n}', String(inView))}</span>
      )}

      {moved && (
        <button type="button" className={styles.resetBtn} onClick={reset}>
          {pick(filtering ? RESET : RECENTER, lang)}
        </button>
      )}

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.ctrl}
          onClick={() => zoomAt(null, 1)}
          disabled={view.zoom >= ZOOM_MAX}
          aria-label="지도 확대"
        >
          +
        </button>
        <button
          type="button"
          className={styles.ctrl}
          onClick={() => zoomAt(null, -1)}
          disabled={view.zoom <= ZOOM_MIN}
          aria-label="지도 축소"
        >
          −
        </button>
      </div>

      {/* OSM's tile usage policy requires visible attribution. */}
      <span className={styles.attribution}>© OpenStreetMap</span>
    </div>
  );
}
