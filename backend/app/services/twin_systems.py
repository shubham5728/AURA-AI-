"""The Digital Twin, grouped into physiological systems.

Each system is a real slice of the user's own data -- lab panels, the score's
own components, daily logs, and two values computed from the profile (BMI and
BMR). Nothing here is a sensor reading the product does not have: there is no
heart rate, no HRV, no VO2 max, no stress score, because there is no wearable
and no input for any of them.

A system with no data does not invent a placeholder. It reports `has_data:
false` and names what would fill it, so the interface can say "upload a report
to see this" rather than showing an empty dial that looks broken.

Each system also names the specialist that covers it, drawn from the same five
roles the rest of the app uses. There is no "Cardiology Agent" or "ECG Agent";
those would be invented staff for departments that do not exist.
"""

from dataclasses import dataclass, field
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import User
from app.services.scoring import HealthState
from app.twin import build_health_state, calculate_age, calculate_bmi


@dataclass
class Metric:
    label: str
    value: Optional[float]
    unit: str
    # "good" | "attention" | "unknown" | "none"
    status: str
    detail: str = ""
    # True for values AURA derives rather than reads from a report, so the
    # interface can mark them as calculated rather than measured.
    computed: bool = False

    def as_dict(self) -> dict:
        return {
            "label": self.label,
            "value": self.value,
            "unit": self.unit,
            "status": self.status,
            "detail": self.detail,
            "computed": self.computed,
        }


@dataclass
class System:
    key: str
    label: str
    tagline: str
    accent: str
    #: Which figure region the avatar highlights. Purely an indicator; the
    #: image is not an anatomical render and does not pretend to be.
    region: str
    #: The specialist role that covers this system, from the real five.
    covered_by: str
    metrics: List[Metric] = field(default_factory=list)
    #: What the user would do to populate an empty system.
    unlock_hint: str = ""

    @property
    def has_data(self) -> bool:
        return any(m.value is not None for m in self.metrics)

    def as_dict(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "tagline": self.tagline,
            "accent": self.accent,
            "region": self.region,
            "covered_by": self.covered_by,
            "has_data": self.has_data,
            "unlock_hint": self.unlock_hint,
            "metrics": [m.as_dict() for m in self.metrics],
        }


def _flag_status(flag: str) -> str:
    if flag in {"low", "high"}:
        return "attention"
    if flag == "normal":
        return "good"
    return "unknown"


def _marker_metric(markers: dict, name: str, label: str) -> Metric:
    """A metric from a lab value, or an empty one if it has not been measured."""
    m = markers.get(name)
    if m is None:
        return Metric(label=label, value=None, unit="", status="none")
    return Metric(
        label=label,
        value=m.value,
        unit=m.unit or "",
        status=_flag_status(m.flag),
        detail=m.measured_on and f"measured {m.measured_on}" or "",
    )


def _bmr(state: HealthState, profile) -> Optional[float]:
    """Basal metabolic rate via Mifflin-St Jeor.

    Computable because age, sex, height and weight are all on the profile. It is
    an estimate from an equation, not a measurement, and is flagged `computed`
    so the interface never presents it as a reading.
    """
    if profile is None:
        return None
    age = calculate_age(profile.dob)
    base = 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * age
    if profile.sex == "male":
        return round(base + 5)
    if profile.sex == "female":
        return round(base - 161)
    # No neutral coefficient exists in the equation; average the two rather than
    # pick one.
    return round(base - 78)


def build_systems(db: Session, user: User) -> List[System]:
    from app.models import Profile
    from app.twin import latest_markers

    state = build_health_state(db, user)
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    markers = {m.name: m for m in latest_markers(db, user.id)}

    bmi = state.bmi
    bmi_status = (
        "none" if bmi is None
        else "good" if 18.5 <= bmi <= 24.9
        else "attention"
    )
    bmr = _bmr(state, profile)

    def logged(value: Optional[float], target: float, unit: str, label: str, places: int = 0) -> Metric:
        if value is None:
            return Metric(label=label, value=None, unit=unit, status="none")
        return Metric(
            label=label,
            value=round(value, places),
            unit=unit,
            status="good" if value >= target else "attention",
            detail=f"target {target:g} {unit}",
        )

    systems = [
        System(
            key="metabolic",
            label="Metabolic",
            tagline="How your body handles sugar and energy",
            accent="#f59e0b",
            region="core",
            covered_by="nutrition",
            unlock_hint="Upload a blood report with HbA1c or glucose, and complete your profile.",
            metrics=[
                _marker_metric(markers, "hba1c", "HbA1c"),
                _marker_metric(markers, "fasting_glucose", "Fasting glucose"),
                Metric("BMI", bmi, "", bmi_status, "healthy range 18.5–24.9", computed=True),
                Metric("Basal metabolic rate", bmr, "kcal/day",
                       "good" if bmr else "none",
                       "calories at rest, estimated", computed=True),
            ],
        ),
        System(
            key="heart",
            label="Heart & lipids",
            tagline="Fats in your blood and cardiovascular risk",
            accent="#f472b6",
            region="chest",
            covered_by="doctor",
            unlock_hint="Upload a lipid profile (cholesterol, LDL, HDL, triglycerides).",
            metrics=[
                _marker_metric(markers, "total_cholesterol", "Total cholesterol"),
                _marker_metric(markers, "ldl", "LDL"),
                _marker_metric(markers, "hdl", "HDL"),
                _marker_metric(markers, "triglycerides", "Triglycerides"),
            ],
        ),
        System(
            key="blood",
            label="Blood & oxygen",
            tagline="How well your blood carries oxygen",
            accent="#38bdf8",
            region="torso",
            covered_by="doctor",
            unlock_hint="Upload a Complete Blood Count.",
            metrics=[
                _marker_metric(markers, "hemoglobin", "Haemoglobin"),
                _marker_metric(markers, "rbc", "RBC count"),
                _marker_metric(markers, "hct", "Haematocrit"),
                _marker_metric(markers, "mcv", "MCV"),
            ],
        ),
        System(
            key="organs",
            label="Liver & kidney",
            tagline="How your liver and kidneys are coping",
            accent="#a78bfa",
            region="abdomen",
            covered_by="doctor",
            unlock_hint="Upload a liver or kidney function test.",
            metrics=[
                _marker_metric(markers, "alt", "ALT (SGPT)"),
                _marker_metric(markers, "ast", "AST (SGOT)"),
                _marker_metric(markers, "creatinine", "Creatinine"),
                _marker_metric(markers, "uric_acid", "Uric acid"),
            ],
        ),
        System(
            key="lifestyle",
            label="Lifestyle",
            tagline="The habits your score is built from",
            accent="#4ade80",
            region="legs",
            covered_by="fitness",
            unlock_hint="Log a day of steps, sleep and water.",
            metrics=[
                logged(state.avg_steps, 8000, "steps/day", "Steps"),
                logged(state.avg_sleep_hours, 7, "hours/night", "Sleep", 1),
                logged(state.avg_water_ml, 2500, "ml/day", "Water"),
                _marker_metric(markers, "tsh", "TSH"),
            ],
        ),
    ]

    return systems
