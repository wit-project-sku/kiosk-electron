import numpy as np

from estimator import Subject
from geometry import FloorFrame
from overlay import display_rotation, floor_basis, head_in_view
from widths import BodyWidths

# A level camera 1.2 m above the floor, IMAGE axes (x right, y down, z forward).
LEVEL = FloorFrame(normal=np.array([0.0, -1.0, 0.0]), offset=1.2)
INTRINSICS = (700.0, 700.0, 640.0, 360.0, 1280, 720)


def standing_at(frame: FloorFrame, ahead_m: float, height_m: float) -> Subject:
    u, v = floor_basis(frame)
    point = np.array([0.0, 0.0, ahead_m])
    return Subject(
        height_m=height_m,
        points=500,
        distance_m=ahead_m,
        widths=BodyWidths(shoulder_m=0.45, chest_m=0.32, waist_m=None, hip_m=0.34),
        centre_xy=(float(point @ u), float(point @ v)),
    )


def test_head_in_view_at_distance_and_cut_off_up_close():
    assert head_in_view(standing_at(LEVEL, 3.0, 1.75), LEVEL, INTRINSICS)
    # 0.55 m above a level lens at 0.5 m is far outside a 68° vertical view.
    assert not head_in_view(standing_at(LEVEL, 0.5, 1.75), LEVEL, INTRINSICS)


def test_rotation_turns_floor_to_the_bottom():
    assert display_rotation(LEVEL) == 0
    # Jeju mount: up points to image-left, so turn the picture 90° clockwise.
    assert display_rotation(FloorFrame(normal=np.array([-1.0, 0.0, 0.0]), offset=1.2)) == 90
    assert display_rotation(FloorFrame(normal=np.array([1.0, 0.0, 0.0]), offset=1.2)) == 270
    assert display_rotation(FloorFrame(normal=np.array([0.0, 1.0, 0.0]), offset=1.2)) == 180
