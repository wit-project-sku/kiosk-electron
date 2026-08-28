import numpy as np
import pytest

from estimator import estimate_crown, find_subjects, summarise
from geometry import FloorFrame, fit_plane_ransac, orient_up, plane_is_plausible_floor
from tests.synthetic import floor, person, place

ZONE = (0.8, 3.5)


def build(rng, *people, roll_deg=90.0, tilt_deg=0.0, distance_m=2.0):
    """A camera-frame cloud of a floor plus some visitors, and its fitted frame."""
    world = np.concatenate([floor(rng), *people], axis=0)
    cam = place(world, tilt_deg=tilt_deg, roll_deg=roll_deg, distance_m=distance_m)
    fit = fit_plane_ransac(cam, rng=rng)
    assert fit is not None
    return cam, orient_up(*fit)


def test_plane_fit_recovers_up_through_a_ninety_degree_mount():
    rng = np.random.default_rng(1)
    _, frame = build(rng, person(rng))
    # The floor sat at z = 0 with the camera 1.4 m above it, so a correct fit
    # puts the camera exactly 1.4 m up whatever the mount rotation was.
    assert frame.offset == pytest.approx(1.4, abs=0.02)
    assert frame.heights(np.zeros((1, 3)))[0] == pytest.approx(1.4, abs=0.02)


def test_plane_fit_survives_a_tilted_mount():
    rng = np.random.default_rng(2)
    _, frame = build(rng, person(rng), roll_deg=90.0, tilt_deg=12.0)
    assert frame.offset == pytest.approx(1.4, abs=0.03)


@pytest.mark.parametrize("truth", [1.52, 1.65, 1.71, 1.83, 1.94])
def test_crown_matches_known_heights(truth):
    rng = np.random.default_rng(3)
    cam, frame = build(rng, person(rng, height_m=truth))
    subjects = find_subjects(frame, cam, *ZONE)
    assert len(subjects) == 1
    assert subjects[0].height_m == pytest.approx(truth, abs=0.03)


def test_a_raised_hand_is_not_measured_as_the_head():
    """The 제주 gesture gate makes this the common case — see estimator.py."""
    rng = np.random.default_rng(4)
    cam, frame = build(rng, person(rng, height_m=1.71, raised_arm_to=2.05))
    subjects = find_subjects(frame, cam, *ZONE)
    assert len(subjects) == 1
    assert subjects[0].height_m == pytest.approx(1.71, abs=0.03)


def test_naive_topmost_point_would_have_been_wrong():
    """Guards the premise: without the density test this cloud reads ~2.05 m."""
    rng = np.random.default_rng(4)
    cam, frame = build(rng, person(rng, height_m=1.71, raised_arm_to=2.05))
    assert frame.heights(cam).max() == pytest.approx(2.05, abs=0.03)


def test_a_hand_held_directly_overhead_degrades_but_stays_bounded():
    """The case the head column cannot filter — see estimator.py, defence 2.

    A hand raised straight above the head is INSIDE the column, so only the
    density test stands between it and the estimate. It buys a bounded
    overshoot rather than a correct answer, and that is the honest claim: the
    error is capped at CROWN_MAX_SLABS (8 cm), and the median across the capture
    window removes what is left, because nobody holds a hand overhead for the
    whole 15-30 seconds.
    """
    rng = np.random.default_rng(8)
    cam, frame = build(rng, person(rng, height_m=1.71, raised_arm_to=2.05, arm_offset=0.08))
    subjects = find_subjects(frame, cam, *ZONE)
    assert len(subjects) == 1
    assert 1.71 - 0.03 <= subjects[0].height_m <= 1.71 + 0.09


@pytest.mark.parametrize("distance_m", [1.2, 2.0, 3.0])
def test_estimate_holds_across_the_standing_zone(distance_m):
    """Every threshold is relative to the cloud's own density, so distance —
    which changes point count by more than 6x across this range — must not move
    the answer."""
    rng = np.random.default_rng(9)
    cam, frame = build(rng, person(rng, height_m=1.71), distance_m=distance_m)
    subjects = find_subjects(frame, cam, *ZONE)
    assert len(subjects) == 1
    assert subjects[0].height_m == pytest.approx(1.71, abs=0.03)


def test_together_capture_finds_both_visitors():
    rng = np.random.default_rng(5)
    cam, frame = build(
        rng,
        person(rng, height_m=1.78, centre_xy=(-0.35, 0.0)),
        person(rng, height_m=1.61, centre_xy=(0.35, 0.0)),
    )
    subjects = find_subjects(frame, cam, *ZONE)
    assert len(subjects) == 2
    assert sorted(round(s.height_m, 2) for s in subjects) == pytest.approx([1.61, 1.78], abs=0.03)


def test_empty_scene_measures_nothing():
    rng = np.random.default_rng(6)
    cam, frame = build(rng)
    assert find_subjects(frame, cam, *ZONE) == []


def test_crown_needs_a_body_not_just_noise():
    assert estimate_crown(np.random.default_rng(7).uniform(0.3, 2.3, 40)) is None


def test_a_wall_is_rejected_as_a_floor():
    """A vertical plane fits beautifully and is never the floor — the IMU says so."""
    wall = FloorFrame(normal=np.array([1.0, 0.0, 0.0]), offset=2.0)
    gravity = np.array([0.0, 0.0, 9.81])
    assert not plane_is_plausible_floor(wall, gravity)
    real_floor = FloorFrame(normal=np.array([0.0, 0.0, 1.0]), offset=1.4)
    assert plane_is_plausible_floor(real_floor, gravity)


def test_summary_median_ignores_bad_frames():
    samples = [1.70, 1.71, 1.72, 1.71, 2.05, 1.70, 0.94, 1.71]
    height_cm, confidence = summarise(samples)
    assert height_cm == pytest.approx(171.0, abs=1.0)
    assert confidence > 0.5


def test_summary_refuses_too_few_frames():
    assert summarise([1.7, 1.7]) is None
