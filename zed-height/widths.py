"""
Body widths — shoulder, chest, waist and hip breadth, from the same point cloud.

Breadth, not circumference: the camera sees the visitor's front, and the side-to-
side extent of that front is the one body measurement a single view gets right.
Circumference needs the back and is left to whatever consumes these numbers.

── Why not the ZED's Body Tracking ────────────────────────────────────────
Its keypoint model is trained on upright people. 제주 mounts this camera rotated
90°, so in the image every visitor is lying on their side. Classical geometry on
the point cloud does not care which way up the image is — the same reason the
height estimator works from the floor plane rather than image axes.

── Where each width is taken ──────────────────────────────────────────────
Landmark heights come from the visitor's own measured height, using adult
proportions (crown = 1.0). They vary by a few percent between people, which is
why each torso width is taken over a BAND, as the narrowest (waist) or widest
(hip) slab in it rather than at one guessed height.

── Arms ───────────────────────────────────────────────────────────────────
Hanging arms sit beside the torso at chest, waist and hip height. A slab's
side-to-side profile shows them as separate runs of points when there is air
between arm and body; the torso is the run under the body's centre. When the
arm touches the body there is no gap, the run is torso-plus-arms, and the slab
is discarded — see ARM_MERGE_FRACTION. Across a 15-30 s capture the visitor
shifts enough for some frames to show the gap.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from geometry import SLAB_M

# Bands as fractions of measured height.
SHOULDER_BAND = (0.78, 0.83)  # widest, arms included: deltoid to deltoid
CHEST_BAND = (0.70, 0.75)
WAIST_BAND = (0.58, 0.66)  # narrowest torso slab
HIP_BAND = (0.47, 0.55)  # widest torso slab

# Side-to-side resolution of a slab's profile.
WIDTH_BIN_M = 0.01
# A bin is "body" when it holds at least this share of the slab's typical
# occupied bin. Relative, because density falls with the square of distance: a
# fixed count that suits 1.1 m reads a sparse torso at 2.7 m as full of holes,
# and every hole splits the torso in two.
BIN_FRACTION = 0.2
MIN_BIN_POINTS = 2
# A one-bin hole inside a body part is stereo dropout; two or more is air
# between an arm and the torso.
MAX_HOLE_BINS = 1

# Width slabs are taller than the height estimator's: twice the points per bin,
# and an arm-to-body gap runs vertically, so a taller slab keeps it.
WIDTH_SLAB_M = 2 * SLAB_M

# Only points this far behind the slab's frontmost surface count. The camera sees
# the front half of a body; anything deeper is a stereo smear off the silhouette
# edge, which lands further sideways than the body and would widen it.
MAX_SLAB_DEPTH_M = 0.20

# A torso slab at least this wide relative to the shoulders has an arm stuck to
# it. A real chest, waist or hip is narrower than deltoid-to-deltoid — hips come
# closest, at roughly 0.9 on some women — while torso-plus-two-arms is wider.
ARM_MERGE_FRACTION = 0.95

MIN_SLAB_POINTS = 20

# Plausible shoulder width as a share of height (adults: ~0.22-0.30).
SHOULDER_PER_HEIGHT = (0.18, 0.34)

# What an arm looks like in a slab: a separate run this wide, starting within
# ARM_REACH_M of the torso's edge. A torso slab is only trusted with one on EACH
# side — positive evidence that both arms are clear of it. "Narrower than the
# shoulders" alone was not enough: in synthetic tests a hip with a forearm
# half-touching it passed as a confident 43 cm against a true 35.
ARM_WIDTH_M = (0.03, 0.16)
ARM_REACH_M = 0.15


@dataclass(frozen=True)
class BodyWidths:
    """One frame's widths in metres; None where that frame could not tell."""

    shoulder_m: float | None = None
    chest_m: float | None = None
    waist_m: float | None = None
    hip_m: float | None = None


def _runs(lateral: np.ndarray) -> list[tuple[float, float]]:
    """Contiguous runs of occupied bins along the side-to-side axis, as (left, right)."""
    if lateral.size < MIN_SLAB_POINTS:
        return []
    idx = np.floor(lateral / WIDTH_BIN_M).astype(int)
    lo = int(idx.min())
    counts = np.bincount(idx - lo)
    typical = float(np.median(counts[counts > 0]))
    occupied = np.flatnonzero(counts >= max(MIN_BIN_POINTS, BIN_FRACTION * typical))
    if occupied.size == 0:
        return []
    breaks = np.flatnonzero(np.diff(occupied) > MAX_HOLE_BINS + 1)
    runs = []
    for group in np.split(occupied, breaks + 1):
        runs.append(((group[0] + lo) * WIDTH_BIN_M, (group[-1] + lo + 1) * WIDTH_BIN_M))
    return runs


# At deltoid height the arms are attached, so the shoulders are one run and any
# hole in it is a stereo dropout (plain fabric), never air.
SHOULDER_HOLE_M = 0.04


def _bridged(runs: list[tuple[float, float]], max_hole_m: float) -> list[tuple[float, float]]:
    """Join runs separated by no more than `max_hole_m`."""
    out: list[tuple[float, float]] = []
    for run in runs:
        if out and run[0] - out[-1][1] <= max_hole_m:
            out[-1] = (out[-1][0], run[1])
        else:
            out.append(run)
    return out


def _centre_run(runs: list[tuple[float, float]]) -> tuple[float, float] | None:
    """The run under the body's centre line (lateral 0), or the nearest to it."""
    if not runs:
        return None
    return min(runs, key=lambda r: 0.0 if r[0] <= 0.0 <= r[1] else min(abs(r[0]), abs(r[1])))


def _torso_between_arms(runs: list[tuple[float, float]]) -> tuple[float, float] | None:
    """The torso's edges, read as the space between two visible arms.

    The outermost run on each side must be arm-sized and separate — positive
    evidence that the arm is clear of the body. The torso is then everything
    between them, holes included: a plain untextured shirt leaves gaps in a
    stereo depth map, and a gap in the MIDDLE of the chest is not an edge.
    (Reading the run under the centre line instead split such a chest in two
    and reported half of it.)
    """
    if len(runs) < 3:
        return None
    left_arm, right_arm = runs[0], runs[-1]
    torso = (runs[1][0], runs[-2][1])

    def arm(run: tuple[float, float], gap: float) -> bool:
        return ARM_WIDTH_M[0] <= run[1] - run[0] <= ARM_WIDTH_M[1] and gap <= ARM_REACH_M

    if not arm(left_arm, torso[0] - left_arm[1]) or not arm(right_arm, right_arm[0] - torso[1]):
        return None
    # The torso must straddle the body's centre line, or the "arms" were
    # something else beside a smaller run.
    if not torso[0] <= 0.0 <= torso[1]:
        return None
    return torso


def _slabs(heights: np.ndarray, lateral: np.ndarray, depth: np.ndarray, crown: float, band):
    """Yield the lateral coordinates of each slab inside a height band."""
    lo, hi = band[0] * crown, band[1] * crown
    for bottom in np.arange(lo, hi, SLAB_M):
        mask = (heights >= bottom) & (heights < bottom + WIDTH_SLAB_M)
        if mask.sum() < MIN_SLAB_POINTS:
            continue
        d = depth[mask]
        front = float(np.percentile(d, 2))
        yield lateral[mask][d <= front + MAX_SLAB_DEPTH_M]


def body_widths(
    heights: np.ndarray, lateral: np.ndarray, depth: np.ndarray, crown: float
) -> BodyWidths:
    """Widths for one visitor in one frame.

    `heights` are above the floor, `lateral` is sideways from the body's centre
    and `depth` runs away from the camera, all in metres and all for the
    visitor's own points only. `crown` is their measured height.
    """
    shoulder_widths = []
    for slab in _slabs(heights, lateral, depth, crown, SHOULDER_BAND):
        run = _centre_run(_bridged(_runs(slab), SHOULDER_HOLE_M))
        if run is not None:
            shoulder_widths.append(run[1] - run[0])
    shoulder = max(shoulder_widths) if shoulder_widths else None
    # Deltoid-to-deltoid is about a quarter of stature on adults. Far outside
    # that, the run caught a raised arm (the gesture gate: 72-76 cm on a 174 cm
    # visitor on the dev PC) or something beside the shoulder.
    if shoulder is not None and not SHOULDER_PER_HEIGHT[0] <= shoulder / crown <= SHOULDER_PER_HEIGHT[1]:
        shoulder = None

    def torso(band) -> list[float]:
        widths = []
        for slab in _slabs(heights, lateral, depth, crown, band):
            run = _torso_between_arms(_runs(slab))
            if run is None:
                continue
            width = run[1] - run[0]
            # Without a shoulder width there is nothing to tell an arm-merged
            # slab from a real one, so nothing is trusted.
            if shoulder is None or width >= ARM_MERGE_FRACTION * shoulder:
                continue
            widths.append(width)
        return widths

    chest = torso(CHEST_BAND)
    waist = torso(WAIST_BAND)
    hip = torso(HIP_BAND)
    return BodyWidths(
        shoulder_m=shoulder,
        chest_m=float(np.median(chest)) if chest else None,
        waist_m=min(waist) if waist else None,
        hip_m=max(hip) if hip else None,
    )


# Minimum frames agreeing before a width is reported at all.
MIN_WIDTH_FRAMES = 5


def summarise_widths(frames: list[BodyWidths]) -> dict[str, float | None]:
    """Median of each width across the frames that measured it, in cm."""
    out: dict[str, float | None] = {}
    for key, field in (
        ("shoulderWidthCm", "shoulder_m"),
        ("chestWidthCm", "chest_m"),
        ("waistWidthCm", "waist_m"),
        ("hipWidthCm", "hip_m"),
    ):
        values = [getattr(f, field) for f in frames if getattr(f, field) is not None]
        out[key] = round(float(np.median(values)) * 100.0, 1) if len(values) >= MIN_WIDTH_FRAMES else None
    return out
