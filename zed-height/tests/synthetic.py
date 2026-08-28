"""
Synthetic visitors, so the estimator can be judged without a camera.

Surface points are sampled at a constant density (points per m²), which is what
makes these clouds a fair test of `estimate_crown`: its whole premise is that a
slab through a head holds proportionally more points than a slab through a
raised arm, and constant-density sampling reproduces exactly that relationship.
"""

from __future__ import annotations

import numpy as np

DENSITY = 20_000.0  # points per m² of surface


def _cylinder(rng, radius, z0, z1, centre_xy=(0.0, 0.0)):
    area = 2 * np.pi * radius * (z1 - z0)
    n = max(int(area * DENSITY), 1)
    theta = rng.uniform(0, 2 * np.pi, n)
    z = rng.uniform(z0, z1, n)
    return np.stack(
        [centre_xy[0] + radius * np.cos(theta), centre_xy[1] + radius * np.sin(theta), z],
        axis=1,
    )


def _sphere(rng, radius, centre):
    area = 4 * np.pi * radius**2
    n = max(int(area * DENSITY), 1)
    v = rng.normal(size=(n, 3))
    v /= np.linalg.norm(v, axis=1, keepdims=True)
    return v * radius + np.asarray(centre)


def person(
    rng: np.random.Generator,
    height_m: float = 1.71,
    centre_xy: tuple[float, float] = (0.0, 0.0),
    raised_arm_to: float | None = None,
    arm_offset: float = 0.22,
) -> np.ndarray:
    """A standing body whose crown is exactly `height_m` above z = 0.

    `raised_arm_to` puts a forearm-thick column up to that height — the 제주
    gesture gate makes this the common case, not the edge case. `arm_offset` is
    how far to the side it is held: the default 0.22 m is a hand raised beside
    the head, while a small value puts it directly overhead, which is the pose
    the head column cannot filter.
    """
    head_r = 0.09
    head_c = height_m - head_r
    torso_top = head_c - 0.17
    cx, cy = centre_xy

    parts = [
        _cylinder(rng, 0.08, 0.0, 0.80, (cx - 0.10, cy)),
        _cylinder(rng, 0.08, 0.0, 0.80, (cx + 0.10, cy)),
        _cylinder(rng, 0.20, 0.80, torso_top, (cx, cy)),
        _cylinder(rng, 0.05, torso_top, head_c - head_r, (cx, cy)),
        _sphere(rng, head_r, (cx, cy, head_c)),
    ]
    if raised_arm_to is not None:
        parts.append(_cylinder(rng, 0.045, 1.30, raised_arm_to, (cx + arm_offset, cy)))
    return np.concatenate(parts, axis=0)


def floor(rng: np.random.Generator, extent: float = 3.0) -> np.ndarray:
    n = int(extent * extent * 4 * 2_000)
    xy = rng.uniform(-extent, extent, size=(n, 2))
    return np.column_stack([xy, np.zeros(n)])


def place(
    points: np.ndarray,
    tilt_deg: float = 0.0,
    roll_deg: float = 90.0,
    distance_m: float = 2.0,
) -> np.ndarray:
    """Move a world-frame cloud into a camera frame.

    `roll_deg` defaults to 90 because the 제주 cameras are mounted rotated 90°
    (kioskLocations.cameraRotation). Nothing in the estimator is told this — the
    point of the test is that it recovers up from the floor regardless.
    """
    t, r = np.deg2rad(tilt_deg), np.deg2rad(roll_deg)
    rx = np.array([[1, 0, 0], [0, np.cos(t), -np.sin(t)], [0, np.sin(t), np.cos(t)]])
    rz = np.array([[np.cos(r), -np.sin(r), 0], [np.sin(r), np.cos(r), 0], [0, 0, 1]])
    # Camera 1.4 m above the floor, visitor "distance_m" in front of it.
    shifted = points - np.array([0.0, distance_m, 1.4])
    return shifted @ (rz @ rx).T
