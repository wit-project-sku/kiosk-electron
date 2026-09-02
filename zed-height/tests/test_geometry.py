import numpy as np
import pytest

from estimator import estimate_crown, find_subjects, summarise
from geometry import FloorFrame, fit_plane_ransac, orient_up, plane_is_plausible_floor
from tests.synthetic import (
    ceiling,
    counter,
    floor,
    gravity_in_camera_frame,
    person,
    place,
    wall,
)

ZONE = (0.8, 3.5)


def build(rng, *people, roll_deg=90.0, tilt_deg=0.0, distance_m=2.0):
    """A camera-frame cloud of a floor plus some visitors, and its fitted frame.

    Gravity is passed to the fit exactly as `calibrate()` does on real hardware.
    Without it a scene containing a wall fits the WALL — it carries more points
    than the visible floor — and every height afterwards is nonsense. Leaving it
    out here would make the suite easier to pass and less like production.
    """
    world = np.concatenate([floor(rng), *people], axis=0)
    cam = place(world, tilt_deg=tilt_deg, roll_deg=roll_deg, distance_m=distance_m)
    g = gravity_in_camera_frame(tilt_deg, roll_deg)
    fit = fit_plane_ransac(cam, rng=rng, gravity=g)
    assert fit is not None
    return cam, orient_up(*fit, gravity=g)


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


def test_a_wall_is_not_a_visitor():
    """The bug this suite exists to prevent recurring.

    A room's walls are the largest above-the-floor cluster in any indoor scene.
    The first version of the estimator measured an office wall as a confident
    230 cm visitor — the top of the body band, because it never stopped.
    """
    rng = np.random.default_rng(21)
    cam, frame = build(rng, wall(rng))
    assert find_subjects(frame, cam, *ZONE) == []


def test_a_visitor_is_still_found_with_a_wall_behind_them():
    rng = np.random.default_rng(22)
    cam, frame = build(rng, person(rng, height_m=1.79), wall(rng, distance_m=3.2))
    subjects = find_subjects(frame, cam, *ZONE)
    assert len(subjects) == 1
    assert subjects[0].height_m == pytest.approx(1.79, abs=0.03)


def test_furniture_is_not_a_visitor():
    """A counter is person-height and stands on the floor, but is far too wide."""
    rng = np.random.default_rng(23)
    cam, frame = build(rng, counter(rng))
    assert find_subjects(frame, cam, *ZONE) == []


def test_a_visitor_beside_furniture_is_measured_alone():
    rng = np.random.default_rng(24)
    cam, frame = build(rng, person(rng, height_m=1.62), counter(rng, centre_xy=(1.1, 0.0)))
    subjects = find_subjects(frame, cam, *ZONE)
    assert len(subjects) == 1
    assert subjects[0].height_m == pytest.approx(1.62, abs=0.03)


def test_the_ceiling_is_not_the_top_of_the_visitor():
    """Found on real hardware: an office ceiling read as a 212-224 cm visitor.

    The ceiling is directly above the head, inside the head column, and below
    MAX_BODY_M. Only its separation from the body distinguishes it.
    """
    rng = np.random.default_rng(31)
    cam, frame = build(rng, person(rng, height_m=1.79), ceiling(rng))
    subjects = find_subjects(frame, cam, *ZONE)
    assert len(subjects) == 1
    assert subjects[0].height_m == pytest.approx(1.79, abs=0.03)


def test_a_low_ceiling_still_does_not_become_the_visitor():
    rng = np.random.default_rng(32)
    cam, frame = build(rng, person(rng, height_m=1.62), ceiling(rng, height_m=2.15))
    subjects = find_subjects(frame, cam, *ZONE)
    assert len(subjects) == 1
    assert subjects[0].height_m == pytest.approx(1.62, abs=0.03)


def test_a_full_room_measures_only_the_person():
    """Everything at once — the scene the kiosk actually stands in."""
    rng = np.random.default_rng(33)
    cam, frame = build(
        rng,
        person(rng, height_m=1.74, raised_arm_to=2.0),
        wall(rng, distance_m=3.4),
        ceiling(rng),
        counter(rng, centre_xy=(1.2, 0.0)),
    )
    subjects = find_subjects(frame, cam, *ZONE)
    assert len(subjects) == 1
    assert subjects[0].height_m == pytest.approx(1.74, abs=0.03)


@pytest.mark.parametrize("roll_deg", [0.0, 90.0, 180.0, 270.0, 45.0])
def test_any_mount_rotation_measures_the_same_person(roll_deg):
    """제주 mounts the ZED rotated 90° left, permanently.

    Nothing in the estimator is told that, and nothing may ever need to be: up
    comes from the fitted floor, the standing zone is a radial distance, and the
    floor-plane basis is arbitrary. This pins that down for every orientation
    somebody might mount a camera in, including ones nobody plans to — a
    constant that has to agree with a bracket is a constant that will one day
    disagree with it.
    """
    rng = np.random.default_rng(41)
    cam, frame = build(rng, person(rng, height_m=1.79), roll_deg=roll_deg)
    subjects = find_subjects(frame, cam, *ZONE)
    assert len(subjects) == 1
    assert subjects[0].height_m == pytest.approx(1.79, abs=0.03)


@pytest.mark.parametrize("tilt_deg", [-15.0, -8.0, 0.0, 8.0, 15.0])
def test_a_rotated_mount_that_is_also_tilted_still_measures(tilt_deg):
    """A bracket is never perfectly level. Rotation and tilt together."""
    rng = np.random.default_rng(42)
    cam, frame = build(rng, person(rng, height_m=1.68), roll_deg=90.0, tilt_deg=tilt_deg)
    subjects = find_subjects(frame, cam, *ZONE)
    assert len(subjects) == 1
    assert subjects[0].height_m == pytest.approx(1.68, abs=0.03)


def test_a_rotated_mount_recovers_the_true_camera_height():
    """The number an installer checks against a tape, taken through a 90° mount."""
    rng = np.random.default_rng(43)
    _, frame = build(rng, person(rng), roll_deg=90.0)
    assert frame.offset == pytest.approx(1.4, abs=0.02)


def test_a_desk_is_not_a_short_visitor():
    """Found on real hardware: a desk edge read as a rock-solid 78 cm.

    Furniture at desk height is person-sized in footprint, stops well below the
    ceiling, and never moves — a perfect subject by every other test. Only its
    height gives it away.
    """
    rng = np.random.default_rng(51)
    cam, frame = build(rng, counter(rng, centre_xy=(0.0, 0.0), height_m=0.78))
    assert find_subjects(frame, cam, *ZONE) == []


@pytest.mark.parametrize("furniture_height", [0.72, 0.78, 0.85, 0.95])
def test_furniture_at_any_plausible_height_is_refused(furniture_height):
    rng = np.random.default_rng(52)
    cam, frame = build(rng, counter(rng, centre_xy=(0.0, 0.0), height_m=furniture_height))
    assert find_subjects(frame, cam, *ZONE) == []


def test_a_short_adult_is_still_measured():
    """The filter must not eat real visitors. 1.45 m is a small adult."""
    rng = np.random.default_rng(53)
    cam, frame = build(rng, person(rng, height_m=1.45))
    subjects = find_subjects(frame, cam, *ZONE)
    assert len(subjects) == 1
    assert subjects[0].height_m == pytest.approx(1.45, abs=0.03)


def test_a_visitor_standing_near_a_desk_is_the_one_measured():
    """The office scene: a desk in the zone, a person standing clear of it.

    Not closer than ~0.4 m, because at that point they genuinely are one blob
    to a depth camera — a visitor leaning on a counter is not separable from it,
    and pretending otherwise in a test would prove nothing.
    """
    rng = np.random.default_rng(54)
    cam, frame = build(
        rng,
        person(rng, height_m=1.79),
        counter(rng, centre_xy=(1.1, 0.0), height_m=0.78),
    )
    subjects = find_subjects(frame, cam, *ZONE)
    assert len(subjects) == 1
    assert subjects[0].height_m == pytest.approx(1.79, abs=0.03)
