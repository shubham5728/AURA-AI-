"""Everything the overview screen needs, in one request.

The dashboard previously made five calls and stitched the results together in
the browser, which meant five chances to fail and a screen that assembled
itself in pieces. It also asked for a resource the backend does not model, so
one of those calls was always empty.
"""

from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import DailyLog, User
from app.services import briefing as briefing_service
from app.services import score_history
from app.services.scoring import calculate_score
from app.twin import build_health_state, latest_markers

router = APIRouter(prefix="/api/overview", tags=["overview"])


class BriefingOut(BaseModel):
    text: str
    # "model" or "computed", so the interface never presents fallback text as
    # generated insight.
    source: str
    score: Optional[int]
    actions: List[str]


class MetricOut(BaseModel):
    key: str
    label: str
    value: Optional[float]
    unit: str
    target: Optional[float]
    # How many of the last seven days carry this metric. A single logged day
    # averaging 3,000 steps is not the same claim as seven days of it, and the
    # card says which it is.
    days_logged: int


class ConcernOut(BaseModel):
    category: str
    reason: str
    evidence: Optional[str]
    points: float


class SignalOut(BaseModel):
    label: str
    value: float
    unit: Optional[str]
    flag: str
    measured_at: Optional[date]


class TrendPointOut(BaseModel):
    date: date
    score: int
    assessed_areas: int


class TrendOut(BaseModel):
    points: List[TrendPointOut]
    # None when there is one reading, or when coverage changed across the
    # window -- a difference between unequal coverage is arithmetic, not news.
    change: Optional[int]
    compared_with: Optional[date]
    days_recorded: int
    coverage_changed: bool


class OverviewOut(BaseModel):
    score: Optional[int]
    score_status: str
    summary: str
    coverage: dict
    briefing: BriefingOut
    trend: TrendOut
    metrics: List[MetricOut]
    concerns: List[ConcernOut]
    signals: List[SignalOut]


@router.get("", response_model=OverviewOut)
def overview(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OverviewOut:
    state = build_health_state(db, user)
    result = calculate_score(state)

    # Recorded on view because there is no scheduler. History therefore covers
    # the days the app was opened, which the trend reports rather than hides.
    score_history.record(db, user, result)
    trend = score_history.trend(db, user)

    brief = briefing_service.build(db, user)

    cutoff = date.today() - timedelta(days=7)
    logs = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id, DailyLog.date >= cutoff)
        .all()
    )

    def logged(attr: str) -> int:
        return sum(1 for log in logs if getattr(log, attr) is not None)

    metrics = [
        MetricOut(key="steps", label="Steps", value=state.avg_steps, unit="per day",
                  target=8000, days_logged=logged("steps")),
        MetricOut(key="sleep", label="Sleep", value=state.avg_sleep_hours, unit="hours",
                  target=7, days_logged=logged("sleep_hours")),
        MetricOut(key="water", label="Water", value=state.avg_water_ml, unit="ml",
                  target=2500, days_logged=logged("water_ml")),
    ]

    concerns = [
        ConcernOut(category=d.category, reason=d.reason, evidence=d.evidence,
                   points=round(d.points, 1))
        for d in result.deductions[:5]
    ]

    # Abnormal results first: on a screen answering "should I worry?", a normal
    # value is not the thing to lead with.
    markers = latest_markers(db, user.id)
    markers.sort(key=lambda m: (m.flag not in {"low", "high"}, m.label))
    signals = [
        SignalOut(label=m.label, value=m.value, unit=m.unit, flag=m.flag,
                  measured_at=date.fromisoformat(m.measured_on) if m.measured_on else None)
        for m in markers[:8]
    ]

    return OverviewOut(
        score=result.score,
        score_status=result.status,
        summary=result.summary,
        coverage=result.coverage,
        briefing=BriefingOut(**brief.as_dict()),
        trend=TrendOut(**trend.as_dict()),
        metrics=metrics,
        concerns=concerns,
        signals=signals,
    )
