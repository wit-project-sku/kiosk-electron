"""
제주 visitor-height sidecar — the process the kiosk app supervises.

Speaks newline-delimited JSON on stdin/stdout and writes nothing else there;
diagnostics go to stderr, which the Electron side pipes into its own logger (see
ZedSidecarManager). It renders nothing, streams no frames, and never touches the
photo camera — the ZED is a second, separate device whose only job is measuring.

  stdin   {"cmd":"start"}       begin sampling (the app sends this when the
                                camera screen opens, not when the countdown
                                starts — see the note on the window below)
          {"cmd":"stop"}        end sampling and report
          {"cmd":"calibrate"}   refit the floor, with nobody in frame
          {"cmd":"ping"}

  stdout  {"type":"ready","calibrated":true,"cameraHeightM":1.42}
          {"type":"result","heightCm":171.4,"confidence":0.86,"samples":184,
           "subjects":1,"reason":null}
          {"type":"calibrated","cameraHeightM":1.42}
          {"type":"error","message":"..."}

── The measurement window ─────────────────────────────────────────────────
Sampling covers the whole time the camera screen is up, not just the countdown.
제주 arms a 손동작 게이트 first (PhotoGestureGate 'waiting'), so the visitor is
already standing in position, posing, before the 10 seconds even begin — call it
15-30 s of frames rather than 10. That length is what lets `summarise` take a
median and stop caring about individual bad frames.

Standalone use, which needs no Electron at all:

    python main.py --calibrate    # once, with nobody in front of the camera
    python main.py --selftest     # stand in front of it and watch the numbers
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, deque
import os
import queue
import sys
import threading
import time
from pathlib import Path

import numpy as np

# Windows gives a Python process a cp1252 console by default, and this file —
# like the rest of the codebase — has 제주 and 손동작 in its diagnostics. Writing
# one of those to an un-reconfigured stderr raises UnicodeEncodeError and kills
# the sidecar, which the app would see only as an unexplained restart loop.
# `emit` is safe either way (json.dumps escapes to ASCII); `log` is not.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):  # pragma: no cover — already UTF-8, or piped
        pass

from estimator import Rejection, Subject, find_subjects, summarise
from widths import BodyWidths, summarise_widths
from geometry import (
    FloorFrame,
    camera_is_above,
    finite_points,
    fit_floor,
    fit_plane_ransac,
    orient_up,
    plane_is_plausible_floor,
)
from zed import MEASURE_HEIGHT, MEASURE_WIDTH, OPTICAL_AXIS, ZedCamera, ZedUnavailable
from overlay import display_rotation
from scene import BACKGROUND_FRAMES, Background, heads_in_view, without_objects
from body import BodyGirths, PoseMeasurer, PoseUnavailable, summarise_girths


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ[name])
    except (KeyError, ValueError):
        return default


# Frames per second to sample at. Not the camera's rate — just how often we do
# the arithmetic.
#
# ── Why this is low, and why that is the right trade ───────────────────────
# What the median needs is not a high rate, it is enough samples and enough
# points per sample. Those pull in opposite directions: a bigger point cloud
# costs frame time. Measured end to end (grab + estimate) on an RTX 4060:
#
#   640x360    18.6 fps   371 samples/20 s   ~35 pts on a head slab at 2.8 m
#   960x540     8.0 fps   160 samples/20 s   ~60 pts
#   1280x720    4.6 fps    91 samples/20 s  ~110 pts
#
# 제주 visitors stand at ~2.7 m, and ~35 points per slab is where the estimate
# started swinging 142-216 cm on a 179 cm person. Every row gives far more
# samples than a median needs, so the cloud wins and the rate loses: zed.py
# retrieves 1280x720 and this paces slower to match, leaving the machine idle
# between frames rather than pinning a core for the whole capture.
FPS = _env_float("HEIGHT_FPS", 4.0)

# The standing zone, as radial distance across the floor from the camera's own
# ground position. Anything nearer is someone reaching for the touch screen;
# anything further is the concourse.
ZONE_MIN_M = _env_float("HEIGHT_ZONE_MIN", 0.8)
ZONE_MAX_M = _env_float("HEIGHT_ZONE_MAX", 3.5)

# Half-width of the corridor straight in front of the lens, along the floor.
# A visitor standing for the photo is centred within ~0.3 m; 0.5 m leaves room
# to shift weight. Anyone wider is beside the visitor, not being photographed.
CORRIDOR_M = _env_float("HEIGHT_CORRIDOR", 0.5)

# Per-frame estimates on stderr while sampling, for watching a test live. The app
# turns this on in development only (ZedSidecarManager) — at 4 fps it would
# otherwise fill a kiosk's log files with one line per frame of every capture.
VERBOSE = os.environ.get("HEIGHT_VERBOSE") == "1"

# Reported with every result and stored with every row, so measurements from an
# estimator later found to be wrong can be told apart and discarded.
#   1  (unversioned) — calibration could be upside down or on a desk
#   2  signed mount check + fit_floor
#   3  people far behind the visitor ignored; plateau instead of median
#   4  only the person in the corridor in front of the lens
#   5  shoulder/chest/waist/hip widths
#   6  a visitor beside an object is split from it; shoulder plausibility bound
#   7  pose path (body.py, from demo-outfit): MediaPipe skeleton + mask on the
#      left image, widths at the visitor's own anatomy, girths, floor taken at
#      the feet; static objects learned at calibration; cut-off heads dropped
ALGORITHM_VERSION = 7

CALIBRATION_PATH = Path(os.environ.get("HEIGHT_CALIBRATION", "calibration.json"))
# Furniture learned from the empty room, next to the calibration (scene.py).
BACKGROUND_PATH = CALIBRATION_PATH.with_name("background.json")
# The floor at visitors' feet relative to the calibration (Measurer._learned_floor),
# kept across restarts and dropped when the calibration changes.
FEET_FLOOR_PATH = CALIBRATION_PATH.with_name("feet_floor.json")

# Frames averaged when fitting the floor. A single frame's plane fit is fine;
# several and a median make it boring, which is what a once-per-installation
# calibration should be.
CALIBRATION_FRAMES = 12


def _json_default(value):
    # numpy scalars and arrays reach payloads easily (a `bool_` from a numpy
    # comparison crashed the demo sidecar on every frame with a person in it).
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    return str(value)


def emit(**payload) -> None:
    """One NDJSON event on stdout. The ONLY thing that may write there."""
    sys.stdout.write(json.dumps(payload, separators=(",", ":"), default=_json_default) + "\n")
    sys.stdout.flush()


def log(message: str) -> None:
    sys.stderr.write(message + "\n")
    sys.stderr.flush()


# ── Calibration ────────────────────────────────────────────────────────────


def calibrate(camera: ZedCamera) -> FloorFrame:
    """Fit the floor from the current view. Nobody should be standing in it.

    Deliberately a deliberate act — a command, not something that quietly
    re-runs at every boot. A kiosk boots with people in front of it, and a floor
    silently refitted onto someone's shoulders would shift every height that day
    with nothing to show for it. Calibrate at install, and again only if the
    camera is moved.
    """
    fits: list[FloorFrame] = []
    gravity: np.ndarray | None = None

    for _ in range(CALIBRATION_FRAMES * 3):
        if len(fits) >= CALIBRATION_FRAMES:
            break
        frame = camera.grab()
        if frame is None:
            continue
        points = finite_points(frame.points)
        if len(points) < 1000:
            continue
        if frame.gravity is not None:
            gravity = frame.gravity
        if gravity is not None:
            # The lowest strong horizontal layer along gravity — RANSAC picks
            # the desk in a furnished room. See fit_floor.
            candidate = fit_floor(points, gravity)
            if candidate is None:
                continue
        else:
            fit = fit_plane_ransac(points, gravity=None)
            if fit is None:
                continue
            candidate = orient_up(*fit)
        if not plane_is_plausible_floor(candidate, gravity):
            continue
        # Level and gravity-aligned, but above the camera: a ceiling.
        if not camera_is_above(candidate):
            continue
        fits.append(candidate)

    if not fits:
        raise ZedUnavailable(
            "Could not fit a floor plane. Check that the floor is visible and "
            "that nobody is standing in front of the camera."
        )

    normals = np.stack([f.normal for f in fits])
    normal = normals.mean(axis=0)
    normal /= np.linalg.norm(normal)
    return FloorFrame(normal=normal, offset=float(np.median([f.offset for f in fits])))


# A tape reading further than this from the fit means the fit found some other
# surface (or the tape was read wrong) — not stereo bias, which is a few cm.
MAX_PIN_CORRECTION_M = 0.10


def pin_camera_height(fitted: FloorFrame, measured_m: float) -> FloorFrame:
    """Replace the fitted camera height with a tape-measured one.

    The fit gets the floor's ANGLE right — thousands of points agree on it — but
    its HEIGHT carries the stereo depth bias on a floor seen at a grazing angle.
    On the dev PC, 2026-10-08, it fitted 1.163 m against a taped 1.19 m, and
    every visitor read 2.7 cm short by exactly that. The tape is the truth.
    """
    correction = measured_m - fitted.offset
    if abs(correction) > MAX_PIN_CORRECTION_M:
        raise ZedUnavailable(
            f"Tape says {measured_m:.2f} m but the floor was fitted at "
            f"{fitted.offset:.2f} m. A gap that large means the fit found "
            "something other than the floor. Clear the view and recalibrate, "
            "or re-check the tape."
        )
    log(f"  camera height pinned to {measured_m:.3f} m (fit said {fitted.offset:.3f} m, "
        f"correction {correction * 100:+.1f} cm)")
    return FloorFrame(normal=fitted.normal, offset=measured_m)


def save_calibration(frame: FloorFrame) -> None:
    CALIBRATION_PATH.parent.mkdir(parents=True, exist_ok=True)
    CALIBRATION_PATH.write_text(json.dumps(frame.to_json(), indent=2), encoding="utf-8")


def load_calibration() -> FloorFrame | None:
    if not CALIBRATION_PATH.exists():
        return None
    try:
        return FloorFrame.from_json(json.loads(CALIBRATION_PATH.read_text(encoding="utf-8")))
    except (ValueError, KeyError) as exc:
        log(f"calibration file unreadable ({exc}); recalibrate")
        return None


# ── Sampling ───────────────────────────────────────────────────────────────


# How far behind the nearest person someone may stand and still count as part of
# the capture. Two visitors in a 같이찍기 stand side by side, within a few tens of
# cm of each other; anyone a metre further back is the room. Dev PC, 2026-10-08:
# a ~130 cm shape 2.2 m away turned every frame with the visitor (at 1.1 m) into
# "2 people" and threw it away. At an airport that is every passer-by.
SAME_GROUP_M = 0.6


def in_front(subjects: list[Subject]) -> list[Subject]:
    """The people being photographed: the nearest subject and anyone beside them."""
    if not subjects:
        return subjects
    nearest = min(s.distance_m for s in subjects)
    return [s for s in subjects if s.distance_m - nearest <= SAME_GROUP_M]


class Session:
    """One capture's worth of per-frame estimates."""

    def __init__(self) -> None:
        self.heights: list[float] = []
        # Widths per single-visitor frame, parallel to `heights`.
        self.widths: list[BodyWidths | None] = []
        self.girths: list[BodyGirths | None] = []
        # Pose path: the same frame's bands including arm-against-torso ones.
        self.fallback: list[dict | None] = []
        # Pose path: whether the waist outline was clothing hanging from the
        # chest (body._waist_draped), parallel to `heights`; None = not judged.
        self.draped: list[bool | None] = []
        # Pose path: the floor at the visitor's feet by the calibrated plane (cm).
        self.floor_cm: list[float] = []
        self.method = "cloud"
        self.subject_counts: list[int] = []
        # Why clusters were turned down, tallied across the capture. Without
        # this a null result says only "nobody in the measurement zone", which
        # is equally true when nobody was there and when the visitor was
        # standing right in front of the camera and got filtered out. The
        # difference matters enormously and is invisible from the app side —
        # `--diagnose` can only be run by hand, on a camera the app is not
        # using at the time.
        self.rejections: Counter[str] = Counter()

    def add(self, subjects: list[Subject], rejected: list[Rejection] | None = None) -> None:
        subjects = in_front(subjects)
        self.subject_counts.append(len(subjects))
        if len(subjects) == 1:
            self.heights.append(subjects[0].height_m)
            self.widths.append(subjects[0].widths)
            self.girths.append(subjects[0].girths)
            self.fallback.append(subjects[0].drawing["fallback"] if subjects[0].drawing else None)
            self.draped.append(subjects[0].drawing.get("waistDraped") if subjects[0].drawing else None)
            if subjects[0].drawing:
                self.method = "pose"
                if subjects[0].drawing.get("floorCm") is not None:
                    self.floor_cm.append(subjects[0].drawing["floorCm"])
        for r in rejected or ():
            self.rejections[r.reason] += 1

    def result(self) -> dict:
        """What the app gets. A height only when it means something.

        A 같이찍기 (together) capture puts two or more people in the zone, and
        "the visitor's height" stops being a well-defined thing. Rather than
        guess which one is the subject, the count is reported and the height is
        null — the analytics are better off with a smaller, honest dataset.

        The count is the commonest among frames where SOMEONE was in front, not
        among all frames. The window opens as the visitor walks up, and on the
        way in they merge with the wall or the counter, stand off to the side,
        or read as furniture; most frames can be empty with nobody absent. Dev
        PC 2026-10-28: 168-170 cm in 14 of 41 frames, 26 empty — a mode over
        all frames said "nobody" and threw the visitor away. Too little evidence
        is still caught, by summarise() (5 frames, 3 of them agreeing).
        """
        if not self.subject_counts:
            return _empty("no frames sampled")

        seen = [c for c in self.subject_counts if c > 0]
        if not seen:
            return _empty(self._why_nobody(), subjects=0)
        subjects = int(np.bincount(seen).argmax())
        if subjects > 1:
            return _empty("more than one visitor in frame", subjects=subjects)

        summary = summarise(self.heights)
        if summary is None:
            return _empty("too few usable frames", subjects=1)

        height_cm, confidence = summary
        floor_cm = round(float(np.median(self.floor_cm)), 1) if self.floor_cm else None
        if floor_cm is not None and abs(floor_cm) > FLOOR_DRIFT_WARN_CM:
            log(f"the floor at the visitor's feet is {floor_cm:+.1f} cm off the calibration — "
                "heights use the feet, but recalibrate (camera moved or the fit found a desk)")
        return {
            "type": "result",
            "heightCm": round(height_cm, 1),
            **self._widths_at(height_cm / 100.0),
            "confidence": round(confidence, 3),
            "samples": len(self.heights),
            "subjects": 1,
            "reason": None,
            "version": ALGORITHM_VERSION,
            "method": self.method,
            "floorAtFeetCm": floor_cm,
        }

    def _widths_at(self, height_m: float) -> dict:
        """Widths from the frames where the visitor stood at their measured height.

        Leaning toward the screen or walking in changes the body's shape in the
        cloud as well as its height; those frames' widths are not the visitor's.
        """
        standing = [
            i for i, h in enumerate(self.heights) if abs(h - height_m) <= STANDING_TOLERANCE_M
        ]
        clear = {
            **summarise_widths([self.widths[i] for i in standing if self.widths[i] is not None]),
            **summarise_girths([self.girths[i] for i in standing]),
        }
        # A value only frames with an arm against the torso could give is a
        # landmark guess; better than nothing, marked so the app can tell.
        loose = [self.fallback[i] for i in standing if self.fallback[i] is not None]
        guessed = {
            **summarise_widths([f["widths"] for f in loose]),
            **summarise_girths([f["girths"] for f in loose]),
        }
        out = {k: v if v is not None else guessed.get(k) for k, v in clear.items()}
        out["armsTouching"] = sorted(k for k, v in clear.items() if v is None and guessed.get(k) is not None)
        judged = [self.draped[i] for i in standing if self.draped[i] is not None]
        out["waistDraped"] = bool(judged) and sum(judged) > len(judged) / 2
        return out


    def _why_nobody(self) -> str:
        """The most useful sentence available when no visitor was counted.

        A bare "nobody in the measurement zone" is the same message whether the
        zone was empty or the visitor was rejected by a filter, and only one of
        those is a bug. If anything WAS seen and turned down, say what and why.
        """
        if not self.rejections:
            return "nobody in the measurement zone"
        reason, hits = self.rejections.most_common(1)[0]
        return f"nobody counted; {hits} clusters rejected, mostly: {reason}"


def _widths_text(w: BodyWidths | None) -> str:
    if w is None:
        return ""
    cm = lambda v: f"{v * 100:4.1f}" if v is not None else "  --"  # noqa: E731
    return f"  | shoulder {cm(w.shoulder_m)} chest {cm(w.chest_m)} waist {cm(w.waist_m)} hip {cm(w.hip_m)}"


def log_frame(session: Session, subjects: list[Subject], rejected: list[Rejection]) -> None:
    """One line per sampled frame: this frame's estimate and the running median."""
    n = len(session.subject_counts)
    subjects = in_front(subjects)
    if len(subjects) == 1:
        s = subjects[0]
        summary = summarise(session.heights)
        running = f"median {summary[0]:5.1f} cm (conf {summary[1]:.2f})" if summary else "median --"
        log(
            f"#{n:<3} {s.height_m * 100:5.1f} cm  at {s.distance_m:.2f} m, "
            f"{s.lateral_m:+.2f} m sideways  | {running}{_widths_text(s.widths)}"
        )
    elif subjects:
        log(f"#{n:<3} {len(subjects)} people in the zone, not measured")
    elif rejected:
        log(f"#{n:<3} nobody counted: {rejected[0].reason}")
    else:
        log(f"#{n:<3} nobody in the zone")


# Stereo bias on the floor is a few cm; more means the calibration is stale.
FLOOR_DRIFT_WARN_CM = 5.0
# Frames with feet in view that correct frames without (Measurer._learned_floor).
FEET_FLOOR_FRAMES = 40
FEET_FLOOR_MIN_FRAMES = 5
FEET_FLOOR_SAVE_EVERY = 10

# A frame counts as "standing" for widths within this of the final height.
STANDING_TOLERANCE_M = 0.03


def _empty(reason: str, subjects: int = 0) -> dict:
    return {
        "type": "result",
        "heightCm": None,
        **summarise_widths([]),
        "confidence": 0.0,
        "samples": 0,
        "subjects": subjects,
        "reason": reason,
        "version": ALGORITHM_VERSION,
    }


def measure(
    frame_points: np.ndarray,
    floor: FloorFrame,
    rejections: list[Rejection] | None = None,
) -> list[Subject]:
    points = finite_points(frame_points)
    if len(points) < 500:
        return []
    return find_subjects(
        floor,
        points,
        ZONE_MIN_M,
        ZONE_MAX_M,
        rejections=rejections,
        forward=OPTICAL_AXIS,
        corridor_m=CORRIDOR_M,
    )


# ── Modes ──────────────────────────────────────────────────────────────────


def _stdin_reader(commands: queue.Queue) -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            commands.put(json.loads(line))
        except ValueError:
            log(f"ignoring unparseable command: {line[:120]}")
    commands.put({"cmd": "__eof__"})


def calibration_matches_mount(camera: ZedCamera, floor: FloorFrame) -> bool:
    """Is the saved floor still the floor, given where the camera is NOW?

    A calibration describes the floor in CAMERA coordinates, so it is only valid
    for the orientation it was taken in. Re-mount the camera — even just turning
    it 90° on its bracket, which 제주 does — and the stored plane goes on
    describing a surface that is now vertical. Nothing then looks like a person
    and every capture reports null, with nothing to say why.

    The IMU settles it in one frame: the stored normal must still agree with
    gravity. Cheap, and it converts a silent dead feature into a line in the log
    that names the fix.
    """
    for _ in range(10):
        frame = camera.grab()
        if frame is None or frame.gravity is None:
            continue
        return plane_is_plausible_floor(floor, frame.gravity)
    return True  # no IMU reading — cannot judge, so do not block


class Measurer:
    """Measures point clouds on its own thread.

    A 1280x720 cloud plus a pose pass takes a few hundred ms. On a thread the
    grab loop keeps reading commands promptly — a `stop` is answered at once,
    not after the frame in flight — and measuring keeps its own pace (at most
    FPS, fewer if the machine is slow).

    The left image is only ever held in memory for the pose model. It is never
    written, sent or logged: the kiosk stores numbers, not pictures.
    """

    def __init__(self, intrinsics, background: Background, feet_floor_path: Path = FEET_FLOOR_PATH) -> None:
        self.background = background
        self._feet_floor_path = feet_floor_path
        self._feet_floor_unsaved = 0
        # Built on the worker thread (MediaPipe objects stay on one thread).
        self._pose: PoseMeasurer | None = None
        self.pose_ready = threading.Event()
        self.pose_error: str | None = None
        self.lock = threading.Lock()
        self.session: Session | None = None  # guarded by lock
        self.busy = False
        self._intrinsics = intrinsics
        self._job = None
        self._wake = threading.Event()
        # Pose path: where the floor at visitors' feet was by the calibration (m),
        # over the last frames that saw feet, and the calibration they belong to.
        self._feet_floor: deque[float] = deque(maxlen=FEET_FLOOR_FRAMES)
        self._feet_floor_of: tuple | None = None
        threading.Thread(target=self._run, daemon=True).start()

    def _learned_floor(self, floor: FloorFrame) -> tuple[FloorFrame, float]:
        """The calibrated floor moved to where visitors' feet put it, and by how much.

        A frame with the feet in view measures from the floor beside them
        (body._local_floor). One without — a visitor close enough that the
        picture cuts at the knees — has only the calibration, and a calibration
        that found a desk is off by tens of cm. The feet seen in earlier frames
        say by how much, so those frames are corrected too.
        """
        key = [round(float(x), 6) for x in (*floor.normal, floor.offset)]
        if key != self._feet_floor_of:  # first frame, or recalibrated
            self._feet_floor.clear()
            self._feet_floor.extend(self._load_feet_floor(key))
            self._feet_floor_of = key
            self._feet_floor_unsaved = 0
        if len(self._feet_floor) < FEET_FLOOR_MIN_FRAMES:
            return floor, 0.0
        bias = float(np.median(self._feet_floor))
        return FloorFrame(normal=floor.normal, offset=floor.offset - bias), bias

    def _learn_feet_floor(self, floor_m: float) -> None:
        self._feet_floor.append(floor_m)
        self._feet_floor_unsaved += 1
        if self._feet_floor_unsaved >= FEET_FLOOR_SAVE_EVERY:
            self._save_feet_floor()

    def _load_feet_floor(self, key: list[float]) -> list[float]:
        """Saved samples for THIS calibration; a file from an older one is ignored."""
        try:
            data = json.loads(self._feet_floor_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return []
        if data.get("calibration") != key:
            return []
        samples = [float(v) for v in data.get("samples", []) if isinstance(v, (int, float))]
        if samples:
            log(f"floor at visitors' feet: {np.median(samples) * 100:+.1f} cm off the calibration "
                f"({len(samples)} saved frames)")
        return samples[-FEET_FLOOR_FRAMES:]

    def _save_feet_floor(self) -> None:
        """Temp file + rename, so a crash mid-write leaves the old file."""
        self._feet_floor_unsaved = 0
        tmp = self._feet_floor_path.with_suffix(".tmp")
        try:
            tmp.write_text(
                json.dumps({"calibration": self._feet_floor_of, "samples": list(self._feet_floor)}),
                encoding="utf-8",
            )
            os.replace(tmp, self._feet_floor_path)
        except OSError as exc:
            log(f"could not save the feet floor ({exc})")

    @property
    def wants_image(self) -> bool:
        return self._pose is not None

    def submit(self, points: np.ndarray, image: np.ndarray | None, floor: FloorFrame) -> bool:
        """Hand over a cloud (and its left image) unless one is still being
        measured. The SDK reuses its buffers on the next grab, hence the copy."""
        if self.busy:
            return False
        self.busy = True
        self._job = (np.array(points, copy=True), image, floor)
        self._wake.set()
        return True

    def _run(self) -> None:
        try:
            self._pose = PoseMeasurer()
            log("pose measurement on (MediaPipe)")
        except PoseUnavailable as exc:
            self.pose_error = str(exc)
            log(f"pose measurement off, using the point-cloud estimator: {exc}")
        self.pose_ready.set()
        while True:
            self._wake.wait()
            self._wake.clear()
            points, image, floor = self._job
            try:
                rejected: list[Rejection] = []
                if self._pose is not None and image is not None and self._intrinsics is not None:
                    floor, bias = self._learned_floor(floor)
                    people = self._pose.measure(
                        image, points, floor, display_rotation(floor), self._intrinsics,
                        OPTICAL_AXIS, (ZONE_MIN_M, ZONE_MAX_M), CORRIDOR_M, rejected,
                    )
                    for s in people:
                        if s.drawing and s.drawing.get("floorCm") is not None:
                            # Relative to the saved calibration, not the learned one.
                            s.drawing["floorCm"] = round(bias * 100 + s.drawing["floorCm"], 1)
                            self._learn_feet_floor(s.drawing["floorCm"] / 100)
                else:
                    people = without_objects(measure(points, floor, rejected), self.background, rejected)
                # A crown at the picture's edge is the edge, not a head.
                measured = heads_in_view(people, floor, self._intrinsics, rejected)
                with self.lock:
                    if self.session is not None:
                        self.session.add(measured, rejected)
                        if VERBOSE:
                            log_frame(self.session, measured, rejected)
            except Exception as exc:  # never let one bad frame kill the thread
                log(f"measure failed: {exc}")
            finally:
                self.busy = False


def learn_background(camera: ZedCamera, floor: FloorFrame, background: Background) -> int:
    """Measure the EMPTY room and remember whatever looks like a person in it."""
    frames: list[list[Subject]] = []
    for _ in range(BACKGROUND_FRAMES * 3):
        if len(frames) >= BACKGROUND_FRAMES:
            break
        frame = camera.grab()
        if frame is not None:
            frames.append(measure(frame.points, floor))
    objects = background.learn(frames)
    log(f"learned {objects} static object(s) in the empty room")
    return objects


def run_service(camera: ZedCamera) -> int:
    floor = load_calibration()
    if floor is not None and not calibration_matches_mount(camera, floor):
        log(
            "calibration does not match how the camera is mounted now — it was "
            "taken at a different orientation. Nothing will be measured until "
            "you recalibrate. Run: npm run height:calibrate"
        )
        floor = None
    emit(
        type="ready",
        calibrated=floor is not None,
        cameraHeightM=round(floor.offset, 3) if floor else None,
    )
    if floor is None:
        log("no calibration on disk — send {\"cmd\":\"calibrate\"} or run --calibrate")

    commands: queue.Queue = queue.Queue()
    threading.Thread(target=_stdin_reader, args=(commands,), daemon=True).start()

    try:
        intrinsics = camera.intrinsics()
    except Exception as exc:  # SDK version differences: point-cloud path only
        log(f"no lens intrinsics, pose measurement disabled: {exc}")
        intrinsics = None
    background = Background(BACKGROUND_PATH)
    measurer = Measurer(intrinsics, background)
    next_grab = next_measure = time.monotonic()

    while True:
        try:
            command = commands.get_nowait()
        except queue.Empty:
            command = None

        if command is not None:
            name = command.get("cmd")
            if name == "__eof__":
                return 0
            if name == "ping":
                emit(type="pong")
            elif name == "start":
                with measurer.lock:
                    measurer.session = Session()
            elif name == "stop":
                with measurer.lock:
                    session, measurer.session = measurer.session, None
                emit(**(session.result() if session else _empty("stop without start")))
            elif name == "calibrate":
                try:
                    fitted = calibrate(camera)
                    taped = command.get("cameraHeightM")
                    floor = pin_camera_height(fitted, float(taped)) if taped else fitted
                    save_calibration(floor)
                    # A new calibration owes nothing to the old one's feet. (A late
                    # save from the worker is keyed to the old calibration and ignored.)
                    FEET_FLOOR_PATH.unlink(missing_ok=True)
                    objects = learn_background(camera, floor, background)
                    emit(
                        type="calibrated",
                        cameraHeightM=round(floor.offset, 3),
                        fittedHeightM=round(fitted.offset, 3),
                        staticObjects=objects,
                    )
                except ZedUnavailable as exc:
                    emit(type="error", message=str(exc))
            else:
                log(f"unknown command: {name}")
            continue

        # Idle cheaply when nothing is being measured. The camera stays OPEN —
        # reopening it costs a second or two, and the app can call start at any
        # moment — but there is no reason to pull point clouds off it.
        if measurer.session is None or floor is None:
            time.sleep(0.05)
            continue

        now = time.monotonic()
        if now < next_grab:
            time.sleep(min(next_grab - now, 0.02))
            continue
        next_grab = now + 1.0 / FPS

        frame = camera.grab()
        if frame is None:
            continue
        if now >= next_measure and not measurer.busy:
            # The left image of the SAME grab, for the pose model only (see Measurer).
            image = camera.preview(MEASURE_WIDTH, MEASURE_HEIGHT) if measurer.wants_image else None
            measurer.submit(frame.points, image, floor)
            next_measure = now + 1.0 / FPS


def run_selftest(camera: ZedCamera) -> int:
    """Print live estimates to stderr. For standing in front of the kiosk."""
    floor = load_calibration()
    if floor is None:
        log("no calibration found — run: python main.py --calibrate")
        return 1

    log(f"camera {floor.offset:.2f} m above the floor; zone {ZONE_MIN_M}-{ZONE_MAX_M} m")
    log("Ctrl+C to stop.\n")
    window: list[float] = []
    try:
        while True:
            time.sleep(1.0 / FPS)
            frame = camera.grab()
            if frame is None:
                continue
            subjects = measure(frame.points, floor)
            if not subjects:
                log("  ...nobody in the zone")
                continue
            nearest = subjects[0]
            window.append(nearest.height_m)
            window[:] = window[-60:]
            summary = summarise(window)
            running = f"{summary[0]:6.1f} cm (conf {summary[1]:.2f})" if summary else "  --"
            log(
                f"  frame {nearest.height_m * 100:6.1f} cm  "
                f"| median {running}  "
                f"| {nearest.distance_m:.2f} m  "
                f"| {len(subjects)} subject(s)"
            )
    except KeyboardInterrupt:
        return 0


def run_diagnose(camera: ZedCamera) -> int:
    """Show EVERY cluster in the zone and why each one was or was not a visitor.

    `--selftest` reports what was accepted, so a visitor who is being filtered
    out looks identical to a visitor who is not there: "nobody in the zone" for
    both. That is the least debuggable outcome a measurement can have, and it is
    exactly what a room full of furniture produces. This prints the rejects and
    their reasons, which turns "it does not see me" into a specific filter and a
    number.
    """
    floor = load_calibration()
    if floor is None:
        log("no calibration found — run: npm run height:calibrate")
        return 1

    log(f"camera {floor.offset:.2f} m above the floor; zone {ZONE_MIN_M}-{ZONE_MAX_M} m")
    log("Stand where the visitor stands. Ctrl+C to stop.\n")
    try:
        while True:
            time.sleep(1.0 / FPS)
            frame = camera.grab()
            if frame is None:
                continue
            points = finite_points(frame.points)
            rejected: list[Rejection] = []
            subjects = find_subjects(floor, points, ZONE_MIN_M, ZONE_MAX_M, rejections=rejected)

            if not subjects and not rejected:
                log("  nothing in the zone at all — no cluster even formed")
                continue
            for s in subjects:
                log(f"  ACCEPTED  {s.height_m * 100:6.1f} cm  at {s.distance_m:.2f} m  ({s.points} pts)")
            for r in rejected:
                height = f"{r.height_m * 100:6.1f} cm" if r.height_m else "     -- "
                log(
                    f"  rejected  {height}  at {r.distance_m:.2f} m  "
                    f"(width {r.footprint_m:.2f} m, {r.points} pts)  {r.reason}"
                )
            log("")
    except KeyboardInterrupt:
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="제주 visitor-height sidecar (ZED 2i, headless). "
        "With no flags it speaks the NDJSON protocol on stdin/stdout.",
    )
    parser.add_argument(
        "--calibrate",
        action="store_true",
        help="fit and save the floor plane, then exit (nobody in front of the camera)",
    )
    parser.add_argument(
        "--selftest",
        action="store_true",
        help="print live height estimates to stderr instead of speaking the protocol",
    )
    parser.add_argument(
        "--diagnose",
        action="store_true",
        help="show every cluster and why each was or was not counted as a visitor",
    )
    parser.add_argument(
        "--camera-height",
        type=float,
        metavar="M",
        help="with --calibrate: the lens height above the floor from a tape "
        "measure, in metres. Overrides the fitted height; the fitted floor "
        "angle is kept.",
    )
    args = parser.parse_args()

    camera = ZedCamera()
    try:
        camera.open()
    except ZedUnavailable as exc:
        # Non-zero so the supervisor's backoff restart applies. On the protocol
        # path the app also gets a machine-readable reason; on the CLI paths
        # stderr is the whole point.
        if not (args.calibrate or args.selftest or args.diagnose):
            emit(type="error", message=str(exc))
        log(f"ZED unavailable: {exc}")
        return 1

    try:
        if args.calibrate:
            floor = calibrate(camera)
            if args.camera_height is not None:
                floor = pin_camera_height(floor, args.camera_height)
            save_calibration(floor)
            # Same as the protocol's calibrate: the room is empty right now, so
            # learn what stands in it, and drop feet-floor samples that belonged
            # to the previous calibration.
            FEET_FLOOR_PATH.unlink(missing_ok=True)
            learn_background(camera, floor, Background(BACKGROUND_PATH))
            # ── The one number a human must check ──────────────────────
            # Nothing in software can tell the real floor from the largest flat
            # surface in view. A camera on a desk fits the DESK, calls it the
            # floor, and every visitor afterwards is measured from waist height
            # — confidently, with no error anywhere. Only a tape measure
            # catches it, so the number is put in front of whoever ran this
            # rather than logged quietly.
            log("")
            log(f"  Camera is {floor.offset:.2f} m above the surface it fitted.")
            log("  >> CHECK THIS WITH A TAPE MEASURE. <<")
            log("  If it does not match the real lens height above the FLOOR,")
            log("  the fit landed on a desk or counter and every height will be")
            log("  wrong by the difference. Clear the floor and run again.")
            log("")
            log(f"saved to {CALIBRATION_PATH.resolve()}")
            return 0
        if args.diagnose:
            return run_diagnose(camera)
        if args.selftest:
            return run_selftest(camera)
        return run_service(camera)
    except ZedUnavailable as exc:
        emit(type="error", message=str(exc))
        log(f"fatal: {exc}")
        return 1
    finally:
        camera.close()


if __name__ == "__main__":
    sys.exit(main())
