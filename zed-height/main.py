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
from collections import Counter
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
from geometry import (
    FloorFrame,
    camera_is_above,
    finite_points,
    fit_floor,
    fit_plane_ransac,
    orient_up,
    plane_is_plausible_floor,
)
from zed import ZedCamera, ZedUnavailable


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

# Per-frame estimates on stderr while sampling, for watching a test live. The app
# turns this on in development only (ZedSidecarManager) — at 4 fps it would
# otherwise fill a kiosk's log files with one line per frame of every capture.
VERBOSE = os.environ.get("HEIGHT_VERBOSE") == "1"

# Reported with every result and stored with every row, so measurements from an
# estimator later found to be wrong can be told apart and discarded.
#   1  (unversioned) — calibration could be upside down or on a desk
#   2  signed mount check + fit_floor
#   3  people far behind the visitor ignored; plateau instead of median
ALGORITHM_VERSION = 3

CALIBRATION_PATH = Path(os.environ.get("HEIGHT_CALIBRATION", "calibration.json"))

# Frames averaged when fitting the floor. A single frame's plane fit is fine;
# several and a median make it boring, which is what a once-per-installation
# calibration should be.
CALIBRATION_FRAMES = 12


def emit(**payload) -> None:
    """One NDJSON event on stdout. The ONLY thing that may write there."""
    sys.stdout.write(json.dumps(payload, separators=(",", ":")) + "\n")
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
        for r in rejected or ():
            self.rejections[r.reason] += 1

    def result(self) -> dict:
        """What the app gets. A height only when it means something.

        A 같이찍기 (together) capture puts two or more people in the zone, and
        "the visitor's height" stops being a well-defined thing. Rather than
        guess which one is the subject, the count is reported and the height is
        null — the analytics are better off with a smaller, honest dataset.
        """
        if not self.subject_counts:
            return _empty("no frames sampled")

        subjects = int(np.bincount(self.subject_counts).argmax())
        if subjects == 0:
            return _empty(self._why_nobody(), subjects=0)
        if subjects > 1:
            return _empty("more than one visitor in frame", subjects=subjects)

        summary = summarise(self.heights)
        if summary is None:
            return _empty("too few usable frames", subjects=1)

        height_cm, confidence = summary
        return {
            "type": "result",
            "heightCm": round(height_cm, 1),
            "confidence": round(confidence, 3),
            "samples": len(self.heights),
            "subjects": 1,
            "reason": None,
            "version": ALGORITHM_VERSION,
        }


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


def log_frame(session: Session, subjects: list[Subject], rejected: list[Rejection]) -> None:
    """One line per sampled frame: this frame's estimate and the running median."""
    n = len(session.subject_counts)
    subjects = in_front(subjects)
    if len(subjects) == 1:
        s = subjects[0]
        summary = summarise(session.heights)
        running = f"median {summary[0]:5.1f} cm (conf {summary[1]:.2f})" if summary else "median --"
        log(f"#{n:<3} {s.height_m * 100:5.1f} cm  at {s.distance_m:.2f} m  | {running}")
    elif subjects:
        log(f"#{n:<3} {len(subjects)} people in the zone, not measured")
    elif rejected:
        log(f"#{n:<3} nobody counted: {rejected[0].reason}")
    else:
        log(f"#{n:<3} nobody in the zone")


def _empty(reason: str, subjects: int = 0) -> dict:
    return {
        "type": "result",
        "heightCm": None,
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
    return find_subjects(floor, points, ZONE_MIN_M, ZONE_MAX_M, rejections=rejections)


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

    session: Session | None = None
    interval = 1.0 / FPS
    next_grab = time.monotonic()

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
                session = Session()
            elif name == "stop":
                emit(**(session.result() if session else _empty("stop without start")))
                session = None
            elif name == "calibrate":
                try:
                    floor = calibrate(camera)
                    save_calibration(floor)
                    emit(type="calibrated", cameraHeightM=round(floor.offset, 3))
                except ZedUnavailable as exc:
                    emit(type="error", message=str(exc))
            else:
                log(f"unknown command: {name}")
            continue

        # Idle cheaply when nothing is being measured. The camera stays OPEN —
        # reopening it costs a second or two, and the app can call start at any
        # moment — but there is no reason to pull point clouds off it.
        if session is None or floor is None:
            time.sleep(0.05)
            continue

        now = time.monotonic()
        if now < next_grab:
            time.sleep(min(next_grab - now, 0.02))
            continue
        next_grab = now + interval

        frame = camera.grab()
        if frame is not None:
            rejected: list[Rejection] = []
            subjects = measure(frame.points, floor, rejected)
            session.add(subjects, rejected)
            if VERBOSE:
                log_frame(session, subjects, rejected)


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
