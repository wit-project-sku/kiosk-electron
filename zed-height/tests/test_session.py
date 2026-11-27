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


def test_a_taped_camera_height_replaces_the_fitted_one():
    import pytest
    from geometry import FloorFrame
    from main import pin_camera_height
    from zed import ZedUnavailable

    fitted = FloorFrame(normal=np.array([0.0, 0.0, 1.0]), offset=1.163)
    pinned = pin_camera_height(fitted, 1.19)
    assert pinned.offset == 1.19
    assert np.allclose(pinned.normal, fitted.normal)
    # A person at 1.72 m measured from the fitted floor reads 2.7 cm higher once pinned.
    point = np.array([[0.0, 0.0, 1.72 - 1.163]])
    assert pinned.heights(point)[0] - fitted.heights(point)[0] == pytest.approx(0.027)

    with pytest.raises(ZedUnavailable):
        pin_camera_height(fitted, 1.40)  # 24 cm off: the fit found a desk, not stereo bias


def test_someone_far_behind_the_visitor_does_not_void_the_capture():
    """Dev PC, 2026-10-08: a 130 cm shape 2.2 m away, the visitor at 1.1 m."""
    session = Session()
    for _ in range(30):
        session.add([subject(1.74, 1.1), subject(1.30, 2.2)])
    result = session.result()
    assert result["subjects"] == 1
    assert result["heightCm"] == pytest.approx(174.0, abs=1.0)


# The two 2026-10-28 dev-PC captures, frame by frame as the sidecar logged them:
# a height in cm, 0 for "nobody counted", 2 for "2 people in the zone". Both
# came back "nobody counted" when the count was a mode over every frame — most
# frames were the visitor walking in and merging with the wall.
WALK_IN_15_41 = [0] * 9 + [108, 0, 130, 112, 2, 0, 0, 108, 0, 0, 0, 0, 0, 0, 0, 0,
                           168, 170, 0, 168, 0, 168, 170, 0, 0, 170, 168, 168, 0, 170, 170]
WALK_IN_15_45 = [0, 0, 0, 0, 160, 0, 0, 170, 170, 170, 142, 156, 168, 0, 164, 160, 0, 0,
                 166, 0, 0, 0, 166, 0]


@pytest.mark.parametrize(
    "frames, expected_cm",
    [(WALK_IN_15_41, 169.0), (WALK_IN_15_45, 167.0)],
    ids=["15:41", "15:45"],
)
def test_a_visitor_mostly_hidden_while_walking_in_still_reports(frames, expected_cm):
    session = Session()
    for f in frames:
        session.add([] if f == 0 else [subject(1.7), subject(1.7, 2.1)] if f == 2 else [subject(f / 100.0)])
    result = session.result()
    assert result["subjects"] == 1
    assert result["heightCm"] == pytest.approx(expected_cm, abs=2.0)


def test_a_together_capture_is_still_refused_when_frames_are_empty():
    """Ignoring empty frames must not turn a 같이찍기 into a solo capture."""
    session = Session()
    for _ in range(20):
        session.add([])
    for _ in range(12):
        session.add([subject(1.78, 1.9), subject(1.61, 2.1)])
    for _ in range(3):
        session.add([subject(1.78, 1.9)])
    result = session.result()
    assert result["heightCm"] is None
    assert result["subjects"] == 2


def test_the_real_capture_from_the_dev_pc_reads_the_standing_height():
    """The single-subject frames of the 2026-10-08 test, in order. Truth: 174-175 cm."""
    frames = [128, 124, 138, 130, 168, 130, 170, 174, 174, 174, 172, 174, 174, 174, 172,
              174, 174, 172, 150, 172, 174, 174, 174, 174, 174, 172, 158, 156, 156, 172,
              172, 174, 174, 174, 174, 170, 130, 122, 106]
    session = Session()
    for cm in frames:
        session.add([subject(cm / 100.0)])
    result = session.result()
    assert result["heightCm"] == pytest.approx(174.0, abs=0.5)
    assert result["confidence"] > 0.5
