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
    gravity: np.ndarray | None = None,
    max_tilt_deg: float = 20.0,
) -> tuple[np.ndarray, float] | None:
    """RANSAC plane fit. Returns (unit normal, offset) or None.

    Preferred over the SDK's own `find_floor_plane` for one reason: it behaves
    identically against synthetic data, so the calibration step is testable
    without hardware and does not shift under a ZED SDK upgrade.

    ── Why `gravity` matters more than it looks ───────────────────────────
    RANSAC finds the plane with the most points on it, and indoors that is
    frequently NOT the floor. A wall a couple of metres away fills far more of
    a depth image than the strip of floor the camera can see, so a plain fit
    lands on the wall, "up" comes out horizontal, and every height afterwards is
    nonsense. Rejecting that afterwards is not enough — the fit has already
    thrown away the floor.

    So the IMU's gravity vector is used as a CONSTRAINT during the search: any
    candidate plane more than `max_tilt_deg` from horizontal is never considered
    in the first place. Without a gravity reading the search is unconstrained,
    which is the old behaviour.
    """
    if len(points) < 3:
        return None
    rng = rng or np.random.default_rng(0)

    up: np.ndarray | None = None
    if gravity is not None:
        g = np.asarray(gravity, dtype=float)
        if np.linalg.norm(g) > 1e-6:
            up = g / np.linalg.norm(g)
    min_cos = np.cos(np.deg2rad(max_tilt_deg))

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
        # Not level enough to be a floor — a wall, a door, a desk side.
        if up is not None and abs(float(normal @ up)) < min_cos:
            continue
        offset = -float(normal @ a)
        # Level, but ABOVE the camera: a ceiling. Just as flat and just as
        # tempting to RANSAC, and indoors it often carries more points than the
        # sliver of floor in view.
        if up is not None and not camera_is_above(orient_up(normal, offset, up)):
            continue
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


def orient_up(normal: np.ndarray, offset: float, gravity: np.ndarray | None = None) -> FloorFrame:
    """Point the plane's normal at the sky.

    With a `gravity` reading this is exact: an accelerometer at rest measures
    proper acceleration, which points UP, so the normal is flipped to agree with
    it. That distinction matters more than it sounds — a CEILING is as flat and
    as level as a floor, and fits just as well. Orienting by gravity leaves a
    ceiling's normal pointing up too, which then puts the camera *below* the
    plane and gives it a negative offset, so it can be recognised and rejected
    (see `camera_is_above`). Orienting by "whichever side the camera is on"
    cannot tell them apart at all: it silently turns a ceiling into an
    upside-down floor, and every height afterwards is measured downwards from
    it.

    Without gravity it falls back to assuming the camera is above the plane,
    which is the old behaviour and right whenever the plane really is the floor.
    """
    if gravity is not None:
        g = np.asarray(gravity, dtype=float)
        if np.linalg.norm(g) > 1e-6:
            up = g / np.linalg.norm(g)
            if float(normal @ up) < 0:
                return FloorFrame(normal=-normal, offset=-offset)
            return FloorFrame(normal=normal, offset=offset)
    if offset < 0:
        return FloorFrame(normal=-normal, offset=-offset)
    return FloorFrame(normal=normal, offset=offset)


# A camera mounted lower than this is not looking at a kiosk floor; a "floor"
# found above the camera is a ceiling.
MIN_CAMERA_HEIGHT_M = 0.30


def camera_is_above(frame: FloorFrame) -> bool:
    """Is the camera above this plane, i.e. can it be the floor?

    The camera sits at the origin, so its height above the plane is exactly the
    offset. A ceiling — correctly oriented by gravity — yields a negative one.
    """
    return frame.offset >= MIN_CAMERA_HEIGHT_M


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
