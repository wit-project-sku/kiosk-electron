"""
Two filters ported from demo-outfit, where a furnished room needed them.

1. Static objects. A shelf, a fan or a coat stand can pass every person test
   in estimator.find_subjects (the dev room has a ~154 cm one at 2.7 m), and
   turned every real scan into "more than one visitor". An airport has
   bollards, signs and counters. So the empty room is learned once, right
   after the floor is calibrated, and anything found again where an object
   stood is ignored. Only the point-cloud fallback needs it: the pose path
   never measures something without a skeleton.

2. A head outside the picture. With the camera on its side (as at 제주) the
   101° axis is vertical and a whole body always fits. Mounted level it is
   68.6°, and a visitor closer than ~1.5 m loses the top of their head: the
   crown search then stops at the image edge and reports the edge as their
   height. Those frames are dropped.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from estimator import Rejection, Subject
from geometry import FloorFrame
from overlay import head_in_view

# A person standing where an object stands is impossible; one beside it is not.
STATIC_RADIUS_M = 0.35
# An object must show up in this share of the empty-room frames to count, so a
# person walking through during calibration is not learned as furniture.
STATIC_MIN_SHARE = 0.4
BACKGROUND_FRAMES = 12


class Background:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.objects: list[tuple[float, float]] = []
        if path.exists():
            try:
                self.objects = [tuple(p) for p in json.loads(path.read_text(encoding="utf-8"))["objects"]]
            except (ValueError, KeyError):
                self.objects = []

    def learn(self, frames: list[list[Subject]]) -> int:
        """Remember everything that kept standing in an empty room."""
        seen: list[list[np.ndarray]] = []
        for subjects in frames:
            for s in subjects:
                if s.centre_xy is None:
                    continue
                p = np.asarray(s.centre_xy)
                for group in seen:
                    if np.linalg.norm(group[0] - p) <= STATIC_RADIUS_M:
                        group.append(p)
                        break
                else:
                    seen.append([p])
        need = max(1, int(np.ceil(STATIC_MIN_SHARE * len(frames))))
        self.objects = [tuple(float(x) for x in np.mean(g, axis=0)) for g in seen if len(g) >= need]
        self.path.write_text(json.dumps({"objects": self.objects}), encoding="utf-8")
        return len(self.objects)

    def is_static(self, s: Subject) -> bool:
        if s.centre_xy is None:
            return False
        p = np.asarray(s.centre_xy)
        return any(np.linalg.norm(p - np.asarray(o)) <= STATIC_RADIUS_M for o in self.objects)


def without_objects(subjects: list[Subject], background: Background, rejected: list[Rejection]) -> list[Subject]:
    kept = []
    for s in subjects:
        if background.is_static(s):
            rejected.append(Rejection("a learned object in the empty room", s.distance_m, 0.0, s.points, s.height_m))
        else:
            kept.append(s)
    return kept


def heads_in_view(subjects: list[Subject], frame: FloorFrame, intrinsics, rejected: list[Rejection]) -> list[Subject]:
    kept = []
    for s in subjects:
        visible = s.drawing["headInView"] if s.drawing else head_in_view(s, frame, intrinsics)
        if visible:
            kept.append(s)
        else:
            rejected.append(
                Rejection("head out of view — too close to the camera", s.distance_m, 0.0, s.points, s.height_m)
            )
    return kept
