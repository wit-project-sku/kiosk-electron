"""
The only module that needs a camera attached.

Everything that can be *wrong* about a height measurement lives in geometry.py
and estimator.py, which take numpy arrays and are tested without hardware. This
file just opens the ZED and hands over point clouds, so it deliberately contains
no arithmetic.

`pyzed` is imported lazily, inside `open()`. That keeps this module importable —
and the test suite runnable — on a machine with no ZED SDK installed, which is
every developer machine until someone installs 1.2 GB of CUDA.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

# Point cloud resolution requested from the SDK. The full depth map is far more
# than the estimator needs — it counts points in 2 cm slabs, and 640x360 already
# puts thousands of points on a person at 2 m. Retrieving less is the single
# cheapest thing we do for frame time.
MEASURE_WIDTH = 640
MEASURE_HEIGHT = 360

# Nothing at a kiosk is a visitor beyond this, and cutting depth short keeps the
# cloud small and the stereo matcher honest.
MAX_DEPTH_M = 5.0


class ZedUnavailable(RuntimeError):
    """The SDK is missing, or no camera answered."""


@dataclass
class Frame:
    """One grab: a point cloud, and the gravity vector that went with it."""

    points: np.ndarray  # (H, W, 4) float32 XYZ + packed colour, straight from the SDK
    gravity: np.ndarray | None  # (3,) IMU acceleration, or None on a camera without one


class ZedCamera:
    def __init__(self) -> None:
        self._sl = None
        self._cam = None
        self._runtime = None
        self._mat = None
        self._resolution = None

    def open(self) -> None:
        try:
            import pyzed.sl as sl  # noqa: PLC0415 — see the module docstring
        except ImportError as exc:  # pragma: no cover — needs a machine without the SDK
            raise ZedUnavailable(
                "pyzed is not installed. Install the ZED SDK, then run its "
                "get_python_api.py against this interpreter."
            ) from exc

        init = sl.InitParameters()
        init.camera_resolution = sl.RESOLUTION.HD720
        init.depth_mode = _depth_mode(sl)
        init.coordinate_units = sl.UNIT.METER
        init.depth_maximum_distance = MAX_DEPTH_M

        cam = sl.Camera()
        status = cam.open(init)
        if status != sl.ERROR_CODE.SUCCESS:
            raise ZedUnavailable(f"ZED open failed: {status}")

        self._sl = sl
        self._cam = cam
        self._runtime = sl.RuntimeParameters()
        self._mat = sl.Mat()
        self._resolution = sl.Resolution(MEASURE_WIDTH, MEASURE_HEIGHT)

    def grab(self) -> Frame | None:
        """Next frame, or None if the camera had nothing ready."""
        sl, cam = self._sl, self._cam
        if sl is None or cam is None:
            raise ZedUnavailable("grab() before open()")

        if cam.grab(self._runtime) != sl.ERROR_CODE.SUCCESS:
            return None

        cam.retrieve_measure(self._mat, sl.MEASURE.XYZ, sl.MEM.CPU, self._resolution)
        return Frame(points=self._mat.get_data(), gravity=self._gravity())

    def _gravity(self) -> np.ndarray | None:
        """IMU acceleration, which at rest is the gravity vector.

        Used ONLY to sanity-check a fitted floor plane (a wall fits just as well
        as a floor, and only gravity can tell them apart). The ZED 2i has an
        IMU; older ZEDs do not, and this returns None for them rather than
        failing — see `plane_is_plausible_floor`.
        """
        sl, cam = self._sl, self._cam
        try:
            data = sl.SensorsData()
            if cam.get_sensors_data(data, sl.TIME_REFERENCE.IMAGE) != sl.ERROR_CODE.SUCCESS:
                return None
            accel = data.get_imu_data().get_linear_acceleration()
            vector = np.asarray(accel, dtype=float)
            return vector if np.isfinite(vector).all() else None
        except Exception:  # pragma: no cover — SDK/model variation, never fatal
            return None

    def close(self) -> None:
        if self._cam is not None:
            self._cam.close()
            self._cam = None


def _depth_mode(sl):
    """Pick a classical (non-neural) depth mode, whichever this SDK calls it.

    Deliberately NOT the NEURAL modes. They are more accurate, and they are also
    an AI model: first run builds a TensorRT engine for the specific GPU, which
    takes minutes, and every run afterwards costs hundreds of MB of VRAM. This
    estimator counts points in horizontal slabs; it does not need the extra
    fidelity, and a kiosk cannot afford a multi-minute first boot.

    The enum has been reorganised across SDK majors, so the preference is
    resolved by name with a fallback rather than hard-coded.
    """
    for name in ("ULTRA", "QUALITY", "PERFORMANCE"):
        mode = getattr(sl.DEPTH_MODE, name, None)
        if mode is not None:
            return mode
    raise ZedUnavailable("No classical depth mode available in this ZED SDK")
