"""Derived values for the Digital Twin.

Every consumer -- the dashboard, the health score, the AI context builder --
reads age and BMI from here. Computing them in one place is what keeps the
dashboard and the chatbot from ever disagreeing about the same user.
"""

from datetime import date
from typing import Optional

from app.models import Profile
from app.schemas import ProfileOut, TwinContext


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
