"""Session results from pose subjects: clear frames win, arm-touching frames only fill gaps."""

import pytest

from body import BodyGirths, PoseMeasurer, PoseUnavailable
from estimator import Subject
from main import Session
from widths import BodyWidths


def pose_subject(chest_clear: float | None, chest_touching: float, girth: float | None = None) -> Subject:
    return Subject(
        height_m=1.75,
        points=5000,
        distance_m=2.0,
        widths=BodyWidths(0.48, chest_clear, 0.29, 0.36),
        girths=BodyGirths(girth, 0.78, 0.95),
        drawing={
            "fallback": {
                "widths": BodyWidths(0.48, chest_touching, 0.29, 0.36),
                "girths": BodyGirths(girth or 0.85, 0.78, 0.95),
            },
            "armsTouching": [] if chest_clear else ["chest"],
            "headInView": True,
        },
    )


def test_clear_frames_beat_touching_ones():
    session = Session()
    for _ in range(6):
        session.add([pose_subject(0.34, 0.30, 0.92)])
    for _ in range(6):
        session.add([pose_subject(None, 0.30)])
    result = session.result()
    assert result["method"] == "pose"
    assert result["chestWidthCm"] == 34.0
    assert result["chestGirthCm"] == 92.0
    assert result["armsTouching"] == []


def test_touching_only_still_reports_and_says_so():
    session = Session()
    for _ in range(8):
        session.add([pose_subject(None, 0.30)])
    result = session.result()
    assert result["chestWidthCm"] == 30.0
    assert "chestWidthCm" in result["armsTouching"]
    assert result["waistGirthCm"] == 78.0


def test_pose_model_loads():
    # mediapipe and the 30 MB model are a per-machine install (see README);
    # without them the sidecar falls back to the point cloud, which is tested
    # everywhere else.
    try:
        PoseMeasurer()
    except PoseUnavailable as exc:
        pytest.skip(str(exc))
