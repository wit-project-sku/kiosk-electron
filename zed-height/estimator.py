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

from widths import SHOULDER_HOLE_M, BodyWidths, _bridged, _centre_run, _runs, body_widths
from geometry import (
    strip_vertical_planes,
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

# How much empty height may sit inside one body before it counts as a gap.
# 3 slabs is 6 cm — enough for hair or a dark fringe dropping out of a stereo
# depth map, far less than the tens of centimetres between a head and whatever
# is above it. See `estimate_crown`.
MAX_CROWN_GAP_SLABS = 3

# Floor-plane cell size for separating one visitor from another.
CLUSTER_CELL_M = 0.15
# Finer grid for splitting a too-wide cluster, and how far a piece's centre may
# sit from a bigger piece's and still be the same person (an arm beside a torso).
FINE_CELL_M = 0.05
PART_MERGE_M = 0.35
# Any cluster wider than one person is looked inside, not just the ones too wide
# to keep: a visitor plus the cabinet beside them came out 1.12 m, under the
# 1.2 m limit, and was measured from a centre between the two.
SPLIT_ABOVE_M = 0.8
# A body point is attributed to a cluster if it stands within this of the
# cluster's footprint centre — wide enough to catch outstretched arms.
CLUSTER_RADIUS_M = 0.60
MIN_CLUSTER_POINTS = 40

# ── Telling a person from a room ───────────────────────────────────────────
# A cluster of points above the floor is not automatically a visitor. Walls,
# counters, pillars and furniture are all "above the floor", and in an indoor
# scene they are the LARGEST such cluster by a wide margin — a first version of
# this measured an office wall as a confident 230 cm visitor.
#
# Two cheap shape tests separate them, and neither needs a model:

# How wide a standing person's TORSO footprint can be on the floor. A shoulder
# span is ~0.5 m; 1.2 m leaves room for a heavy coat, a bag, or someone standing
# at an angle, while a wall or counter runs to several metres.
MAX_SUBJECT_FOOTPRINT_M = 1.2

# A cluster whose crown lands at the very top of the body band never stopped —
# it ran past where a person ends, so it is a wall or a pillar reaching the
# ceiling, not a very tall visitor. Anything genuinely person-shaped resolves
# below this.
CEILING_REJECT_M = MAX_BODY_M - 2 * SLAB_M

# The other end of the same idea: nothing this short is a visitor STANDING at a
# kiosk. Desks, counters, chair backs and bollards all live between 0.7 and
# 0.9 m, they are person-sized in footprint, they stop well below the ceiling,
# and they sit still — so they are otherwise a perfect subject. A first real
# test measured a desk edge as a rock-solid 78 cm with confidence 1.00.
#
# The cost, stated rather than hidden: a toddler under a metre is refused too.
# That is acceptable here because a child that small is at the kiosk with an
# adult, which makes it a two-subject capture, and those record no height
# anyway (see Session.result).
MIN_SUBJECT_HEIGHT_M = 1.00


@dataclass(frozen=True)
class Subject:
    """One person-shaped cluster standing in the measurement zone."""

    height_m: float
    points: int
    distance_m: float
    # Sideways from the camera's line of sight, along the floor. Signed; 0 when
    # no forward axis was given.
    lateral_m: float = 0.0
    # Shoulder/chest/waist/hip breadth this frame; None without a forward axis.
    widths: BodyWidths | None = None
    # Torso centre in FloorFrame.floor_xy coordinates: static-object matching
    # (scene.py) and the head-in-view check (overlay.py).
    centre_xy: tuple[float, float] | None = None
    # Pose path (body.py): ellipse circumferences, and per-frame detail
    # (arm-touching fallbacks, the floor at the feet, head in view).
    girths: object | None = None
    drawing: dict | None = None


def _slab_counts(heights: np.ndarray) -> tuple[np.ndarray, int]:
    """Histogram of above-floor heights. Returns (counts, index_of_first_slab)."""
    lo = int(np.floor(MIN_BODY_M / SLAB_M))
    hi = int(np.ceil(MAX_BODY_M / SLAB_M))
    idx = np.floor(heights / SLAB_M).astype(int)
    idx = idx[(idx >= lo) & (idx < hi)]
    if idx.size == 0:
        return np.zeros(0, dtype=int), lo
    return np.bincount(idx - lo, minlength=hi - lo), lo


def body_top(heights: np.ndarray) -> float | None:
    """Where the visitor's own mass stops, from the FULL cluster.

    Indoors there is almost always something directly above a person's head — a
    ceiling, a light fitting, a shelf — sitting inside the narrow head column
    and still below MAX_BODY_M. A crown search that simply takes the highest
    dense slab measures that instead, reads as a plausible 210-225 cm, and
    drifts as the visitor shifts. That is exactly how it presented on the first
    real-room test.

    What separates them is CONTINUITY, and continuity has to be judged on the
    whole cluster rather than the head column, because the column is sparse at
    torso height by construction (a torso's surface projects to a wider radius
    than the column's). So: start inside the torso band, which is certainly
    body, and walk up until a real gap appears.

    Returns the height where the body ends, or None if there is no torso.
    """
    counts, base = _slab_counts(heights)
    if counts.size == 0:
        return None

    lo = int(TORSO_BAND_M[0] / SLAB_M) - base
    hi = int(TORSO_BAND_M[1] / SLAB_M) - base
    occupied = counts >= MIN_SLAB_POINTS
    torso = np.flatnonzero(occupied[max(lo, 0) : max(hi, 0)])
    if torso.size == 0:
        return None

    top = int(torso[-1]) + max(lo, 0)
    gap = 0
    for j in range(top + 1, counts.size):
        if occupied[j]:
            top = j
            gap = 0
        else:
            gap += 1
            if gap > MAX_CROWN_GAP_SLABS:
                break
    return (base + top + 1) * SLAB_M


def estimate_crown(heights: np.ndarray, limit_m: float | None = None) -> float | None:
    """Height in metres of the top of the head, or None if no body is present.

    `heights` must already be restricted to the head column — see the module
    docstring. The density reference is the column's OWN typical slab, which
    here means a typical slab through head and neck; scaling against it is what
    lets a single threshold work at any standing distance.

    `limit_m` is where the body stopped (see `body_top`); nothing above it is
    considered, which is what keeps a ceiling out of the answer.
    """
    counts, base = _slab_counts(heights)
    if counts.size == 0:
        return None

    occupied = counts[counts > 0]
    if occupied.size == 0:
        return None
    reference = float(np.median(occupied))

    strict = max(float(MIN_SLAB_POINTS), HEAD_SLAB_FRACTION * reference)
    passing = counts >= strict
    if limit_m is not None:
        # Nothing above where the body demonstrably stopped. See `body_top`.
        slab_tops = (np.arange(counts.size) + base + 1) * SLAB_M
        passing = passing & (slab_tops <= limit_m + 1e-9)
    solid = np.flatnonzero(passing)
    if solid.size == 0:
        return None
    top = int(solid[-1])

    taper = max(float(MIN_SLAB_POINTS), CROWN_TAPER_FRACTION * reference)
    limit = min(top + CROWN_MAX_SLABS, counts.size - 1)
    while top < limit and counts[top + 1] >= taper:
        top += 1

    return (base + top + 1) * SLAB_M


@dataclass(frozen=True)
class Rejection:
    """A cluster that was NOT counted as a visitor, and why.

    Every filter here can drop a real person for the wrong reason — a visitor
    standing against a wall merges with it and looks too wide; one behind a
    counter loses the torso the clustering needs. When that happens the symptom
    is silence ("nobody in the zone"), which is the least debuggable thing a
    measurement can do. This carries the reason out so `--diagnose` can show it.
    """

    reason: str
    distance_m: float
    footprint_m: float
    points: int
    height_m: float | None


def find_subjects(
    frame: FloorFrame,
    points: np.ndarray,
    zone_min_m: float,
    zone_max_m: float,
    rejections: list[Rejection] | None = None,
    forward: np.ndarray | None = None,
    corridor_m: float | None = None,
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

    # Take the walls out before clustering. Without this a visitor standing in
    # front of one is flood-filled into it and the pair is rejected as too wide
    # — the room, not the person, becomes the cluster. See strip_vertical_planes.
    body_points = points[body]
    standing = strip_vertical_planes(body_points, frame.normal)
    body_points = body_points[standing]
    if len(body_points) == 0:
        return []

    xy = frame.floor_xy(body_points)
    h = heights[body][standing]

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
    torso_xy = xy[torso]
    centres = []
    for centre, footprint, members in _cluster_centres(torso_xy, with_members=True):
        if footprint > SPLIT_ABOVE_M:
            centres.extend(_split_wide(torso_xy[members]))
        else:
            centres.append((centre, footprint))

    # The camera's line of sight laid flat on the floor. floor_xy is linear, so
    # a direction projects like a point; normalised it is mount-independent.
    ahead: np.ndarray | None = None
    if forward is not None:
        flat = frame.floor_xy(np.asarray(forward, dtype=float)[None, :])[0]
        if np.linalg.norm(flat) > 1e-6:
            ahead = flat / np.linalg.norm(flat)

    subjects: list[Subject] = []
    # Each point belongs to its nearest centre only. Without it the thing a
    # visitor was split from (see _split_wide) is still inside their 0.6 m
    # radius, and a desk edge beside the chest reads as an arm.
    if centres:
        to_centre = np.linalg.norm(xy[:, None, :] - np.stack([c for c, _ in centres])[None], axis=2)
        owner = np.argmin(to_centre, axis=1)
    for i, (centre, footprint) in enumerate(centres):
        offset = to_centre[:, i]
        near = (offset <= CLUSTER_RADIUS_M) & (owner == i)
        count = int(near.sum())
        where = float(np.median(radial[near])) if count else float("nan")

        def drop(reason: str, height: float | None = None) -> None:
            if rejections is not None:
                rejections.append(Rejection(reason, where, footprint, count, height))

        # A person's torso stands on a small patch of floor. A wall, counter or
        # pillar does not, and indoors it is otherwise the most convincing
        # "subject" in the scene — see MAX_SUBJECT_FOOTPRINT_M. This also drops
        # a visitor who has merged with something they are standing against,
        # which is why the reason is reported rather than swallowed.
        if footprint > MAX_SUBJECT_FOOTPRINT_M:
            drop("footprint too wide — merged with a wall, counter or another person")
            continue
        if count < MIN_CLUSTER_POINTS:
            drop("too few points — too far, too small, or mostly occluded")
            continue
        lateral = float(ahead[0] * centre[1] - ahead[1] * centre[0]) if ahead is not None else 0.0
        # Only the person standing in front of the lens is the visitor; anyone
        # off to the side is the room, the queue, or a passer-by.
        if corridor_m is not None and abs(lateral) > corridor_m:
            drop(f"off to the side ({lateral:+.2f} m) — not in front of the camera")
            continue
        # Two stages, because each answers a question the other cannot:
        # the full cluster is continuous, so it says where the BODY stops (and
        # thus excludes a ceiling); the narrow column excludes raised arms, so
        # it says where the HEAD is within that.
        limit = body_top(h[near])
        if limit is None:
            drop("no torso — nothing solid between 0.6 and 1.4 m, so probably occluded")
            continue
        crown = estimate_crown(h[offset <= HEAD_COLUMN_RADIUS_M], limit_m=limit)
        if crown is None:
            drop("no head found above the torso", limit)
            continue
        # Ran to the top of the body band without ever thinning out: not a
        # person, something that carries on past where a head would stop.
        if crown >= CEILING_REJECT_M:
            drop("reaches the ceiling — a wall or pillar, not a visitor", crown)
            continue
        # Too short to be anyone standing up — a desk, a counter, a chair back.
        if crown < MIN_SUBJECT_HEIGHT_M:
            drop("too short to be standing — furniture", crown)
            continue
        # A person's top is a head, narrower than the shoulders below it. A
        # cabinet, a chair back or a piece of one split off by _split_wide is
        # as wide at the top as further down, and otherwise passes every test
        # above — the dev PC's ~130 cm object was "measured" as a 130 cm person.
        if not _has_head(xy[near], h[near], centre, crown):
            drop("no head — flat-topped, so an object rather than a person", crown)
            continue
        widths = None
        if ahead is not None:
            rel = xy[near] - centre
            side = np.array([-ahead[1], ahead[0]])
            widths = body_widths(h[near], rel @ side, rel @ ahead, crown)
        subjects.append(
            Subject(
                height_m=crown,
                points=count,
                distance_m=where,
                lateral_m=lateral,
                widths=widths,
                centre_xy=(float(centre[0]), float(centre[1])),
            )
        )

    subjects.sort(key=lambda s: s.distance_m)
    return subjects


# Head: the top HEAD_BAND_M of the body. Shoulders: SHOULDER_DROP_M below the
# crown. A head is at most this share of the shoulders' width.
HEAD_BAND_M = 0.12
SHOULDER_DROP_M = (0.28, 0.40)
HEAD_TO_SHOULDER_MAX = 0.75
# Wider than any head with hair, narrower than any cabinet or chair back.
MAX_HEAD_WIDTH_M = 0.30
# A gap this small inside the head band is stereo dropout (dark hair).
HEAD_HOLE_M = 0.02


def _has_head(xy: np.ndarray, h: np.ndarray, centre: np.ndarray, crown: float) -> bool:
    """Is the top of this cluster a head on shoulders, rather than a flat top?

    Measured along the shoulders' own direction (their widest spread on the
    floor), so it needs no forward axis. The head is the continuous run under
    the body's centre line: a hand raised beside it (the gesture gate) is a
    separate run with air between, and does not widen it.
    """
    shoulders = xy[(h >= crown - SHOULDER_DROP_M[1]) & (h < crown - SHOULDER_DROP_M[0])]
    head = xy[(h >= crown - HEAD_BAND_M) & (h < crown)]
    if len(shoulders) < MIN_SLAB_POINTS or len(head) < MIN_SLAB_POINTS:
        return False
    _, _, vh = np.linalg.svd(shoulders - shoulders.mean(axis=0), full_matrices=False)
    across = vh[0]

    def width(points: np.ndarray, hole_m: float) -> float | None:
        run = _centre_run(_bridged(_runs((points - centre) @ across), hole_m))
        return None if run is None else run[1] - run[0]

    head_w = width(head, HEAD_HOLE_M)
    shoulder_w = width(shoulders, SHOULDER_HOLE_M)
    if head_w is None or shoulder_w is None:
        return False
    return head_w <= MAX_HEAD_WIDTH_M and head_w <= HEAD_TO_SHOULDER_MAX * shoulder_w


def _split_wide(xy: np.ndarray) -> list[tuple[np.ndarray, float]]:
    """Look inside a too-wide cluster for a person standing next to something.

    At CLUSTER_CELL_M the flood fill bridges any gap under ~30 cm, so a visitor
    standing beside a desk, a chair or the kiosk's own body becomes one blob
    too wide to be a person, and is dropped with it. Dev PC, 2026-10-08: about
    half of a test's frames were lost this way to a ~130 cm object 0.4 m beside
    the visitor.

    Re-clustered at FINE_CELL_M a 10 cm gap separates them. That also splits a
    person into torso and arms, so the pieces are regrouped: anything whose
    centre lies within PART_MERGE_M of a bigger piece belongs to it.
    """
    pieces = _cluster_centres(xy, cell_m=FINE_CELL_M, with_members=True)
    pieces.sort(key=lambda p: -p[2].size)
    groups: list[tuple[np.ndarray, list[np.ndarray]]] = []
    for centre, _, members in pieces:
        for seed, parts in groups:
            if np.linalg.norm(centre - seed) <= PART_MERGE_M:
                parts.append(members)
                break
        else:
            groups.append((centre, [members]))

    out = []
    for _, parts in groups:
        pts = xy[np.concatenate(parts)]
        out.append((pts.mean(axis=0), float(np.ptp(pts, axis=0).max())))
    return out


def _cluster_centres(xy: np.ndarray, cell_m: float = CLUSTER_CELL_M, with_members: bool = False):
    """Grid flood-fill on the floor plane.

    Returns one `(centroid, footprint)` per cluster, where footprint is the
    larger side of its bounding box on the floor — the measurement that tells a
    standing person from a wall. See MAX_SUBJECT_FOOTPRINT_M.
    """
    # The flood fill walks CELLS, not points, so the points are collapsed to
    # unique cells first, in numpy. Doing it the obvious way — a Python dict
    # keyed per point — costs one interpreted iteration per point, which is
    # invisible on a 640x360 cloud and dominates everything at 1280x720
    # (271 ms/frame, against a ~20 ms budget). A room only ever occupies a few
    # hundred cells however many points land in them.
    cells = np.floor(xy / cell_m).astype(int)
    uniq, inverse = np.unique(cells, axis=0, return_inverse=True)
    index_of = {(int(c[0]), int(c[1])): i for i, c in enumerate(uniq)}

    # Label each CELL by flood fill (a few hundred iterations), then push the
    # labels down to the points in one gather. Testing membership per cluster
    # instead — np.isin(inverse, group) — is O(points x clusters) and was 105 ms
    # of a 208 ms frame at 1280x720.
    label_of_cell = np.full(len(uniq), -1, dtype=np.intp)
    next_label = 0
    for start in range(len(uniq)):
        if label_of_cell[start] != -1:
            continue
        stack = [start]
        label_of_cell[start] = next_label
        while stack:
            current = stack.pop()
            cx, cy = int(uniq[current][0]), int(uniq[current][1])
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nb = index_of.get((cx + dx, cy + dy))
                    if nb is not None and label_of_cell[nb] == -1:
                        label_of_cell[nb] = next_label
                        stack.append(nb)
        next_label += 1

    if next_label == 0:
        return []

    labels = label_of_cell[inverse]
    counts = np.bincount(labels, minlength=next_label)

    # Centroid and bounding box for every cluster at once. Sorting by label puts
    # each cluster's points in one contiguous run, which `reduceat` can then
    # summarise without a Python loop.
    order = np.argsort(labels, kind="stable")
    starts = np.zeros(next_label, dtype=np.intp)
    np.cumsum(counts[:-1], out=starts[1:])
    ordered = xy[order]
    present = counts > 0
    lo = np.minimum.reduceat(ordered, starts, axis=0)
    hi = np.maximum.reduceat(ordered, starts, axis=0)
    total = np.add.reduceat(ordered, starts, axis=0)

    clusters = []
    for label in np.flatnonzero(present & (counts >= MIN_CLUSTER_POINTS)):
        centre = total[label] / counts[label]
        footprint = float((hi[label] - lo[label]).max())
        if with_members:
            members = order[starts[label] : starts[label] + counts[label]]
            clusters.append((centre, footprint, members))
        else:
            clusters.append((centre, footprint))
    return clusters


# Width of the band of frames that agree on the visitor's height. Two slabs:
# per-frame estimates are quantised to SLAB_M, so a standing visitor alternates
# between two neighbouring values (172/174 on the dev PC).
PLATEAU_M = 2 * SLAB_M + 1e-9

# Share of frames in the plateau for full / zero confidence.
PLATEAU_FULL_SHARE = 0.6
PLATEAU_NONE_SHARE = 0.2


def summarise(samples: list[float]) -> tuple[float, float] | None:
    """Collapse a window of per-frame estimates into (height_cm, confidence).

    ── Why the plateau and not the median ─────────────────────────────────
    Over a 15-30 s window the visitor walks in, leans toward the screen, bends,
    and settles. Those frames are not wrong in both directions — they are all
    SHORT: nobody reads taller than they stand (a raised hand is already cut by
    the head column). A median of the whole window is dragged down by them; on
    the dev PC a 174-175 cm visitor whose standing frames all read 172-174 got a
    median of 172, with 106-158 cm lean-in frames pulling it.

    What the standing frames have that the junk does not is AGREEMENT: they
    pile up in one narrow band. So take the densest band of PLATEAU_M and the
    median within it. Confidence is the share of frames in that band — the
    evidence that the visitor actually stood still at that height.
    """
    if len(samples) < 5:
        return None
    arr = np.sort(np.asarray(samples, dtype=float))
    ends = np.searchsorted(arr, arr + PLATEAU_M, side="right")
    sizes = ends - np.arange(arr.size)
    best = int(sizes.max())
    if best < 3:
        return None
    # Among equally dense bands take the highest: errors here only ever run short.
    start = int(np.flatnonzero(sizes == best)[-1])
    plateau = arr[start : ends[start]]
    share = best / arr.size
    confidence = float(
        np.clip((share - PLATEAU_NONE_SHARE) / (PLATEAU_FULL_SHARE - PLATEAU_NONE_SHARE), 0.0, 1.0)
    )
    return float(np.median(plateau)) * 100.0, confidence
