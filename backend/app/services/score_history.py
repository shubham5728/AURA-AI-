"""Score history: recording it, and reading a trend out of it.

The score was always computed and never kept, so the app could show a number
but never a direction. This is what makes "up 3 since last week" a fact rather
than a flourish.

Two honesty constraints run through the module.

**A gap is not a flat line.** Snapshots exist only for days the app was opened.
Nobody looking on Tuesday does not mean the score held steady on Tuesday, so
the series is returned with its real dates and the caller is told how many days
it actually covers.

**Scores are only comparable at equal coverage.** A 90 assessed on one area and
a 90 assessed on six describe different things. A change between them is
arithmetic, not information, so it is reported as a coverage change instead.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import ScoreSnapshot, User
from app.services.scoring import ScoreResult

# How far back a trend looks.
TREND_WINDOW_DAYS = 7


@dataclass
class TrendPoint:
    date: date
    score: int
    assessed_areas: int


@dataclass
class ScoreTrend:
    points: List[TrendPoint]
    #: Points gained or lost against the oldest comparable snapshot. None when
    #: there is only one reading, or when coverage changed in between.
    change: Optional[int]
    compared_with: Optional[date]
    days_recorded: int
    #: True when the window spans a change in how much was assessed.
    coverage_changed: bool

    def as_dict(self) -> dict:
        return {
            "points": [
                {"date": p.date.isoformat(), "score": p.score, "assessed_areas": p.assessed_areas}
                for p in self.points
            ],
            "change": self.change,
            "compared_with": self.compared_with.isoformat() if self.compared_with else None,
            "days_recorded": self.days_recorded,
            "coverage_changed": self.coverage_changed,
        }


def record(db: Session, user: User, result: ScoreResult) -> None:
    """Store today's score, replacing any earlier value for today.

    Overwriting rather than appending: the score can move several times in a day
    as data is added, and the day's record should be where it ended up.
    """
    if result.score is None:
        return

    assessed = sum(1 for covered in result.coverage.values() if covered)
    today = date.today()

    existing = (
        db.query(ScoreSnapshot)
        .filter(ScoreSnapshot.user_id == user.id, ScoreSnapshot.date == today)
        .first()
    )

    if existing:
        existing.score = result.score
        existing.assessed_areas = assessed
        existing.total_areas = len(result.coverage)
    else:
        db.add(
            ScoreSnapshot(
                user_id=user.id,
                date=today,
                score=result.score,
                assessed_areas=assessed,
                total_areas=len(result.coverage),
            )
        )
    db.commit()


def trend(db: Session, user: User) -> ScoreTrend:
    """The last week of scores, and the change across it."""
    cutoff = date.today() - timedelta(days=TREND_WINDOW_DAYS)
    rows = (
        db.query(ScoreSnapshot)
        .filter(ScoreSnapshot.user_id == user.id, ScoreSnapshot.date >= cutoff)
        .order_by(ScoreSnapshot.date)
        .all()
    )

    points = [TrendPoint(r.date, r.score, r.assessed_areas) for r in rows]

    # One snapshot is a reading, not a trend. Reporting a change of zero would
    # claim the score held steady when it has only been seen once.
    if len(points) < 2:
        return ScoreTrend(points, None, None, len(points), False)

    oldest, newest = points[0], points[-1]
    coverage_changed = oldest.assessed_areas != newest.assessed_areas

    return ScoreTrend(
        points=points,
        # Withheld when coverage moved: the difference would be measuring a
        # change in what was looked at, not a change in health.
        change=None if coverage_changed else newest.score - oldest.score,
        compared_with=oldest.date,
        days_recorded=len(points),
        coverage_changed=coverage_changed,
    )
