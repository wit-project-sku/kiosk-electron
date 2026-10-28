"""
Body measurement from a pose model, a person mask and ZED depth.

Ported from demo-outfit (Desktop/demo-outfit/zed-sidecar), where it was tuned
on real visitors. The point-cloud estimator (estimator.py + widths.py) stays as
the fallback when mediapipe or the model is missing; it finds people as
clusters and measures at fixed fractions of height, which has three limits:

- anything person-shaped counts — a shelf in the dev room read as 154 cm;
- chest, waist and hip are taken at fixed shares of height, not where THIS
  body's chest, waist and hips are, and an arm against the side is torso;
- stereo depth drops out at hair and silhouette edges, which are exactly the
  places height and width are measured from.

Here MediaPipe's pose landmarker (Apache-2.0, CPU) looks at the LEFT image —
the one the point cloud is registered to, pixel for pixel — and returns, per
person, 33 joints and a segmentation mask. The mask gives edges with image
precision; the ZED gives the scale (metres) and the floor. So:

  height   the top of the mask over the head, cast as a ray to the head's own
           depth, measured above the floor plane;
  widths   mask width at the person's own anatomy (bands between the shoulder
           and hip joints), with the arms cut off at the elbow/wrist line;
  girths   an ellipse fitted to the torso's FRONT depth profile gives this
           body's front-to-back depth, so circumference follows the body
           instead of one constant for everyone.

Furniture has no skeleton, so it is never measured.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from estimator import Subject
from geometry import FloorFrame
from overlay import floor_basis
from widths import SHOULDER_PER_HEIGHT, BodyWidths

MODEL_PATH = Path(
    os.environ.get("HEIGHT_POSE_MODEL", Path(__file__).with_name("models") / "pose_landmarker_heavy.task")
)

# MediaPipe pose landmark indices.
NOSE, L_EAR, R_EAR = 0, 7, 8
L_SHOULDER, R_SHOULDER, L_ELBOW, R_ELBOW, L_WRIST, R_WRIST = 11, 12, 13, 14, 15, 16
L_HIP, R_HIP, L_KNEE, R_KNEE, L_ANKLE, R_ANKLE = 23, 24, 25, 26, 27, 28
FEET = (L_ANKLE, R_ANKLE, 29, 30, 31, 32)  # ankles, heels, toes
BONES = [
    (L_SHOULDER, R_SHOULDER), (L_SHOULDER, L_ELBOW), (L_ELBOW, L_WRIST), (R_SHOULDER, R_ELBOW),
    (R_ELBOW, R_WRIST), (L_SHOULDER, L_HIP), (R_SHOULDER, R_HIP), (L_HIP, R_HIP), (L_HIP, L_KNEE),
    (L_KNEE, L_ANKLE), (R_HIP, R_KNEE), (R_KNEE, R_ANKLE),
]
ARMS = [(L_SHOULDER, L_ELBOW), (L_ELBOW, L_WRIST), (R_SHOULDER, R_ELBOW), (R_ELBOW, R_WRIST)]

MAX_POSES = 3
MASK_THRESHOLD = 0.5
MIN_VISIBILITY = 0.5
MIN_BODY_PIXELS = 3000
# Mask pixels further than this from the body's median depth are background
# showing through the mask's soft edge, not the person.
DEPTH_BAND_M = 0.40
# The mask's top must be this far inside the picture to be a head, not the edge.
HEAD_EDGE_PX = 3
# Seen from the front, the top of the head's outline is where the skull is
# tangent to the view ray — about the middle of the head, behind the face.
HEAD_CENTRE_BEHIND_FACE_M = 0.06
MIN_HEIGHT_M, MAX_HEIGHT_M = 1.0, 2.3

# The floor the person stands on, seen around their feet. The calibrated plane
# gets the floor's ANGLE right, but its height is one number from one moment:
# a fit that landed on a desk, or a camera nudged since, shifts every visitor
# by the same amount (dev room 2026-10-22: calibrated 0.735 m, a 176 cm visitor
# read 142). The floor beside the shoes is in the same frame as the head, so
# height is taken from there whenever the feet are in view.
FOOT_REGION_M = 0.30  # around the foot landmarks
FLOOR_NEAR_FEET_M = 0.50  # depth band around the feet
FLOOR_LAYER_M = 0.03
MIN_LOCAL_FLOOR_POINTS = 60

# Bands as shares of the shoulder-joint → hip-joint distance, measured down
# from the shoulder joints (hip band: around the hip joints).
SHOULDER_ROWS = (-0.02, 0.12)  # deltoid to deltoid — arms belong to it
CHEST_ROWS = (0.22, 0.38)
WAIST_ROWS = (0.55, 0.80)
HIP_ROWS_FROM_HIP = (-0.05, 0.30)

# Half an upper arm / forearm; an arm touching the torso is cut this far in
# from its landmark line. (Mirroring the arm's visible outer edge across the
# line instead was tried on real frames: the shoulder landmark sits inside the
# deltoid, so the mirror cut chests 5 cm short.)
ARM_HALF_WIDTH_M = 0.04
# The hand continues the forearm past the wrist landmark by about this share
# of the forearm. Hanging hands are at hip height: without it a hip band ran
# through both hands (dev room 2026-10-22: 54 cm "hips").
HAND_PER_FOREARM = 0.9
# Only an arm in the outer part of the run is beside the torso; one further in
# is in front of it (crossed arms) and cutting there would halve the torso.
ARM_OUTER_SHARE = 0.3
# Only single-pixel mask noise is bridged: at 2 m an arm held 1 cm off the
# body leaves a 2-3 px gap, and that gap is what separates arm from chest.
BRIDGE_PX = 1
# A band where most rows needed an arm cut has no gap between arm and torso:
# the cut is a landmark guess (±3 cm), so the band counts only as a fallback.
CUT_SHARE_TOUCHING = 0.5

# An arm against the torso shows in depth where the outline does not. Walking
# out from the centre, a torso alone only gets further away until its outline;
# where an arm touches, depth peaks in the crease between them and then comes
# FORWARD again over the arm (dev room 2026-10-22, armpit rows: "4 5 4 · 14 13
# 12 11" cm). A crease with at least an arm's width of body beyond it, and
# this much forward again, is the torso's edge.
ARM_FORWARD_M = 0.015
ARM_MIN_WIDTH_M = 0.04
ARM_DEPTH_SMOOTH_PX = 5
# Only the outer part of each half is searched; further in is chest.
ARM_DEPTH_SEARCH_FROM = 0.5

# A torso's front profile is flatter in the middle and steeper at the edges
# than an ellipse (a rounded box), so an ellipse fitted through it comes out
# too deep: real waists fitted at 0.9 of their half-width, a body nearly as
# deep as it is wide (dev room 2026-10-22: 113-cm waists). Fits within
# DEPTH_FIT_SANE are clamped to DEPTH_PER_HALF_WIDTH — the range torsos have
# (Size Korea men: chest, waist and hip depth all ~0.70 of breadth; a belly a
# little more) — and fits outside it are discarded.
DEPTH_FIT_SANE = (0.3, 1.3)
# A waist at least this share of the chest's width, with its front less than
# BELLY_AHEAD_M in front of the chest's, is a top hanging from the chest
# (_waist_draped). A belly that makes a waist as wide as a chest sticks out
# well beyond this.
DRAPE_WIDTH_SHARE = 0.97
BELLY_AHEAD_M = 0.045
DEPTH_PER_HALF_WIDTH = (0.5, 0.75)
ELLIPSE_FIT_SPAN = 0.85
# Outline depth behind the front surface when the depth fit fails.
SIDE_DEPTH_FALLBACK_M = 0.08


@dataclass(frozen=True)
class BodyGirths:
    """One frame's ellipse circumferences in metres; None where the depth fit failed."""

    chest_m: float | None = None
    waist_m: float | None = None
    hip_m: float | None = None


class PoseUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class Why:
    """Why a detected person was not measured: `code` for the live hint, `text` for logs."""

    code: str  # turned · far · hidden · zone · side · nohead · height
    text: str
    distance_m: float | None = None


class PoseMeasurer:
    """MediaPipe pose landmarker plus the geometry. Not thread-safe: one per thread."""

    def __init__(self, model_path: Path = MODEL_PATH) -> None:
        if not model_path.exists():
            raise PoseUnavailable(f"pose model missing: {model_path}")
        try:
            import mediapipe as mp  # noqa: PLC0415 — optional; the 제주 path runs without it
            from mediapipe.tasks.python import BaseOptions, vision  # noqa: PLC0415
        except ImportError as exc:
            raise PoseUnavailable("mediapipe is not installed in this interpreter") from exc
        self._mp = mp
        # The most useful reason nobody was measured in the last frame, or None.
        self.hint: dict | None = None
        self._landmarker = vision.PoseLandmarker.create_from_options(
            vision.PoseLandmarkerOptions(
                base_options=BaseOptions(model_asset_path=str(model_path)),
                num_poses=MAX_POSES,
                output_segmentation_masks=True,
            )
        )

    def detect(self, upright_rgb: np.ndarray) -> list[tuple[np.ndarray, np.ndarray]]:
        """[(landmarks (33, 3) as pixel x, pixel y, visibility; mask (H, W) bool)] per person."""
        h, w = upright_rgb.shape[:2]
        result = self._landmarker.detect(self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=upright_rgb))
        people = []
        for i, landmarks in enumerate(result.pose_landmarks):
            lm = np.array([[p.x * w, p.y * h, p.visibility if p.visibility is not None else 1.0] for p in landmarks])
            mask = np.squeeze(result.segmentation_masks[i].numpy_view())
            if mask.shape != (h, w):  # nearest-neighbour to the image size
                ys = (np.arange(h) * mask.shape[0] // h)[:, None]
                xs = (np.arange(w) * mask.shape[1] // w)[None, :]
                mask = mask[ys, xs]
            people.append((lm, mask > MASK_THRESHOLD))
        return people

    def measure(self, rgb, xyz, floor, rotate_deg, intrinsics, forward, zone, corridor, rejected) -> list[Subject]:
        from estimator import Rejection  # noqa: PLC0415

        frame = UprightFrame(rgb, xyz, rotate_deg, intrinsics)
        out, whys = [], []
        people = self.detect(frame.rgb)
        for lm, mask in people:
            subject, why = measure_person(lm, mask, frame, floor, forward, zone, corridor)
            if subject is not None:
                out.append(subject)
            else:
                whys.append(why)
                if rejected is not None:
                    rejected.append(Rejection(why.text, why.distance_m or float("nan"), 0.0, int(mask.sum()), None))
        out.sort(key=lambda s: s.distance_m)
        # Nearest unmeasured person first: that is who the hint is for.
        whys.sort(key=lambda w: w.distance_m if w.distance_m is not None else 99.0)
        self.hint = None if out or not whys else {"code": whys[0].code, "distanceM": whys[0].distance_m}
        return out


# demo-outfit can save raw frames (image + cloud) for offline re-measuring
# (body._dump there). Deliberately not ported: on a kiosk those are pictures of
# real visitors, and this sidecar stores numbers only.


class UprightFrame:
    """The left image and its point cloud turned so the floor is at the bottom.

    MediaPipe expects people upright; the 제주 mount is sideways. Everything
    measured here is in UPRIGHT pixels; `to_raw` maps back for the overlay and
    for casting rays through the lens.
    """

    def __init__(self, rgb: np.ndarray, xyz: np.ndarray, rotate_deg: int, intrinsics) -> None:
        self.k = (rotate_deg // 90) % 4
        # np.rot90 turns counter-clockwise; the display turns clockwise.
        self.rgb = np.ascontiguousarray(np.rot90(rgb, -self.k))
        self.xyz = np.rot90(xyz[..., :3], -self.k)
        self.h, self.w = self.rgb.shape[:2]
        self.fx, self.fy, self.cx, self.cy, self.raw_w, self.raw_h = intrinsics
        # Upright horizontal is the sensor's vertical when the camera is on its side.
        self.f_lateral = self.fy if self.k % 2 else self.fx
        # The principal point's upright column, and the camera axis that upright
        # +column runs along — for metric lateral positions.
        self.c_lateral = [self.cx, self.w - self.cy, self.w - self.cx, self.cy][self.k]
        self.lateral_axis = np.array([[1, 0, 0], [0, -1, 0], [-1, 0, 0], [0, 1, 0]][self.k], dtype=float)

    def to_raw(self, col: float, row: float) -> tuple[float, float]:
        """Upright pixel → raw normalised (0..1) image point, inverse of the display turn."""
        u, v = col / self.w, row / self.h
        if self.k == 1:
            return v, 1 - u
        if self.k == 2:
            return 1 - u, 1 - v
        if self.k == 3:
            return 1 - v, u
        return u, v

    def ray(self, col: float, row: float) -> np.ndarray:
        """Camera-frame direction (z = 1) through an upright pixel."""
        x, y = self.to_raw(col, row)
        return np.array([(x * self.raw_w - self.cx) / self.fx, (y * self.raw_h - self.cy) / self.fy, 1.0])


def measure_person(lm, mask, frame: UprightFrame, floor: FloorFrame, forward, zone, corridor):
    """(Subject, None) for a measurable standing person, else (None, why not)."""
    vis = lm[:, 2]
    if min(vis[L_SHOULDER], vis[R_SHOULDER], vis[L_HIP], vis[R_HIP]) < MIN_VISIBILITY:
        return None, Why("turned", "pose without both shoulders and hips — turned away or cut off")

    z = frame.xyz[..., 2]
    finite = np.isfinite(z) & np.isfinite(frame.xyz[..., 0]) & np.isfinite(frame.xyz[..., 1])
    zs = z[mask & finite]
    if zs.size < MIN_BODY_PIXELS:
        return None, Why("far", "too few depth points on the person — too far or too dark")
    body = mask & finite & (np.abs(z - np.median(zs)) < DEPTH_BAND_M)

    shoulder_row = (lm[L_SHOULDER, 1] + lm[R_SHOULDER, 1]) / 2
    hip_row = (lm[L_HIP, 1] + lm[R_HIP, 1]) / 2
    torso_len = hip_row - shoulder_row
    if torso_len < 20:
        return None, Why("far", "torso too small or not upright")

    # Where the person stands, from torso points projected onto the floor.
    torso = body.copy()
    torso[: int(shoulder_row)] = False
    torso[int(hip_row) :] = False
    if torso.sum() < MIN_BODY_PIXELS // 4:
        return None, Why("hidden", "torso hidden")
    centre = np.median(floor.floor_xy(frame.xyz[torso]), axis=0)
    distance = float(np.linalg.norm(centre))
    if not zone[0] <= distance <= zone[1]:
        return None, Why("zone", f"outside the measuring zone ({distance:.1f} m)", round(distance, 2))
    lateral = 0.0
    u, v = floor_basis(floor)
    flat = np.array([forward @ u, forward @ v])
    if np.linalg.norm(flat) > 1e-6:
        ahead = flat / np.linalg.norm(flat)
        lateral = float(ahead[0] * centre[1] - ahead[1] * centre[0])
        if abs(lateral) > corridor:
            return None, Why("side", f"off to the side ({lateral:+.2f} m)", round(distance, 2))

    crown = _crown(lm, mask, body, frame, floor, shoulder_row)
    if crown is None:
        return None, Why("nohead", "no head above the shoulders", round(distance, 2))
    height, head_px, head_in_view = crown
    ground = _local_floor(lm, mask, body, frame, floor, float(np.median(zs)))
    if ground is not None:
        height -= ground
    if not MIN_HEIGHT_M <= height <= MAX_HEIGHT_M:
        return None, Why("height", f"implausible height {height * 100:.0f} cm", round(distance, 2))

    centre_col = _centre_column(lm, shoulder_row, hip_row)
    arms = [(a, b) for a, b in ARMS if min(vis[a], vis[b]) >= MIN_VISIBILITY]
    bands = {
        "shoulder": _band(mask, body, frame, lm, centre_col, arms, shoulder_row + np.array(SHOULDER_ROWS) * torso_len, False),
        "chest": _band(mask, body, frame, lm, centre_col, arms, shoulder_row + np.array(CHEST_ROWS) * torso_len, True),
        "waist": _band(mask, body, frame, lm, centre_col, arms, shoulder_row + np.array(WAIST_ROWS) * torso_len, True),
        "hip": _band(mask, body, frame, lm, centre_col, arms, hip_row + np.array(HIP_ROWS_FROM_HIP) * torso_len, True),
    }
    # Which row of each band is the measurement, as a percentile of its widths.
    # Shoulder: near the narrow end — below the joints the outline keeps
    # widening into hanging arms in their sleeves (dev room 2026-10-22: 50 cm at
    # the joints to 58 cm a few cm lower; the widest row read 52 cm "shoulders"
    # after the seam factor). Hip: the median — the widest rows were hands and
    # a jacket's hem, the narrowest a gap between them.
    pick = {"shoulder": 25, "chest": 50, "waist": 20, "hip": 50}
    widths: dict[str, float | None] = {}
    girths: dict[str, float | None] = {}
    lines: dict[str, dict | None] = {}
    touching: list[str] = []
    for name, band in bands.items():
        if band is None:
            widths[name] = girths[name] = lines[name] = None
            continue
        if band["touching"]:
            touching.append(name)
        rows = band["rows"]
        target = np.percentile(rows[:, 1], pick[name])
        best = rows[np.argmin(np.abs(rows[:, 1] - target))]
        widths[name] = float(target)
        half = target / 2
        d = band["semi_depth"]
        girths[name] = _ellipse_perimeter(half, d) if d is not None and name != "shoulder" else None
        row, left, right = best[0], best[2], best[3]
        lines[name] = {"touching": name in touching, "cm": round(target * 100, 1), "girthCm": round(girths[name] * 100, 1) if girths[name] else None, "a": list(map(_r4, frame.to_raw(left, row))), "b": list(map(_r4, frame.to_raw(right + 1, row)))}

    shoulder = widths["shoulder"]
    if shoulder is not None and not SHOULDER_PER_HEIGHT[0] <= shoulder / height <= SHOULDER_PER_HEIGHT[1]:
        widths["shoulder"] = lines["shoulder"] = None
        shoulder = None
    for name in ("chest", "waist", "hip"):
        # Wider than the deltoids means an arm is still in the run.
        if shoulder is not None and widths[name] is not None and widths[name] > 1.05 * shoulder:
            widths[name] = girths[name] = lines[name] = None
        # Far outside a torso's share of stature is a broken band, not a body.
        if widths[name] is not None and not torso_width_plausible(widths[name], height):
            widths[name] = girths[name] = lines[name] = None

    draped = _waist_draped(bands, widths)

    clear_w = {n: (None if n in touching else v) for n, v in widths.items()}
    clear_g = {n: (None if n in touching else v) for n, v in girths.items()}
    drawing = {
        # Bands measured with an arm against the torso: used only if no frame
        # of the scan had the arms clear (Session._widths_at).
        "fallback": {
            "widths": BodyWidths(widths["shoulder"], widths["chest"], widths["waist"], widths["hip"]),
            "girths": BodyGirths(girths["chest"], girths["waist"], girths["hip"]),
        },
        "armsTouching": touching,
        # The waist outline is clothing hanging from the chest (_waist_draped);
        # None when chest or waist was not measured this frame.
        "waistDraped": draped,
        # The floor at the feet by the calibrated plane, in cm; None = feet not seen.
        "floorCm": round(ground * 100, 1) if ground is not None else None,
        "head": list(map(_r4, frame.to_raw(*head_px))),
        "headInView": head_in_view,
        "lines": lines,
        "bones": [
            [list(map(_r4, frame.to_raw(*lm[a, :2]))), list(map(_r4, frame.to_raw(*lm[b, :2])))]
            for a, b in BONES
            if min(vis[a], vis[b]) >= MIN_VISIBILITY
        ],
    }
    subject = Subject(
        height_m=height,
        points=int(body.sum()),
        distance_m=distance,
        lateral_m=lateral,
        widths=BodyWidths(clear_w["shoulder"], clear_w["chest"], clear_w["waist"], clear_w["hip"]),
        centre_xy=(float(centre[0]), float(centre[1])),
        girths=BodyGirths(clear_g["chest"], clear_g["waist"], clear_g["hip"]),
        drawing=drawing,
    )
    return subject, None


# Chest, waist and hip breadth as a share of stature. Adults run ~0.15-0.25
# (Size Korea: a slim 150 cm woman's waist ~23 cm, a heavy 170 cm man's hips
# ~44 cm); the margin either side is for coats and posture. A frame outside it
# lost part of the band: demo-outfit 2026-10-22, a 9.1 cm "waist" on a 177 cm
# visitor whose other frames read 35-37. The median would survive one such
# frame; a capture with a few of them would not.
TORSO_PER_HEIGHT = (0.12, 0.32)


def torso_width_plausible(width_m: float, height_m: float) -> bool:
    return TORSO_PER_HEIGHT[0] <= width_m / height_m <= TORSO_PER_HEIGHT[1]


def _waist_draped(bands: dict, widths: dict) -> bool | None:
    """Is the waist's outline a top hanging from the chest rather than the waist?

    A waist is narrower than the chest unless there is a belly, and a belly
    sticks out IN FRONT of the chest. Fabric hanging from the chest is as wide
    as the chest but no further forward (dev room 2026-10-22, slim visitor in
    a knit: waist 98-103 % of chest width, its front 0.5-3.2 cm ahead).
    """
    chest, waist = widths.get("chest"), widths.get("waist")
    if chest is None or waist is None or bands.get("chest") is None or bands.get("waist") is None:
        return None
    chest_front, waist_front = bands["chest"]["front_z"], bands["waist"]["front_z"]
    if chest_front is None or waist_front is None:
        return None
    return bool(waist >= DRAPE_WIDTH_SHARE * chest and chest_front - waist_front < BELLY_AHEAD_M)


def _crown(lm, mask, body, frame: UprightFrame, floor: FloorFrame, shoulder_row: float):
    """(height above floor, crown pixel, head fully in view) or None.

    The mask's top edge over the head is where the outline ends — far more
    exact than stereo points, which thin out and smear at hair. That pixel's
    ray is followed to the head's depth (the face's measured depth, plus the
    distance from face to the middle of the skull), and the 3D point's height
    above the floor plane is the visitor's height.
    """
    ears = [lm[i, 0] for i in (L_EAR, R_EAR, NOSE) if lm[i, 2] >= MIN_VISIBILITY * 0.6]
    span = abs(lm[L_SHOULDER, 0] - lm[R_SHOULDER, 0])
    if ears:
        c0, c1 = min(ears) - 0.25 * span, max(ears) + 0.25 * span
    else:
        mid = (lm[L_SHOULDER, 0] + lm[R_SHOULDER, 0]) / 2
        c0, c1 = mid - 0.3 * span, mid + 0.3 * span
    c0, c1 = max(0, int(c0)), min(frame.w, int(np.ceil(c1)))
    if c1 - c0 < 3:
        return None
    column = mask[:, c0:c1]
    rows = np.flatnonzero(column.sum(axis=1) >= 3)
    rows = rows[rows < shoulder_row]
    if rows.size == 0:
        return None
    top = int(rows[0])
    cols = np.flatnonzero(column[top])
    top_col = c0 + float(cols.mean()) + 0.5

    face = body[top : int(shoulder_row), c0:c1]
    face_z = frame.xyz[top : int(shoulder_row), c0:c1, 2][face]
    if face_z.size < 30:
        return None
    head_z = float(np.median(face_z)) + HEAD_CENTRE_BEHIND_FACE_M
    point = frame.ray(top_col, top) * head_z
    height = float(floor.heights(point[None, :])[0])
    in_view = bool(top > HEAD_EDGE_PX and lm[NOSE, 2] >= MIN_VISIBILITY)
    return height, (top_col, float(top)), in_view


def _local_floor(lm, mask, body, frame: UprightFrame, floor: FloorFrame, body_z: float) -> float | None:
    """Height of the floor under this person by the calibrated plane (0 when the
    calibration is right), or None when the feet or the floor around them are
    not seen.

    Floor points are the non-person pixels around the foot landmarks at about
    the feet's depth; the floor is the one thin layer among them (a wall or a
    chair leg spreads over heights, the floor piles into a few centimetres).
    """
    vis = lm[:, 2]
    feet = [i for i in FEET if vis[i] >= MIN_VISIBILITY and 0 <= lm[i, 1] < frame.h - HEAD_EDGE_PX]
    if not feet:
        return None
    pad = FOOT_REGION_M * frame.f_lateral / body_z
    row = float(lm[feet, 1].max())
    r0, r1 = max(0, int(row - pad)), min(frame.h, int(row + pad) + 1)
    c0, c1 = max(0, int(lm[feet, 0].min() - pad)), min(frame.w, int(lm[feet, 0].max() + pad) + 1)
    if r1 <= r0 or c1 <= c0:
        return None
    z = frame.xyz[r0:r1, c0:c1, 2]
    feet_z = z[body[r0:r1, c0:c1]]
    # MediaPipe places feet it cannot see; the mask must actually have them.
    if feet_z.size < 30:
        return None
    z_feet = float(np.median(feet_z))

    # The mask's soft edge and the shoes' shadow are not floor.
    person = mask[r0:r1, c0:c1].copy()
    for _ in range(3):
        person[1:] |= person[:-1]
        person[:-1] |= person[1:]
        person[:, 1:] |= person[:, :-1]
        person[:, :-1] |= person[:, 1:]
    points = frame.xyz[r0:r1, c0:c1]
    ok = ~person & np.isfinite(points).all(axis=-1) & (np.abs(z - z_feet) < FLOOR_NEAR_FEET_M)
    if ok.sum() < MIN_LOCAL_FLOOR_POINTS:
        return None
    heights = floor.heights(points[ok].astype(np.float64))
    bins = np.floor(heights / 0.02)
    values, counts = np.unique(bins, return_counts=True)
    mode = (values[np.argmax(counts)] + 0.5) * 0.02
    layer = heights[np.abs(heights - mode) < FLOOR_LAYER_M]
    if layer.size < MIN_LOCAL_FLOOR_POINTS:
        return None
    return float(np.median(layer))


def _centre_column(lm, shoulder_row, hip_row):
    top = (lm[L_SHOULDER, 0] + lm[R_SHOULDER, 0]) / 2
    bottom = (lm[L_HIP, 0] + lm[R_HIP, 0]) / 2

    def at(row: float) -> float:
        t = (row - shoulder_row) / max(hip_row - shoulder_row, 1e-6)
        return top + (bottom - top) * float(np.clip(t, -0.5, 1.5))

    return at


def _arm_columns(lm, arms, row: float) -> list[float]:
    xs = []
    for a, b in arms:
        (xa, ya), (xb, yb) = lm[a, :2], lm[b, :2]
        if b in (L_WRIST, R_WRIST):  # forearm runs on through the hand
            xb, yb = xb + HAND_PER_FOREARM * (xb - xa), yb + HAND_PER_FOREARM * (yb - ya)
        if min(ya, yb) <= row <= max(ya, yb) and abs(yb - ya) > 1e-6:
            xs.append(xa + (xb - xa) * (row - ya) / (yb - ya))
    return xs


def runs(row_mask: np.ndarray, bridge: int = BRIDGE_PX) -> list[tuple[int, int]]:
    """Contiguous True stretches (inclusive), bridging gaps up to `bridge` pixels."""
    idx = np.flatnonzero(row_mask)
    if idx.size == 0:
        return []
    breaks = np.flatnonzero(np.diff(idx) > bridge + 1)
    return [(int(g[0]), int(g[-1])) for g in np.split(idx, breaks + 1)]


def torso_run(row_runs, centre: float, arm_cols, arm_half_px: float):
    """The run around the body's centre line, with any arm beside it cut off."""
    if not row_runs:
        return None
    left, right = min(row_runs, key=lambda r: 0.0 if r[0] <= centre <= r[1] else min(abs(r[0] - centre), abs(r[1] - centre)))
    if not left <= centre <= right:
        return None
    for xa in arm_cols:
        if left < xa < right:
            if xa > centre and xa - centre > ARM_OUTER_SHARE * (right - centre):
                right = min(right, int(xa - arm_half_px))
            elif xa < centre and centre - xa > ARM_OUTER_SHARE * (centre - left):
                left = max(left, int(np.ceil(xa + arm_half_px)))
    return (left, right) if right > left else None


def depth_arm_edges(z_row, body_row, left: int, right: int, centre: float, px_per_m: float):
    """(left, right) torso edges where an arm joins the outline, found in depth;
    None on a side where depth shows no arm (the outline's own edge stands)."""
    cols = np.flatnonzero(body_row[left : right + 1] & np.isfinite(z_row[left : right + 1])) + left
    if cols.size < 10:
        return None, None
    # Median of a few samples: single-pixel stereo noise makes no crease.
    k = ARM_DEPTH_SMOOTH_PX
    padded = np.pad(z_row[cols], k // 2, mode="edge")
    zs = np.median(np.lib.stride_tricks.sliding_window_view(padded, k), axis=1)
    arm_px = ARM_MIN_WIDTH_M * px_per_m

    def find(order: np.ndarray, outer: int) -> int | None:
        c = cols[order]
        zz = zs[order]
        for i in range(1, len(c) - 1):
            if abs(c[i] - centre) < ARM_DEPTH_SEARCH_FROM * abs(outer - centre):
                continue
            if abs(outer - c[i]) + 1 < arm_px:
                break  # no room for an arm beyond here
            if zz[i] < zz[i - 1] or zz[i] < zz[i + 1]:
                continue  # not a crease
            beyond = zz[i + 1 :][np.abs(c[i + 1 :] - c[i]) <= arm_px]
            if beyond.size and zz[i] - beyond.min() >= ARM_FORWARD_M:
                # The crease belongs to neither; the torso ends just inside it.
                return int(c[i - 1])
        return None

    right_side = np.flatnonzero(cols >= centre)
    left_side = np.flatnonzero(cols <= centre)[::-1]
    return find(left_side, left), find(right_side, right)


def fit_semi_depth(s: np.ndarray, z: np.ndarray) -> tuple[float, float] | None:
    """Least-squares (zc, d) for z = zc − d·√(1 − s²): the front half of an
    ellipse seen head-on, s = −1..1 across its width. zc is the depth of the
    ellipse's centre — where its outline is — and d its semi-depth."""
    keep = np.abs(s) < ELLIPSE_FIT_SPAN
    if keep.sum() < 30:
        return None
    a = np.stack([np.ones(int(keep.sum())), -np.sqrt(1 - s[keep] ** 2)], axis=1)
    (zc, d), *_ = np.linalg.lstsq(a, z[keep], rcond=None)
    return float(zc), float(d)


def _band(mask, body, frame: UprightFrame, lm, centre_at, arms, row_range, cut_arms: bool):
    lo, hi = int(max(0, row_range[0])), int(min(frame.h - 1, row_range[1]))
    if hi <= lo:
        return None
    z = frame.xyz[..., 2]
    spans = []
    for row in range(lo, hi + 1):
        centre = centre_at(row)
        front = z[row][body[row]]
        if front.size < 5:
            continue
        px_per_m = frame.f_lateral / float(np.median(front))
        arm_half = ARM_HALF_WIDTH_M * px_per_m
        row_runs = runs(mask[row])
        run = torso_run(row_runs, centre, _arm_columns(lm, arms, row) if cut_arms else [], arm_half)
        if run is not None:
            whole = torso_run(row_runs, centre, [], arm_half)
            left, right = run
            guessed = whole != run
            if cut_arms:
                # Where depth shows the arm, that edge is measured, not guessed.
                d_left, d_right = depth_arm_edges(z[row], body[row], whole[0], whole[1], centre, px_per_m)
                left = d_left if d_left is not None else left
                right = d_right if d_right is not None else right
                guessed = (d_left is None and left != whole[0]) or (d_right is None and right != whole[1])
            if right > left:
                spans.append((row, left, right, guessed))
    if len(spans) < 3:
        return None
    cut_share = sum(span[3] for span in spans) / len(spans)
    spans = [span[:3] for span in spans]

    # Depth profile across the band → this body's semi-depth, and the depth of
    # its outline (the widest section of an ellipse is at its centre's depth).
    # Lateral positions are real metres from the point cloud, so perspective
    # does not bend the profile.
    z_front = float(np.median([np.median(z[row, left : right + 1][body[row, left : right + 1]]) for row, left, right in spans]))
    centre_z = z_front + SIDE_DEPTH_FALLBACK_M
    semi_depth = None
    for _ in range(2):
        s_all, z_all = [], []
        for row, left, right in spans:
            ok = body[row, left : right + 1]
            lat_left = (left - frame.c_lateral) * centre_z / frame.f_lateral
            lat_right = (right + 1 - frame.c_lateral) * centre_z / frame.f_lateral
            mid, half = (lat_left + lat_right) / 2, (lat_right - lat_left) / 2
            lateral = frame.xyz[row, left : right + 1][ok] @ frame.lateral_axis
            s_all.append((lateral - mid) / half)
            z_all.append(z[row, left : right + 1][ok])
        s_all, z_all = np.concatenate(s_all), np.concatenate(z_all)
        fit = fit_semi_depth(np.clip(s_all, -1, 1), z_all)
        if fit is None:
            break
        zc, d = fit
        half_typical = float(np.median([right + 1 - left for _, left, right in spans])) / 2 * zc / frame.f_lateral
        if not DEPTH_FIT_SANE[0] * half_typical <= d <= DEPTH_FIT_SANE[1] * half_typical:
            semi_depth = None
            break
        d = float(np.clip(d, DEPTH_PER_HALF_WIDTH[0] * half_typical, DEPTH_PER_HALF_WIDTH[1] * half_typical))
        # The outline is at the centre's depth: the front plus the semi-depth.
        centre_z, semi_depth = zc - (fit[1] - d), d

    rows = np.array([[row, (right + 1 - left) * centre_z / frame.f_lateral, left, right] for row, left, right in spans])
    # How far forward the band's front is: the nearest tenth of its middle third.
    fronts = []
    for row, left, right in spans:
        third = (right - left) // 3
        zz = z[row, left + third : right - third + 1][body[row, left + third : right - third + 1]]
        if zz.size:
            fronts.append(float(np.percentile(zz, 10)))
    front_z = float(np.median(fronts)) if fronts else None
    return {"rows": rows, "semi_depth": semi_depth, "touching": cut_share > CUT_SHARE_TOUCHING, "front_z": front_z}


def _ellipse_perimeter(a: float, b: float) -> float:
    """Ramanujan's approximation; error < 0.01 % for body-like ellipses."""
    h = ((a - b) / (a + b)) ** 2
    return float(np.pi * (a + b) * (1 + 3 * h / (10 + np.sqrt(4 - 3 * h))))


def _r4(v: float) -> float:
    return round(float(v), 4)


def summarise_girths(frames: list[BodyGirths], min_frames: int = 5) -> dict[str, float | None]:
    out = {}
    for key, field in (("chestGirthCm", "chest_m"), ("waistGirthCm", "waist_m"), ("hipGirthCm", "hip_m")):
        values = [getattr(f, field) for f in frames if f is not None and getattr(f, field) is not None]
        out[key] = round(float(np.median(values)) * 100.0, 1) if len(values) >= min_frames else None
    return out
