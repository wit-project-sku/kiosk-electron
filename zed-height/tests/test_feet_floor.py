"""
The floor seen at visitors' feet corrects a stale calibration, survives a
sidecar restart, and is dropped when the camera is recalibrated.
"""

import numpy as np
import pytest

import main
from geometry import FloorFrame


class _NoThread:
    def __init__(self, *args, **kwargs):
        pass

    def start(self):
        pass


@pytest.fixture
def make_measurer(monkeypatch, tmp_path):
    # Measurer's worker thread loads MediaPipe; these tests only need its floor.
    monkeypatch.setattr(main.threading, "Thread", _NoThread)
    path = tmp_path / "feet_floor.json"
    return lambda: main.Measurer(None, None, feet_floor_path=path)


CALIBRATED = FloorFrame(normal=np.array([0.0, -1.0, 0.0]), offset=0.735)


def test_feet_move_the_floor_and_survive_a_restart(make_measurer):
    m = make_measurer()
    assert m._learned_floor(CALIBRATED)[1] == 0.0
    for _ in range(main.FEET_FLOOR_SAVE_EVERY):
        m._learn_feet_floor(-0.34)
    floor, bias = m._learned_floor(CALIBRATED)
    assert bias == pytest.approx(-0.34)
    assert floor.offset == pytest.approx(1.075)

    restarted = make_measurer()
    assert restarted._learned_floor(CALIBRATED)[1] == pytest.approx(-0.34)


def test_a_new_calibration_starts_over(make_measurer):
    m = make_measurer()
    m._learned_floor(CALIBRATED)
    for _ in range(main.FEET_FLOOR_SAVE_EVERY):
        m._learn_feet_floor(-0.34)
    recalibrated = FloorFrame(normal=CALIBRATED.normal, offset=1.075)
    assert m._learned_floor(recalibrated)[1] == 0.0
    # Nor does a restart bring the old calibration's correction back.
    assert make_measurer()._learned_floor(recalibrated)[1] == 0.0
