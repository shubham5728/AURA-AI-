"""Tests for score history and the trend read from it.

A trend arrow is a claim about direction. These pin the cases where the data
cannot support one, because that is where a dashboard is tempted to show a
reassuring zero instead of admitting it does not know.
"""

from datetime import date, timedelta

from app.models import ScoreSnapshot
from app.services import score_history
from app.services.scoring import HealthState, MarkerReading, calculate_score


def snapshot(db, user, days_ago: int, score: int, assessed: int = 3):
    db.add(ScoreSnapshot(
        user_id=user.id,
        date=date.today() - timedelta(days=days_ago),
        score=score,
        assessed_areas=assessed,
        total_areas=6,
    ))
    db.commit()


def test_todays_score_is_recorded(db_session, test_user):
    result = calculate_score(HealthState(bmi=22.0))
    score_history.record(db_session, test_user, result)

    rows = db_session.query(ScoreSnapshot).filter(
        ScoreSnapshot.user_id == test_user.id
    ).all()
    assert len(rows) == 1
    assert rows[0].score == result.score


def test_the_same_day_is_overwritten_not_appended(db_session, test_user):
    """The score moves as data is added; the day's record is where it ended up."""
    score_history.record(db_session, test_user, calculate_score(HealthState(bmi=22.0)))
    score_history.record(db_session, test_user, calculate_score(HealthState(bmi=31.0)))

    rows = db_session.query(ScoreSnapshot).filter(
        ScoreSnapshot.user_id == test_user.id
    ).all()
    assert len(rows) == 1
    assert rows[0].score == calculate_score(HealthState(bmi=31.0)).score


def test_a_user_with_no_score_records_nothing(db_session, test_user):
    """An unassessed account has no score, so there is nothing to plot."""
    score_history.record(db_session, test_user, calculate_score(HealthState()))
    assert db_session.query(ScoreSnapshot).count() == 0


def test_change_is_measured_across_the_window(db_session, test_user):
    snapshot(db_session, test_user, days_ago=6, score=88)
    snapshot(db_session, test_user, days_ago=0, score=91)

    result = score_history.trend(db_session, test_user)
    assert result.change == 3
    assert result.days_recorded == 2


def test_a_decline_is_reported_as_a_decline(db_session, test_user):
    snapshot(db_session, test_user, days_ago=5, score=80)
    snapshot(db_session, test_user, days_ago=0, score=72)
    assert score_history.trend(db_session, test_user).change == -8


def test_one_reading_is_not_a_trend(db_session, test_user):
    """Reporting zero would claim the score held steady when it has been seen
    once. A new user must see "not enough history", not "no change"."""
    snapshot(db_session, test_user, days_ago=0, score=91)

    result = score_history.trend(db_session, test_user)
    assert result.change is None
    assert result.days_recorded == 1


def test_no_change_is_shown_when_coverage_moved(db_session, test_user):
    """A 90 covering one area and a 90 covering six are not the same score.

    The difference between them measures what was looked at, not what changed
    in the person -- so it is withheld and the coverage change is flagged.
    """
    snapshot(db_session, test_user, days_ago=6, score=100, assessed=1)
    snapshot(db_session, test_user, days_ago=0, score=74, assessed=5)

    result = score_history.trend(db_session, test_user)
    assert result.coverage_changed is True
    assert result.change is None


def test_older_snapshots_fall_outside_the_window(db_session, test_user):
    snapshot(db_session, test_user, days_ago=30, score=50)
    snapshot(db_session, test_user, days_ago=1, score=90)
    snapshot(db_session, test_user, days_ago=0, score=92)

    result = score_history.trend(db_session, test_user)
    assert result.days_recorded == 2
    assert result.change == 2  # against day -1, not the 30-day-old reading


def test_points_come_back_in_date_order(db_session, test_user):
    for days, score in ((0, 92), (4, 85), (2, 88)):
        snapshot(db_session, test_user, days_ago=days, score=score)

    points = score_history.trend(db_session, test_user).points
    assert [p.score for p in points] == [85, 88, 92]


def test_gaps_are_preserved_rather_than_filled(db_session, test_user):
    """History exists only for days the app was opened. A missing day means
    nobody looked, and the series must not imply the score was flat."""
    snapshot(db_session, test_user, days_ago=6, score=80)
    snapshot(db_session, test_user, days_ago=0, score=86)

    points = score_history.trend(db_session, test_user).points
    assert len(points) == 2
    assert (points[1].date - points[0].date).days == 6


def test_history_is_per_user(db_session, test_user):
    from app.models import User

    other = User(firebase_uid="other", email="other@aura.health")
    db_session.add(other)
    db_session.commit()

    snapshot(db_session, test_user, days_ago=0, score=90)
    assert score_history.trend(db_session, other).days_recorded == 0
