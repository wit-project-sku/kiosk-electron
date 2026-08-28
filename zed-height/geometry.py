"""
Height estimation geometry — the whole measurement, with no ZED in sight.

Everything here takes a plain (N, 3) numpy array of metric points and returns
numbers. That is deliberate: it means the part of this feature that can actually
be *wrong* is testable with synthetic point clouds on a machine with no camera
attached (see tests/test_geometry.py). `zed.py` is the only module that needs
hardware, and it contains no arithmetic worth testing.

── Why the floor plane defines "up", and nothing else does ────────────────
The 제주 kiosks mount BOTH cameras rotated 90° (kioskLocations.cameraRotation).
Nothing in this file knows that, and nothing should: the up axis is derived from
the fitted floor plane, so the mount can be rotated, tilted, or replaced without
a constant anywhere needing to agree with it. The IMU gravity vector is used
only to sanity-check the fit (see `plane_is_plausible_floor`) — a plane detector
handed a busy airport concourse can lock onto a wall or a counter top, and a
wall passes every test except "is it perpendicular to gravity".
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

# A slab is one horizontal band of the point cloud. 2 cm is fine enough that the
# quantisation error is small against the ±2–5 cm we can honestly claim, and
# coarse enough that a slab holds a usable number of points.
SLAB_M = 0.02

# Points below this above-floor height are floor speckle; above it, nothing that
# happens at a kiosk is a person.
MIN_BODY_M = 0.30
MAX_BODY_M = 2.30

# Hips to chest on essentially any standing adult or child. Used to pick out the
# points that establish WHERE someone is standing — a torso is the one part of a
# body that stays put while the head turns and the arms wave about.
TORSO_BAND_M = (0.60, 1.40)

# Fraction of a typical HEAD-COLUMN slab that a slab must hold to count as part
# of the head. The case it has to separate is a hand held directly over the
# head: a forearm presents roughly half a head's width, so a value comfortably
# above 0.5 rejects it. See the module docstring in estimator.py.
HEAD_SLAB_FRACTION = 0.55

# Below this a slab is noise regardless of what the column reference says — it
# stops a nearly-empty frame from reporting a confident height.
MIN_SLAB_POINTS = 12


@dataclass(frozen=True)
class FloorFrame:
    """A fitted floor: unit normal pointing UP, and the plane's offset."""

    normal: np.ndarray  # (3,) unit vector, oriented so the camera is above it
    offset: float  # signed: height_of(p) = dot(normal, p) + offset

    def heights(self, points: np.ndarray) -> np.ndarray:
        """Perpendicular height above the floor, in metres, for each point."""
        return points @ self.normal + self.offset

    def floor_xy(self, points: np.ndarray) -> np.ndarray:
        """Points projected onto the floor plane, in an arbitrary but fixed 2D basis.

        The basis orientation is meaningless (it depends on the mount); only
        DISTANCES within it are used, and those are mount-independent.
        """
        a = np.array([1.0, 0.0, 0.0])
        if abs(float(self.normal @ a)) > 0.9:
            a = np.array([0.0, 1.0, 0.0])
        u = np.cross(self.normal, a)
        u /= np.linalg.norm(u)
        v = np.cross(self.normal, u)
        return np.stack([points @ u, points @ v], axis=1)

    def to_json(self) -> dict:
        return {"normal": [float(x) for x in self.normal], "offset": float(self.offset)}

    @staticmethod
    def from_json(data: dict) -> "FloorFrame":
        n = np.asarray(data["normal"], dtype=float)
        return FloorFrame(normal=n / np.linalg.norm(n), offset=float(data["offset"]))


def finite_points(raw: np.ndarray) -> np.ndarray:
    """Drop the NaN/Inf entries a stereo depth map is full of.

    Accepts either (H, W, 3+) as retrieved from the SDK or an already-flat
    (N, 3); extra channels (the packed colour in XYZRGBA) are ignored.
    """
    pts = raw.reshape(-1, raw.shape[-1])[:, :3].astype(np.float64, copy=False)
    return pts[np.isfinite(pts).all(axis=1)]


def fit_plane_ransac(
    points: np.ndarray,
    iterations: int = 200,
    tolerance_m: float = 0.02,
    rng: np.random.Generator | None = None,
) -> tuple[np.ndarray, float] | None:
    """RANSAC plane fit. Returns (unit normal, offset) or None.

    Preferred over the SDK's own `find_floor_plane` for one reason: it behaves
    identically against synthetic data, so the calibration step is testable
    without hardware and does not shift under a ZED SDK upgrade.
    """
    if len(points) < 3:
        return None
    rng = rng or np.random.default_rng(0)

    best_inliers: np.ndarray | None = None
    best_count = 0

    for _ in range(iterations):
        idx = rng.choice(len(points), size=3, replace=False)
        a, b, c = points[idx]
        normal = np.cross(b - a, c - a)
        norm = np.linalg.norm(normal)
        if norm < 1e-9:
            continue
        normal = normal / norm
        offset = -float(normal @ a)
        inliers = np.abs(points @ normal + offset) < tolerance_m
        count = int(inliers.sum())
        if count > best_count:
            best_count, best_inliers = count, inliers

    if best_inliers is None or best_count < 3:
        return None

    # Refit on the consensus set — the 3-point sample fixes WHICH plane, a
    # least-squares fit over every inlier fixes it accurately.
    inlier_pts = points[best_inliers]
    centroid = inlier_pts.mean(axis=0)
    _, _, vh = np.linalg.svd(inlier_pts - centroid, full_matrices=False)
    normal = vh[2] / np.linalg.norm(vh[2])
    return normal, -float(normal @ centroid)


def orient_up(normal: np.ndarray, offset: float) -> FloorFrame:
    """Flip the plane so "up" is the side the camera is on.

    The camera sits at the origin and is always above the floor, so the sign of
    the origin's signed distance settles it. Mount-agnostic by construction.
    """
    if offset < 0:
        return FloorFrame(normal=-normal, offset=-offset)
    return FloorFrame(normal=normal, offset=offset)


def plane_is_plausible_floor(
    frame: FloorFrame, gravity: np.ndarray | None, max_tilt_deg: float = 20.0
) -> bool:
    """Is this plane actually the floor, and not a wall or a counter top?

    Checked against the IMU's gravity vector, which is the one piece of
    information a point cloud cannot supply. With no IMU reading available the
    check passes — a missing sensor must not block calibration, it just means
    the operator is the only thing standing between us and a wall.
    """
    if gravity is None:
        return True
    g = np.asarray(gravity, dtype=float)
    norm = np.linalg.norm(g)
    if norm < 1e-6:
        return True
    cos = abs(float(frame.normal @ (g / norm)))
    return cos >= np.cos(np.deg2rad(max_tilt_deg))
