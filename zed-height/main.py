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

from estimator import Subject, find_subjects, summarise
from geometry import (
    FloorFrame,
    camera_is_above,
    finite_points,
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
# the arithmetic. 12 over a 20 s window is ~240 samples, far more than the
# median needs, and it leaves the GPU alone between grabs.
FPS = _env_float("HEIGHT_FPS", 12.0)

# The standing zone, as radial distance across the floor from the camera's own
# ground position. Anything nearer is someone reaching for the touch screen;
# anything further is the concourse.
ZONE_MIN_M = _env_float("HEIGHT_ZONE_MIN", 0.8)
ZONE_MAX_M = _env_float("HEIGHT_ZONE_MAX", 3.5)

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
        # Gravity constrains the SEARCH, not just the result. Indoors a wall
        # covers more of the depth image than the visible floor does, so an
        # unconstrained fit lands on the wall — see fit_plane_ransac.
        fit = fit_plane_ransac(points, gravity=gravity)
        if fit is None:
            continue
        candidate = orient_up(*fit, gravity=gravity)
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


class Session:
    """One capture's worth of per-frame estimates."""

    def __init__(self) -> None:
        self.heights: list[float] = []
        self.subject_counts: list[int] = []

    def add(self, subjects: list[Subject]) -> None:
        self.subject_counts.append(len(subjects))
        if len(subjects) == 1:
            self.heights.append(subjects[0].height_m)

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
            return _empty("nobody in the measurement zone", subjects=0)
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
        }


def _empty(reason: str, subjects: int = 0) -> dict:
    return {
        "type": "result",
        "heightCm": None,
        "confidence": 0.0,
        "samples": 0,
        "subjects": subjects,
        "reason": reason,
    }


def measure(frame_points: np.ndarray, floor: FloorFrame) -> list[Subject]:
    points = finite_points(frame_points)
    if len(points) < 500:
        return []
    return find_subjects(floor, points, ZONE_MIN_M, ZONE_MAX_M)


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


def run_service(camera: ZedCamera) -> int:
    floor = load_calibration()
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
            session.add(measure(frame.points, floor))


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
    args = parser.parse_args()

    camera = ZedCamera()
    try:
        camera.open()
    except ZedUnavailable as exc:
        # Non-zero so the supervisor's backoff restart applies. On the protocol
        # path the app also gets a machine-readable reason; on the CLI paths
        # stderr is the whole point.
        if not (args.calibrate or args.selftest):
            emit(type="error", message=str(exc))
        log(f"ZED unavailable: {exc}")
        return 1

    try:
        if args.calibrate:
            floor = calibrate(camera)
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
