import numpy as np
import pytest

from estimator import find_subjects
from geometry import fit_floor
from main import Session
from tests.synthetic import (
    floor,
    forward_in_camera_frame,
    gravity_in_camera_frame,
    place,
    shaped_person,
)
from widths import BodyWidths, summarise_widths

ZONE = (0.8, 3.5)


def measure_one(person_cloud, roll_deg=90.0, distance_m=1.5):
    rng = np.random.default_rng(5)
    cam = place(np.concatenate([floor(rng), person_cloud]), roll_deg=roll_deg, distance_m=distance_m)
    frame = fit_floor(cam, gravity_in_camera_frame(roll_deg=roll_deg))
    subjects = find_subjects(frame, cam, *ZONE, forward=forward_in_camera_frame(roll_deg=roll_deg))
    assert len(subjects) == 1
    return subjects[0]


@pytest.mark.parametrize("roll_deg", [0.0, 90.0])
@pytest.mark.parametrize("seed", [1, 2, 3, 4])
def test_widths_with_air_between_arms_and_body(roll_deg, seed):
    rng = np.random.default_rng(seed)
    s = measure_one(shaped_person(rng, arm_gap_m=0.05), roll_deg=roll_deg)
    w = s.widths
    assert w.shoulder_m == pytest.approx(0.46, abs=0.015)
    assert w.chest_m == pytest.approx(0.32, abs=0.015)
    assert w.waist_m == pytest.approx(0.28, abs=0.015)
    assert w.hip_m == pytest.approx(0.35, abs=0.015)


@pytest.mark.parametrize("seed", [1, 2, 3, 4])
def test_arms_against_the_body_are_not_reported_as_torso(seed):
    """No gap means no honest torso width — refuse rather than add two arms to it.

    Found while building this: "narrower than the shoulders" let a hip with a
    forearm against it through as 43 cm (truth 35), and a 39 cm waist (truth 28).
    """
    w = measure_one(shaped_person(np.random.default_rng(seed), arm_gap_m=None)).widths
    assert w.shoulder_m == pytest.approx(0.46, abs=0.015)
    assert w.chest_m is None
    assert w.waist_m is None
    assert w.hip_m is None


def test_a_hole_in_the_middle_of_the_chest_does_not_halve_it():
    """Plain fabric leaves stereo gaps; one in the middle is not the body's edge."""
    rng = np.random.default_rng(2)
    body = shaped_person(rng, arm_gap_m=0.05)
    hole = (np.abs(body[:, 0]) < 0.02) & (body[:, 2] > 1.2) & (body[:, 2] < 1.32)
    w = measure_one(body[~hole]).widths
    assert w.chest_m == pytest.approx(0.32, abs=0.015)
    assert w.shoulder_m == pytest.approx(0.46, abs=0.015)


def test_a_width_needs_several_frames():
    one = BodyWidths(shoulder_m=0.46, chest_m=0.32, waist_m=None, hip_m=0.35)
    assert summarise_widths([one] * 4)["shoulderWidthCm"] is None
    out = summarise_widths([one] * 6)
    assert out["shoulderWidthCm"] == pytest.approx(46.0)
    assert out["waistWidthCm"] is None


def test_the_result_carries_widths_from_standing_frames_only():
    from estimator import Subject

    session = Session()
    standing = BodyWidths(shoulder_m=0.46, chest_m=0.32, waist_m=0.28, hip_m=0.35)
    leaning = BodyWidths(shoulder_m=0.60, chest_m=0.50, waist_m=0.45, hip_m=0.50)
    for _ in range(20):
        session.add([Subject(height_m=1.74, points=5000, distance_m=1.1, widths=standing)])
    for _ in range(15):
        session.add([Subject(height_m=1.50, points=5000, distance_m=0.9, widths=leaning)])
    result = session.result()
    assert result["heightCm"] == pytest.approx(174.0)
    assert result["shoulderWidthCm"] == pytest.approx(46.0)
    assert result["waistWidthCm"] == pytest.approx(28.0)


def _box(rng, x0, x1, y0, y1, height_m, density=20_000.0):
    """A solid object's front and sides — a desk, a chair, the kiosk body."""
    faces = []
    for x in (x0, x1):
        n = int((y1 - y0) * height_m * density)
        faces.append(np.column_stack([np.full(n, x), rng.uniform(y0, y1, n), rng.uniform(0, height_m, n)]))
    n = int((x1 - x0) * height_m * density)
    faces.append(np.column_stack([rng.uniform(x0, x1, n), np.full(n, y0), rng.uniform(0, height_m, n)]))
    return np.concatenate(faces)


def test_a_visitor_standing_beside_an_object_is_still_measured():
    """Dev PC, 2026-10-08: half of a test's frames were lost to "footprint too
    wide" — the visitor merged with a ~130 cm object 0.4 m to one side."""
    rng = np.random.default_rng(21)
    body = shaped_person(rng, arm_gap_m=0.05)
    beside = _box(rng, 0.42, 1.1, -0.3, 0.3, 1.3)  # 15 cm clear of the right arm
    s = measure_one(np.concatenate([body, beside]))
    assert s.height_m == pytest.approx(1.75, abs=0.03)
    assert s.widths.shoulder_m == pytest.approx(0.46, abs=0.015)
    # The object's edge must not be read as a right arm and widen the hip.
    assert s.widths.hip_m is None or s.widths.hip_m == pytest.approx(0.35, abs=0.015)


def test_a_raised_arm_is_not_a_shoulder():
    from widths import body_widths

    rng = np.random.default_rng(22)
    # A slab 76 cm wide at shoulder height on a 174 cm visitor.
    n = 4000
    lat = rng.uniform(-0.38, 0.38, n)
    h = rng.uniform(0.78 * 1.74, 0.83 * 1.74, n)
    w = body_widths(h, lat, np.zeros(n), 1.74)
    assert w.shoulder_m is None


def test_a_cabinet_in_front_of_the_camera_is_not_a_person():
    """The dev PC's ~130 cm object was recorded as a 130 cm visitor: tall enough,
    person-sized footprint, a "torso" — but no head on shoulders."""
    rng = np.random.default_rng(23)
    cabinet = _box(rng, -0.3, 0.3, -0.25, 0.25, 1.3)
    cam = place(np.concatenate([floor(rng), cabinet]), roll_deg=90.0, distance_m=1.3)
    frame = fit_floor(cam, gravity_in_camera_frame(roll_deg=90.0))
    rejected = []
    subjects = find_subjects(frame, cam, *ZONE, rejections=rejected, forward=forward_in_camera_frame(roll_deg=90.0))
    assert subjects == []
    assert any("no head" in r.reason for r in rejected)
