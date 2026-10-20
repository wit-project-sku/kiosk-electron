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


def wall(rng: np.random.Generator, distance_m: float = 2.6, width_m: float = 4.0) -> np.ndarray:
    """A flat vertical surface running from the floor past head height.

    The thing a first version of this estimator confidently measured as a 230 cm
    visitor. Indoors it is the largest above-the-floor cluster in the scene, so
    any person-detection worth having has to reject it.
    """
    area = width_m * 2.6
    n = int(area * DENSITY)
    x = rng.uniform(-width_m / 2, width_m / 2, n)
    z = rng.uniform(0.0, 2.6, n)
    return np.stack([x, np.full(n, distance_m), z], axis=1)


def counter(rng: np.random.Generator, centre_xy=(0.9, 0.0), height_m: float = 1.1) -> np.ndarray:
    """A waist-high counter — wide, flat-topped, and standing on the floor."""
    return _cylinder(rng, 0.5, 0.0, height_m, centre_xy)


def gravity_in_camera_frame(tilt_deg: float = 0.0, roll_deg: float = 90.0) -> np.ndarray:
    """The IMU reading a camera placed by `place()` would report.

    World up is +z; an accelerometer at rest reads +g along it. Rotating that by
    the same transform `place` applies gives what the real sensor would say, so
    tests constrain the plane fit exactly the way the kiosk does.
    """
    return place(np.array([[0.0, 0.0, 9.81]]), tilt_deg=tilt_deg, roll_deg=roll_deg)[0] - place(
        np.zeros((1, 3)), tilt_deg=tilt_deg, roll_deg=roll_deg
    )[0]


def ceiling(rng: np.random.Generator, height_m: float = 2.45, extent: float = 3.0) -> np.ndarray:
    """A ceiling above the scene.

    Indoors this sits directly over the visitor's head, inside the head column,
    and under MAX_BODY_M — so a crown search that takes the highest passing slab
    measures the ceiling instead of the person. It reads as a plausible
    210-225 cm, which is how it went unnoticed until a real room was tried.
    """
    n = int(extent * extent * 4 * 2_000)
    xy = rng.uniform(-extent, extent, size=(n, 2))
    return np.column_stack([xy, np.full(n, height_m)])


def forward_in_camera_frame(tilt_deg: float = 0.0, roll_deg: float = 90.0) -> np.ndarray:
    """The camera's line of sight in its own frame — world +y, as `place` looks."""
    return place(np.array([[0.0, 1.0, 0.0]]), tilt_deg=tilt_deg, roll_deg=roll_deg)[0] - place(
        np.zeros((1, 3)), tilt_deg=tilt_deg, roll_deg=roll_deg
    )[0]


def shaped_person(
    rng: np.random.Generator,
    height_m: float = 1.75,
    shoulder_m: float = 0.46,
    chest_m: float = 0.32,
    waist_m: float = 0.28,
    hip_m: float = 0.35,
    arm_gap_m: float | None = 0.04,
) -> np.ndarray:
    """A body with real proportions, for the width estimator.

    The torso is a stack of elliptical rings whose breadth passes through the
    given hip (0.51 H), waist (0.62 H) and chest (0.725 H) values and reaches the
    deltoids at 0.80 H. Arms hang straight down from the shoulders: with
    `arm_gap_m` there is that much air between arm and chest, with None the arm
    touches the torso all the way down — arms relaxed at the sides.
    """
    arm_r = 0.045
    knots_z = np.array([0.47, 0.51, 0.62, 0.725, 0.80, 0.82]) * height_m
    torso_shoulder = shoulder_m - 4 * arm_r  # deltoid-to-deltoid includes both arms
    knots_w = np.array([hip_m * 0.95, hip_m, waist_m, chest_m, torso_shoulder, torso_shoulder * 0.8])
    parts = []
    for z in np.arange(knots_z[0], knots_z[-1], 0.004):
        a = np.interp(z, knots_z, knots_w) / 2.0
        b = a * 0.65
        # Evenly spaced side to side, as a camera's pixel grid sees a body —
        # not evenly spaced around the ring, which would leave the middle of
        # the torso the sparsest part of it.
        n = max(int(2 * a * 0.004 * DENSITY), 8)
        x = rng.uniform(-a, a, n)
        y = b * np.sqrt(np.clip(1.0 - (x / a) ** 2, 0.0, 1.0)) * rng.choice([-1.0, 1.0], n)
        parts.append(np.stack([x, y, np.full(n, z)], axis=1))

    leg_x = hip_m / 4
    parts += [
        _cylinder(rng, 0.07, 0.0, knots_z[0], (-leg_x, 0.0)),
        _cylinder(rng, 0.07, 0.0, knots_z[0], (leg_x, 0.0)),
        _cylinder(rng, 0.05, knots_z[-1], height_m - 0.2, (0.0, 0.0)),
        _sphere(rng, 0.09, (0.0, 0.0, height_m - 0.09)),
    ]
    # Arms hang from the shoulder joint, touching the torso at deltoid height
    # (which is what makes deltoid-to-deltoid one run), then either angle out
    # to leave `arm_gap_m` of air beside the chest, or rest against the body.
    top_x = shoulder_m / 2 - arm_r
    low_x = chest_m / 2 + arm_r + (arm_gap_m if arm_gap_m is not None else 0.0)
    arm_z = np.array([0.45, 0.72, 0.78, 0.81]) * height_m
    arm_xs = np.array([low_x, low_x, top_x, top_x])
    for z in np.arange(arm_z[0], arm_z[-1], 0.004):
        x = float(np.interp(z, arm_z, arm_xs))
        n = max(int(2 * np.pi * arm_r * 0.004 * DENSITY), 6)
        t = rng.uniform(0, 2 * np.pi, n)
        for sx in (-x, x):
            parts.append(np.stack([sx + arm_r * np.cos(t), arm_r * np.sin(t), np.full(n, z)], axis=1))
    return np.concatenate(parts, axis=0)
