"""
body.py against a person whose dimensions are known exactly.

A body is built from elliptic cross-sections stacked by height (torso, neck,
head) plus two arms hanging beside it, and ray-cast into a 1280x720 depth image
through the ZED 2i's 2.1 mm lens. MediaPipe is not needed: its two outputs, the
mask and the landmarks, are produced by the same geometry.
"""

import numpy as np
import pytest

from body import UprightFrame, _ellipse_perimeter, fit_semi_depth, measure_person, runs, torso_run
from geometry import FloorFrame

W, H = 1280, 720
F = 527.5
INTRINSICS = (F, F, W / 2, H / 2, W, H)
FORWARD = np.array([0.0, 0.0, 1.0])

# (from height, to height, half-width a, half-depth d) in metres; top of head 1.75.
SECTIONS = [
    (0.00, 0.85, 0.15, 0.11),
    (0.85, 1.00, 0.18, 0.12),  # hips: 36 cm wide
    (1.00, 1.12, 0.145, 0.10),  # waist: 29 cm wide
    (1.12, 1.33, 0.17, 0.12),  # chest: 34 cm wide
    (1.33, 1.47, 0.25, 0.12),  # shoulders, deltoid to deltoid: 50 cm
    (1.47, 1.56, 0.06, 0.06),
    (1.56, 1.75, 0.08, 0.10),
]
# 8 cm arms hang from the deltoids, touching the chest at the armpit. In the
# stance the stream asks for ("arms a little out, like an A") they spread
# outward going down, so hands clear the hips.
ARM_X, ARM_R, ARM_TOP, ARM_BOTTOM = 0.21, 0.04, 1.40, 0.80
A_POSE_SPREAD = 0.10  # metres outward per metre down


def section(h):
    a = np.full(h.shape, np.nan)
    d = np.full(h.shape, np.nan)
    for lo, hi, sa, sd in SECTIONS:
        m = (h >= lo) & (h < hi)
        a[m], d[m] = sa, sd
    return a, d


def hit(dx, dz_axis, cx, a, d, distance):
    """Nearest z where the ray x = dx·z meets the ellipse ((x−cx)/a)² + ((z−D)/d)² = 1."""
    A = (dx / a) ** 2 + 1 / d**2
    B = -2 * dx * cx / a**2 - 2 * distance / d**2
    C = (cx / a) ** 2 + (distance / d) ** 2 - 1
    disc = B**2 - 4 * A * C
    z = (-B - np.sqrt(np.where(disc >= 0, disc, np.nan))) / (2 * A)
    return np.where(disc >= 0, z, np.nan)


def scene(distance=2.0, camera_h=1.2, spread=A_POSE_SPREAD, arm_bottom=ARM_BOTTOM, wrist_h=0.84):
    cols, rows = np.meshgrid(np.arange(W) + 0.5, np.arange(H) + 0.5)
    dx, dy = (cols - W / 2) / F, (rows - H / 2) / F
    h = camera_h - dy * distance  # height where the ray passes the body plane
    a, d = section(h)
    z = hit(dx, None, 0.0, a, d, distance)
    arm = (h >= arm_bottom) & (h <= ARM_TOP)
    arm_x = lambda height: ARM_X + spread * (ARM_TOP - height)  # noqa: E731
    for side in (-1, 1):
        za = hit(dx, None, side * arm_x(h), ARM_R, ARM_R, distance)
        za = np.where(arm, za, np.nan)
        z = np.where(np.isnan(z) | (za < z), za, z)
    xyz = np.stack([dx * z, dy * z, z], axis=-1)
    mask = np.isfinite(z)
    # The floor (y = camera_h in camera coordinates) wherever the body is not.
    with np.errstate(divide="ignore"):
        z_floor = np.where(dy > 0, camera_h / dy, np.inf)
    ground = ~mask & (z_floor < 5.0)
    xyz[ground] = np.stack([dx * z_floor, dy * z_floor, z_floor], axis=-1)[ground]

    def px(x, height, depth=distance):
        return [F * x / depth + W / 2, F * (camera_h - height) / depth + H / 2, 1.0]

    lm = np.zeros((33, 3))
    lm[0] = px(0.0, 1.66, distance - 0.10)  # nose
    lm[7], lm[8] = px(0.07, 1.66), px(-0.07, 1.66)  # ears
    lm[11], lm[12] = px(0.18, 1.43), px(-0.18, 1.43)  # shoulder joints
    lm[13], lm[14] = px(arm_x(1.12), 1.12), px(-arm_x(1.12), 1.12)  # elbows
    lm[15], lm[16] = px(arm_x(wrist_h), wrist_h), px(-arm_x(wrist_h), wrist_h)  # wrists
    lm[23], lm[24] = px(0.10, 0.92), px(-0.10, 0.92)  # hips
    lm[27], lm[28] = px(0.07, 0.08), px(-0.07, 0.08)  # ankles
    lm[29], lm[30] = px(0.07, 0.02), px(-0.07, 0.02)  # heels
    floor =FloorFrame(normal=np.array([0.0, -1.0, 0.0]), offset=camera_h)
    return xyz, mask, lm, floor


@pytest.fixture(scope="module")
def measured():
    xyz, mask, lm, floor = scene()
    frame = UprightFrame(np.zeros((H, W, 3), np.uint8), xyz, 0, INTRINSICS)
    subject, why = measure_person(lm, mask, frame, floor, FORWARD, (0.8, 3.5), 0.5)
    assert subject is not None, why
    return subject


def test_height_within_two_cm(measured):
    assert measured.height_m == pytest.approx(1.75, abs=0.02)
    assert measured.drawing["headInView"]


@pytest.mark.parametrize("error_m", [-0.34, 0.12])
def test_height_comes_from_the_floor_at_the_feet(error_m):
    # A calibration that found a desk (or a camera moved since) is off by the
    # same amount for everyone; the floor beside the shoes is not.
    xyz, mask, lm, floor = scene()
    stale = FloorFrame(normal=floor.normal, offset=floor.offset + error_m)
    frame = UprightFrame(np.zeros((H, W, 3), np.uint8), xyz, 0, INTRINSICS)
    subject, why = measure_person(lm, mask, frame, stale, FORWARD, (0.8, 3.5), 0.5)
    assert subject is not None, why
    assert subject.height_m == pytest.approx(1.75, abs=0.02)
    assert subject.drawing["floorCm"] == pytest.approx(error_m * 100, abs=1.0)


def test_feet_out_of_view_keep_the_calibration():
    xyz, mask, lm, floor = scene()
    lm[27:33, 2] = 0.0
    frame = UprightFrame(np.zeros((H, W, 3), np.uint8), xyz, 0, INTRINSICS)
    subject, why = measure_person(lm, mask, frame, floor, FORWARD, (0.8, 3.5), 0.5)
    assert subject is not None, why
    assert subject.drawing["floorCm"] is None
    assert subject.height_m == pytest.approx(1.75, abs=0.02)


def test_widths_follow_the_body_not_the_arms(measured):
    assert measured.drawing["armsTouching"] == []
    w = measured.widths
    assert w.shoulder_m == pytest.approx(0.50, abs=0.015)
    assert w.chest_m == pytest.approx(0.34, abs=0.012)  # arms 1 cm away are not chest
    assert w.waist_m == pytest.approx(0.29, abs=0.012)
    assert w.hip_m == pytest.approx(0.36, abs=0.012)


def test_girths_use_this_bodys_depth(measured):
    g = measured.girths
    assert g.chest_m == pytest.approx(_ellipse_perimeter(0.17, 0.12), rel=0.04)
    assert g.waist_m == pytest.approx(_ellipse_perimeter(0.145, 0.10), rel=0.04)
    assert g.hip_m == pytest.approx(_ellipse_perimeter(0.18, 0.12), rel=0.04)


def test_sideways_camera_measures_the_same():
    xyz, mask, lm, floor = scene()
    # The same view through a camera turned 90°: raw image is the upright one
    # turned counter-clockwise, and the display turns it back clockwise.
    raw_xyz = np.rot90(xyz, 1)
    raw_mask = np.rot90(mask, 1)
    frame = UprightFrame(np.zeros((W, H, 3), np.uint8), raw_xyz, 90, (F, F, H / 2, W / 2, H, W))
    assert np.array_equal(np.rot90(raw_mask, -1), mask)
    subject, why = measure_person(lm, mask, frame, floor, FORWARD, (0.8, 3.5), 0.5)
    assert subject is not None, why
    assert subject.widths.chest_m == pytest.approx(0.34, abs=0.012)


@pytest.mark.parametrize("rotate", [90, 270])
def test_kiosk_mount_on_its_side(rotate):
    # The kiosk mounts the ZED turned 90°. A turned camera sees the same scene
    # with its image AND its 3D axes turned: build that raw view, check the
    # floor it implies is turned back the right way, and that every part of
    # the measurement — floor at the feet, arm crease, hand cut, girths —
    # gives the upright answers. Arms straight down, hands beside the hips,
    # calibration 34 cm off.
    from overlay import display_rotation

    xyz, mask, lm, floor = scene(spread=0.0, arm_bottom=0.86, wrist_h=0.98)
    k = rotate // 90
    x, y, z = xyz[..., 0], xyz[..., 1], xyz[..., 2]
    # Upright column runs along raw −y (k=1) or +y (k=3); upright row along raw ±x.
    raw_pts = np.stack([y, -x, z], axis=-1) if k == 1 else np.stack([-y, x, z], axis=-1)
    raw_normal = np.array([-1.0, 0.0, 0.0]) if k == 1 else np.array([1.0, 0.0, 0.0])
    stale = FloorFrame(normal=raw_normal, offset=floor.offset - 0.34)
    assert display_rotation(stale) == rotate

    frame = UprightFrame(np.zeros((W, H, 3), np.uint8), np.rot90(raw_pts, k), rotate, (F, F, H / 2, W / 2, H, W))
    assert np.allclose(frame.xyz[..., 2], z, equal_nan=True)
    subject, why = measure_person(lm, mask, frame, stale, FORWARD, (0.8, 3.5), 0.5)
    assert subject is not None, why
    assert subject.height_m == pytest.approx(1.75, abs=0.02)
    assert subject.drawing["floorCm"] == pytest.approx(-34, abs=1.0)
    assert subject.widths.chest_m == pytest.approx(0.34, abs=0.015)
    assert subject.drawing["fallback"]["widths"].hip_m == pytest.approx(0.36, abs=0.045)
    assert subject.girths.chest_m == pytest.approx(_ellipse_perimeter(0.17, 0.12), rel=0.06)


def test_head_out_of_view_is_flagged():
    # 68.6° view, lens 1.0 m up, 1 m away: the top of a 1.75 m head is outside it.
    xyz, mask, lm, floor = scene(distance=1.0, camera_h=1.0)
    frame = UprightFrame(np.zeros((H, W, 3), np.uint8), xyz, 0, INTRINSICS)
    subject, _ = measure_person(lm, mask, frame, floor, FORWARD, (0.8, 3.5), 0.5)
    assert subject is None or not subject.drawing["headInView"]


def test_runs_and_arm_cut():
    row = np.zeros(100, bool)
    row[20:60] = True  # torso
    row[62:70] = True  # arm 2 px clear: its own run
    assert runs(row) == [(20, 59), (62, 69)]
    assert torso_run(runs(row), 40.0, [], 4.5) == (20, 59)
    row[60:62] = True  # arm touching: cut at the arm's line
    assert torso_run(runs(row), 40.0, [65.0], 4.5) == (20, 60)


def test_touching_arms_are_cut_at_the_crease():
    xyz, mask, lm, floor = scene(spread=0.0)  # arms straight down, against the chest
    frame = UprightFrame(np.zeros((H, W, 3), np.uint8), xyz, 0, INTRINSICS)
    subject, why = measure_person(lm, mask, frame, floor, FORWARD, (0.8, 3.5), 0.5)
    assert subject is not None, why
    # No gap in the outline, but depth shows where torso ends and arm begins:
    # the chest is measured, not guessed from the landmark line.
    assert "chest" not in subject.drawing["armsTouching"]
    assert subject.widths.chest_m == pytest.approx(0.34, abs=0.015)


def test_depth_crease_is_the_torso_edge():
    from body import depth_arm_edges

    # 3 px per cm, as at 1.5 m. Torso 0..40 cm curving back to +8 cm at its
    # edges, then an arm 40..48 cm whose front comes forward to +4 cm.
    x = np.arange(145) / 3.0
    s = (x - 20) / 20.0
    z = 2.0 + 0.08 * (1 - np.sqrt(1 - np.clip(s, -1, 1) ** 2))
    arm = x > 40
    z[arm] = 2.04 + 0.04 * np.abs(x[arm] - 44) / 4
    left, right = depth_arm_edges(z, np.ones(x.size, bool), 0, x.size - 1, 60.0, 300.0)
    assert left is None  # no arm on this side: the outline stands
    assert right is not None and 38 <= x[right] <= 40.5
    # A torso alone has no crease.
    torso = x <= 40
    assert depth_arm_edges(z[torso], torso[torso], 0, int(torso.sum()) - 1, 60.0, 300.0) == (None, None)


def test_hands_beside_the_hips_are_not_hip():
    # Arms straight down against the hips, the wrist landmark at 0.98 m (a bent
    # wrist) and the hand hanging on to 0.86 m, beside the hip band.
    xyz, mask, lm, floor = scene(spread=0.0, arm_bottom=0.86, wrist_h=0.98)
    frame = UprightFrame(np.zeros((H, W, 3), np.uint8), xyz, 0, INTRINSICS)
    subject, why = measure_person(lm, mask, frame, floor, FORWARD, (0.8, 3.5), 0.5)
    assert subject is not None, why
    assert subject.drawing["fallback"]["widths"].hip_m == pytest.approx(0.36, abs=0.045)


@pytest.mark.parametrize(
    "waist_w, waist_front, draped",
    [
        (0.30, 1.98, False),  # a waist narrower than the chest is the waist
        (0.37, 1.99, True),  # as wide as the chest, front 1 cm ahead: a top hanging from the chest
        (0.37, 1.92, False),  # as wide, front 8 cm ahead: a belly
    ],
)
def test_waist_draped(waist_w, waist_front, draped):
    from body import _waist_draped

    bands = {"chest": {"front_z": 2.0}, "waist": {"front_z": waist_front}}
    assert _waist_draped(bands, {"chest": 0.36, "waist": waist_w}) is draped
    assert _waist_draped(bands, {"chest": None, "waist": waist_w}) is None


def test_semi_depth_fit_recovers_an_ellipse():
    s = np.linspace(-0.95, 0.95, 400)
    z = 2.12 - 0.12 * np.sqrt(1 - s**2)
    z0, d = fit_semi_depth(s, z)
    assert z0 == pytest.approx(2.12, abs=1e-6) and d == pytest.approx(0.12, abs=1e-6)


def test_a_broken_band_is_not_a_torso():
    """demo-outfit 2026-10-22: a 9.1 cm waist on a 177 cm visitor; the rest read 35-37."""
    from body import torso_width_plausible

    assert not torso_width_plausible(0.091, 1.77)
    assert torso_width_plausible(0.367, 1.77)
    assert torso_width_plausible(0.23, 1.50)  # slim 150 cm waist
    assert torso_width_plausible(0.44, 1.70)  # heavy 170 cm hips
    assert not torso_width_plausible(0.70, 1.70)  # two people side by side
