"""Derived values for the Digital Twin.

Every consumer -- the dashboard, the health score, the AI context builder --
reads age and BMI from here. Computing them in one place is what keeps the
dashboard and the chatbot from ever disagreeing about the same user.
"""

from datetime import date, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import Biomarker, DailyLog, Medication, Profile, Report, User
from app.schemas import ProfileOut, TwinContext
from app.services.interactions import find_interactions
from app.services.reference_ranges import display_name
from app.services.scoring import HealthState, MarkerReading

# Lifestyle metrics are averaged over this window. Long enough to smooth out a
# single bad night, short enough to reflect current behaviour rather than
# history the user has already moved past.
LIFESTYLE_WINDOW_DAYS = 7


def calculate_age(dob: date, on: Optional[date] = None) -> int:
    on = on or date.today()
    # Subtract one if this year's birthday has not happened yet.
    return on.year - dob.year - ((on.month, on.day) < (dob.month, dob.day))


def calculate_bmi(height_cm: float, weight_kg: float) -> Optional[float]:
    if height_cm <= 0:
        return None
    height_m = height_cm / 100
    return round(weight_kg / (height_m**2), 1)


def profile_to_out(profile: Profile) -> ProfileOut:
    return ProfileOut(
        dob=profile.dob,
        sex=profile.sex,
        height_cm=profile.height_cm,
        weight_kg=profile.weight_kg,
        conditions=profile.conditions or [],
        allergies=profile.allergies or [],
        goals=profile.goals or [],
        age=calculate_age(profile.dob),
        bmi=calculate_bmi(profile.height_cm, profile.weight_kg),
    )


def build_twin_context(profile: Profile) -> TwinContext:
    """Produce the de-identified snapshot that may leave our backend.

    Name, email, and exact date of birth are dropped here and nowhere else --
    this function is the single boundary between stored data and what a
    third-party model is allowed to see.
    """
    return TwinContext(
        age=calculate_age(profile.dob),
        sex=profile.sex,
        bmi=calculate_bmi(profile.height_cm, profile.weight_kg),
        conditions=profile.conditions or [],
        allergies=profile.allergies or [],
        goals=profile.goals or [],
    )


def latest_markers(db: Session, user_id: int) -> List[MarkerReading]:
    """The most recent reading for each distinct marker.

    Scoring judges current health, so a marker that appears in five reports must
    contribute once, from its newest value. Rows are ordered oldest-first and
    written into a dict keyed by name, so each later reading overwrites the one
    before it and the newest survives.
    """
    rows = (
        db.query(Biomarker)
        .join(Report, Biomarker.report_id == Report.id)
        .filter(Report.user_id == user_id)
        .order_by(Biomarker.measured_at.asc().nullsfirst(), Biomarker.id.asc())
        .all()
    )

    newest = {}
    for marker in rows:
        newest[marker.name] = MarkerReading(
            name=marker.name,
            label=display_name(marker.name),
            value=marker.value,
            unit=marker.unit,
            ref_low=marker.ref_low,
            ref_high=marker.ref_high,
            flag=marker.flag,
            measured_on=marker.measured_at.isoformat() if marker.measured_at else None,
        )
    return list(newest.values())


def build_health_state(db: Session, user: User) -> HealthState:
    """Assemble the scoring input from stored data.

    All database access for scoring happens here. `calculate_score` stays pure,
    which is what lets the simulator reuse it with modified inputs.
    """
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    bmi = calculate_bmi(profile.height_cm, profile.weight_kg) if profile else None

    cutoff = date.today() - timedelta(days=LIFESTYLE_WINDOW_DAYS)
    logs = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id, DailyLog.date >= cutoff)
        .all()
    )

    def average(attribute: str) -> Optional[float]:
        # Averaged over the days that actually carry this metric. A user who
        # logs steps but not water must not be treated as drinking nothing.
        values = [
            getattr(log, attribute)
            for log in logs
            if getattr(log, attribute) is not None
        ]
        return sum(values) / len(values) if values else None

    medications = db.query(Medication).filter(Medication.user_id == user.id).all()
    conflicts = find_interactions([m.drug_name for m in medications])

    return HealthState(
        bmi=bmi,
        markers=latest_markers(db, user.id),
        avg_sleep_hours=average("sleep_hours"),
        avg_steps=average("steps"),
        avg_water_ml=average("water_ml"),
        logged_days=len(logs),
        medication_conflicts=conflicts,
        has_medications=bool(medications),
    )
