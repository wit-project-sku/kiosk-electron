"""
Where a measured visitor is in the camera IMAGE, and which way is up in it.

Ported from demo-outfit, whose live stream also drew the measurements over the
picture (`overlay()` there). The kiosk renders nothing, so only the geometry the
measurement itself needs is kept: the floor's in-plane axes, whether a crown is
inside the picture, and the turn that stands the sideways 제주 mount upright for
the pose model. The module keeps its demo name so the two stay easy to diff.

Image coordinates are normalised to 0..1 of the RAW sensor image.
"""

from __future__ import annotations

import numpy as np

from estimator import Subject
from geometry import FloorFrame


def floor_basis(frame: FloorFrame) -> tuple[np.ndarray, np.ndarray]:
    """The (u, v) axes FloorFrame.floor_xy projects onto — must stay identical to it."""
    a = np.array([1.0, 0.0, 0.0])
    if abs(float(frame.normal @ a)) > 0.9:
        a = np.array([0.0, 1.0, 0.0])
    u = np.cross(frame.normal, a)
    u /= np.linalg.norm(u)
    v = np.cross(frame.normal, u)
    return u, v


# The crown must be at least this far (normalised) inside the image edge.
HEAD_MARGIN = 0.02


def head_in_view(s: Subject, frame: FloorFrame, intrinsics) -> bool:
    """Whether the crown projects inside the image. A crown AT the edge is the
    edge of the picture, not the top of a head."""
    if s.centre_xy is None or intrinsics is None:
        return True
    fx, fy, cx, cy, width, height = intrinsics
    u, v = floor_basis(frame)
    p = s.centre_xy[0] * u + s.centre_xy[1] * v + (s.height_m - frame.offset) * frame.normal
    if p[2] <= 0.05:
        return False
    x = (fx * p[0] / p[2] + cx) / width
    y = (fy * p[1] / p[2] + cy) / height
    return HEAD_MARGIN <= x <= 1 - HEAD_MARGIN and HEAD_MARGIN <= y <= 1 - HEAD_MARGIN


def display_rotation(frame: FloorFrame) -> int:
    """Clockwise degrees (0/90/180/270) that put the floor at the bottom of the image.

    Image axes: x right, y down. "Up" in the image is the floor normal's x/y
    part; rotating the picture clockwise by 90° maps a direction (x, y) to
    (-y, x). Pick the turn that brings up closest to (0, -1). The pose model
    expects people upright, so body.UprightFrame turns the image by this.
    """
    up = np.array([frame.normal[0], frame.normal[1]])
    best, best_dot = 0, -2.0
    for k in range(4):
        dot = -float(up[1])
        if dot > best_dot:
            best, best_dot = k, dot
        up = np.array([-up[1], up[0]])
    return best * 90
