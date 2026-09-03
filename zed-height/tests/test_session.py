"""What one capture reports back to the app, and when it refuses to."""

import numpy as np
import pytest

from estimator import Subject
from geometry import fit_plane_ransac, orient_up
from main import Session, measure
from tests.synthetic import floor, person, place


def subject(height_m: float, distance_m: float = 2.0) -> Subject:
    return Subject(height_m=height_m, points=5000, distance_m=distance_m)


def test_a_solo_capture_reports_a_height():
    session = Session()
    for h in [1.70, 1.71, 1.72, 1.71, 1.70, 1.71, 1.72]:
        session.add([subject(h)])
    result = session.result()
    assert result["heightCm"] == pytest.approx(171.0, abs=1.0)
    assert result["subjects"] == 1
    assert result["confidence"] > 0.5
    assert result["reason"] is None


def test_a_together_capture_reports_no_height():
    """Two people in frame and "the visitor's height" stops being well-defined.

    The count is still worth reporting — a smaller honest dataset beats a bigger
    one with a coin-flip in it. See Session.result.
    """
    session = Session()
    for _ in range(30):
        session.add([subject(1.78, 1.9), subject(1.61, 2.1)])
    result = session.result()
    assert result["heightCm"] is None
    assert result["subjects"] == 2
    assert "more than one" in result["reason"]


def test_an_empty_zone_reports_no_height():
    session = Session()
    for _ in range(30):
        session.add([])
    result = session.result()
    assert result["heightCm"] is None
    assert result["subjects"] == 0


def test_a_visitor_who_walked_off_mid_capture_still_reports():
    """Modal subject count, not the first or last frame.

    Someone steps out of the zone to fix their hair and steps back; the frames
    where nobody was there must not turn the whole capture into a null.
    """
    session = Session()
    for _ in range(40):
        session.add([subject(1.66)])
    for _ in range(8):
        session.add([])
    result = session.result()
    assert result["heightCm"] == pytest.approx(166.0, abs=1.0)
    assert result["subjects"] == 1


def test_a_glimpse_is_not_enough():
    session = Session()
    for _ in range(3):
        session.add([subject(1.70)])
    result = session.result()
    assert result["heightCm"] is None
    assert "too few" in result["reason"]


def test_stop_without_start_is_not_a_crash():
    assert Session().result()["reason"] == "no frames sampled"


def test_measure_runs_the_whole_chain_on_a_raw_cloud():
    """`measure` is what the service loop actually calls, shape and all.

    The SDK hands over an (H, W, 4) array with NaNs where the stereo matcher
    found nothing; everything downstream assumes that has been dealt with.
    """
    rng = np.random.default_rng(11)
    world = np.concatenate([floor(rng), person(rng, height_m=1.74)], axis=0)
    cam = place(world)

    # Reshape into an image-like grid with a realistic scatter of dropouts.
    usable = (len(cam) // 640) * 640
    grid = np.concatenate(
        [cam[:usable], np.zeros((usable, 1))], axis=1
    ).reshape(-1, 640, 4)
    holes = rng.random(grid.shape[:2]) < 0.25
    grid[holes] = np.nan

    frame = orient_up(*fit_plane_ransac(cam, rng=rng))
    subjects = measure(grid, frame)
    assert len(subjects) == 1
    assert subjects[0].height_m == pytest.approx(1.74, abs=0.03)
