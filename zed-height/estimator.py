"""
From a point cloud to a height in centimetres.

── The one thing this file exists to get right ────────────────────────────
Height is NOT the topmost point of the cloud, and at 제주 it is especially not:
the capture flow *requires* the visitor to raise an open palm to start the
countdown (PhotoGestureGate), and people pose with peace signs. A naive
top-of-cloud estimator would measure a hand on a large fraction of sessions and
report a confident, plausible, wrong number.

Two defences, in order of how much work they do:

1. THE HEAD COLUMN, which does almost all of it. A head sits above the torso's
   own footprint; a raised arm does not. Restricting the crown search to a
   narrow vertical column around the torso centroid removes a raised or
   outstretched arm from consideration entirely — a body's surface points
   project onto the floor at the body's OUTER radius, so a column of 18 cm
   holds the head (~9 cm radius) and essentially nothing else. That is also why
   the density reference below comes from the column rather than the torso: at
   torso height the column is empty by construction.

2. SLAB DENSITY, which covers the one case the column cannot — a hand held
   directly over the head. A forearm slab holds roughly half the points of a
   head slab, so a threshold relative to the column's own typical slab rejects
   it. This is the weaker of the two and is deliberately backed by the median
   across the capture window (see `summarise`): a hand is not held overhead for
   all 15-30 seconds.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from geometry import (
    HEAD_SLAB_FRACTION,
    MAX_BODY_M,
    MIN_BODY_M,
    MIN_SLAB_POINTS,
    SLAB_M,
    TORSO_BAND_M,
    FloorFrame,
)

# Radius of the vertical column around the torso centroid that the crown is
# searched in — defence 1 above. Wide enough for a head that leans or turns
# (~9 cm of head, plus room to move), narrow enough to exclude an arm raised
# beside it (a hand goes out to ~22 cm at the very least).
HEAD_COLUMN_RADIUS_M = 0.18

# How far above the last passing slab the estimate may climb, to recover a crown
# whose topmost slabs are too sparse to pass on their own (hair tapers; a head
# is not a cylinder). Bounded at 4 slabs (8 cm) so that in the one case the
# column cannot filter — a hand directly overhead — the error stays small and
# bounded instead of running to the fingertips.
CROWN_MAX_SLABS = 4

# The bar a slab must clear to be taken as more of the same head during that
# climb. Relative, not absolute: an arm raised right beside the head still puts
# its INNER EDGE inside the column (the column's 18 cm and the arm's 22 cm are
# only a forearm's radius apart), and that leak is comfortably large enough to
# clear any fixed point count. Measured against the column's own reference slab
# it is a few percent, and correctly ignored.
CROWN_TAPER_FRACTION = 0.25

# Floor-plane cell size for separating one visitor from another.
CLUSTER_CELL_M = 0.15
# A body point is attributed to a cluster if it stands within this of the
# cluster's footprint centre — wide enough to catch outstretched arms.
CLUSTER_RADIUS_M = 0.60
MIN_CLUSTER_POINTS = 40


@dataclass(frozen=True)
class Subject:
    """One person-shaped cluster standing in the measurement zone."""

    height_m: float
    points: int
    distance_m: float


def _slab_counts(heights: np.ndarray) -> tuple[np.ndarray, int]:
    """Histogram of above-floor heights. Returns (counts, index_of_first_slab)."""
    lo = int(np.floor(MIN_BODY_M / SLAB_M))
    hi = int(np.ceil(MAX_BODY_M / SLAB_M))
    idx = np.floor(heights / SLAB_M).astype(int)
    idx = idx[(idx >= lo) & (idx < hi)]
    if idx.size == 0:
        return np.zeros(0, dtype=int), lo
    return np.bincount(idx - lo, minlength=hi - lo), lo


def estimate_crown(heights: np.ndarray) -> float | None:
    """Height in metres of the top of the head, or None if no body is present.

    `heights` must already be restricted to the head column — see the module
    docstring. The density reference is the column's OWN typical slab, which
    here means a typical slab through head and neck; scaling against it is what
    lets a single threshold work at any standing distance.
    """
    counts, base = _slab_counts(heights)
    if counts.size == 0:
        return None

    occupied = counts[counts > 0]
    if occupied.size == 0:
        return None
    reference = float(np.median(occupied))

    strict = max(float(MIN_SLAB_POINTS), HEAD_SLAB_FRACTION * reference)
    solid = np.flatnonzero(counts >= strict)
    if solid.size == 0:
        return None
    top = int(solid[-1])

    taper = max(float(MIN_SLAB_POINTS), CROWN_TAPER_FRACTION * reference)
    limit = min(top + CROWN_MAX_SLABS, counts.size - 1)
    while top < limit and counts[top + 1] >= taper:
        top += 1

    return (base + top + 1) * SLAB_M


def find_subjects(
    frame: FloorFrame,
    points: np.ndarray,
    zone_min_m: float,
    zone_max_m: float,
) -> list[Subject]:
    """Every person standing in the measurement zone, with a height estimate each.

    Returns more than one entry for a 같이찍기 (together) capture. The caller
    decides what to do with that; this does not guess which visitor is "the"
    subject.
    """
    if len(points) == 0:
        return []

    heights = frame.heights(points)
    body = (heights >= MIN_BODY_M) & (heights <= MAX_BODY_M)
    if not body.any():
        return []

    xy = frame.floor_xy(points[body])
    h = heights[body]

    # The camera sits at the origin, so its own floor projection is (0, 0) and
    # radial distance in the floor plane is simply the norm. Rotation-agnostic:
    # no forward axis to get wrong on a sideways mount.
    radial = np.linalg.norm(xy, axis=1)
    in_zone = (radial >= zone_min_m) & (radial <= zone_max_m)
    if not in_zone.any():
        return []
    xy, h, radial = xy[in_zone], h[in_zone], radial[in_zone]

    # Cluster on TORSO points only. Heads and raised arms move around; a
    # standing torso is the stable footprint that says "one person, here".
    torso = (h >= TORSO_BAND_M[0]) & (h <= TORSO_BAND_M[1])
    if not torso.any():
        return []
    centres = _cluster_centres(xy[torso])

    subjects: list[Subject] = []
    for centre in centres:
        offset = np.linalg.norm(xy - centre, axis=1)
        near = offset <= CLUSTER_RADIUS_M
        if int(near.sum()) < MIN_CLUSTER_POINTS:
            continue
        # The crown is searched in the head column only; the wider cluster is
        # still what establishes that a person is standing here at all.
        crown = estimate_crown(h[offset <= HEAD_COLUMN_RADIUS_M])
        if crown is None:
            continue
        subjects.append(
            Subject(
                height_m=crown,
                points=int(near.sum()),
                distance_m=float(np.median(radial[near])),
            )
        )

    subjects.sort(key=lambda s: s.distance_m)
    return subjects


def _cluster_centres(xy: np.ndarray) -> list[np.ndarray]:
    """Grid flood-fill on the floor plane. Returns one centroid per cluster."""
    cells = np.floor(xy / CLUSTER_CELL_M).astype(int)
    occupied: dict[tuple[int, int], list[int]] = {}
    for i, cell in enumerate(map(tuple, cells)):
        occupied.setdefault(cell, []).append(i)

    seen: set[tuple[int, int]] = set()
    centres: list[np.ndarray] = []
    for cell in occupied:
        if cell in seen:
            continue
        stack, members = [cell], []
        seen.add(cell)
        while stack:
            cx, cy = stack.pop()
            members.extend(occupied[(cx, cy)])
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nb = (cx + dx, cy + dy)
                    if nb in occupied and nb not in seen:
                        seen.add(nb)
                        stack.append(nb)
        if len(members) >= MIN_CLUSTER_POINTS:
            centres.append(xy[members].mean(axis=0))
    return centres


def summarise(samples: list[float]) -> tuple[float, float] | None:
    """Collapse a window of per-frame estimates into (height_cm, confidence).

    The median is what makes the whole approach work: over a 15-30 s window the
    visitor is walking in, turning, raising a hand, settling. Individual frames
    are wrong in both directions and the median does not care.

    Confidence comes from the spread (MAD) rather than from anything per-frame,
    because agreement across a long window is the only evidence we actually have
    that the number is right. 1 cm of MAD or better reads as 1.0, degrading to 0
    at 6 cm.
    """
    if len(samples) < 5:
        return None
    arr = np.asarray(samples, dtype=float)
    median = float(np.median(arr))
    mad_cm = float(np.median(np.abs(arr - median))) * 100.0
    confidence = float(np.clip((6.0 - mad_cm) / 5.0, 0.0, 1.0))
    return median * 100.0, confidence
