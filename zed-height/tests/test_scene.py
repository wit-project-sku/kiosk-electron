from estimator import Rejection
from overlay import head_in_view
from scene import Background, heads_in_view, without_objects
from test_overlay import INTRINSICS, LEVEL, standing_at


def test_learned_object_is_ignored_but_a_person_beside_it_is_not(tmp_path):
    background = Background(tmp_path / "background.json")
    shelf = standing_at(LEVEL, 2.7, 1.54)
    # Seen in every empty-room frame except one: furniture.
    assert background.learn([[shelf]] * 11 + [[]]) == 1

    rejected: list[Rejection] = []
    visitor = standing_at(LEVEL, 2.0, 1.75)
    assert without_objects([shelf, visitor], background, rejected) == [visitor]
    assert rejected[0].reason.startswith("a learned object")
    # Survives a restart.
    assert Background(tmp_path / "background.json").is_static(shelf)


def test_someone_passing_during_calibration_is_not_learned(tmp_path):
    background = Background(tmp_path / "background.json")
    walker = standing_at(LEVEL, 2.0, 1.75)
    assert background.learn([[walker]] * 2 + [[]] * 10) == 0


def test_head_cut_off_when_too_close_to_a_level_camera():
    # Lens 1.2 m up, 0.5 m away: the crown of a 1.75 m person is far above the frame.
    close = standing_at(LEVEL, 0.5, 1.75)
    assert not head_in_view(close, LEVEL, INTRINSICS)
    rejected: list[Rejection] = []
    assert heads_in_view([close, standing_at(LEVEL, 2.0, 1.75)], LEVEL, INTRINSICS, rejected)[0].distance_m == 2.0
    assert rejected[0].reason.startswith("head out of view")
