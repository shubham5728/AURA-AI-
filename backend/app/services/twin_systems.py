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
    # Plain-language description of what the test measures. Reused from the
    # explanations already written for the report analyzer.
    explanation: str = ""
    # Past readings, oldest first, for a sparkline. Empty when there is only one.
    history: List[float] = field(default_factory=list)
    # "improving" | "declining" | "steady" | "" -- only set when history and a
    # reference range exist, since direction toward or away from the range is
    # what "improving" means here, not raw movement.
    direction: str = ""
    # A borderline-normal value: inside its range but close to a bound. From the
    # same edge detection the report card uses.
    near_edge: bool = False

    def as_dict(self) -> dict:
        return {
            "label": self.label,
            "value": self.value,
            "unit": self.unit,
            "status": self.status,
            "detail": self.detail,
            "computed": self.computed,
            "explanation": self.explanation,
            "history": self.history,
            "direction": self.direction,
            "near_edge": self.near_edge,
        }


@dataclass
class Related:
    """A link to another system, with the mechanism stated qualitatively.

    Curated clinical knowledge, the same kind that lives in interactions.py and
    heredity.py -- established physiological relationships, not a computed risk
    score. "Low haemoglobin relates to exercise recovery" is a textbook link;
    "fatigue risk +18%" would be an invented number, so the `why` stays
    qualitative and carries no figure.
    """

    key: str
    label: str
    why: str

    def as_dict(self) -> dict:
        return {"key": self.key, "label": self.label, "why": self.why}


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
    #: One line on why this system matters, for the tab and header.
    purpose: str = ""
    metrics: List[Metric] = field(default_factory=list)
    #: What the user would do to populate an empty system.
    unlock_hint: str = ""
    #: Markers this system looks for that have not been measured -- the honest
    #: substitute for a confidence score.
    missing: List[str] = field(default_factory=list)
    #: Other systems this one bears on, so the tabs read as connected.
    relates_to: List[Related] = field(default_factory=list)

    @property
    def has_data(self) -> bool:
        return any(m.value is not None for m in self.metrics)

    @property
    def measured(self) -> int:
        return sum(1 for m in self.metrics if m.value is not None)

    @property
    def abnormal(self) -> int:
        return sum(1 for m in self.metrics if m.status == "attention")

    @property
    def latest_date(self) -> Optional[str]:
        dates = [m.detail.replace("measured ", "") for m in self.metrics
                 if m.detail.startswith("measured ")]
        return max(dates) if dates else None

    def summary(self) -> dict:
        """A one-glance verdict, so the four cards need not be read individually."""
        if not self.has_data:
            return {"headline": "Not assessed yet", "tone": "none"}
        if self.abnormal:
            headline = f"{self.abnormal} of {self.measured} outside range"
            tone = "attention"
        elif any(m.near_edge for m in self.metrics):
            headline = "All within range, some near the edge"
            tone = "good"
        else:
            headline = "All measured values within range"
            tone = "good"
        return {"headline": headline, "tone": tone}

    def as_dict(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "tagline": self.tagline,
            "purpose": self.purpose,
            "accent": self.accent,
            "region": self.region,
            "covered_by": self.covered_by,
            "has_data": self.has_data,
            "unlock_hint": self.unlock_hint,
            "measured": self.measured,
            "abnormal": self.abnormal,
            "latest_date": self.latest_date,
            "missing": self.missing,
            "summary": self.summary(),
            "relates_to": [r.as_dict() for r in self.relates_to],
            "metrics": [m.as_dict() for m in self.metrics],
        }


def _flag_status(flag: str) -> str:
    if flag in {"low", "high"}:
        return "attention"
    if flag == "normal":
        return "good"
    return "unknown"


def _near_edge(value: float, low: Optional[float], high: Optional[float]) -> bool:
    """Inside the range but within 10% of a bound. Same rule as the report card."""
    if low is None or high is None or high <= low:
        return False
    t = (value - low) / (high - low)
    return 0 <= t <= 1 and (t <= 0.1 or t >= 0.9)


def _direction(history: List[float], low: Optional[float], high: Optional[float]) -> str:
    """Whether the marker is moving toward or away from its range.

    "Improving" means the latest reading is closer to the middle of the range
    than the previous one -- raw movement is not enough, since rising HDL is
    good while rising LDL is not. Requires a range and two readings.
    """
    if len(history) < 2 or low is None or high is None:
        return ""
    mid = (low + high) / 2
    prev_gap = abs(history[-2] - mid)
    now_gap = abs(history[-1] - mid)
    if abs(now_gap - prev_gap) < (high - low) * 0.02:
        return "steady"
    return "improving" if now_gap < prev_gap else "declining"


def _marker_metric(markers: dict, history: dict, name: str, label: str) -> Metric:
    """A metric from a lab value, or an empty one if it has not been measured."""
    from app.services.explanations import explain

    m = markers.get(name)
    if m is None:
        return Metric(label=label, value=None, unit="", status="none",
                      explanation=explain(name))

    past = history.get(name, [])
    return Metric(
        label=label,
        value=m.value,
        unit=m.unit or "",
        status=_flag_status(m.flag),
        detail=m.measured_on and f"measured {m.measured_on}" or "",
        explanation=explain(name),
        history=past if len(past) > 1 else [],
        direction=_direction(past, m.ref_low, m.ref_high),
        near_edge=(m.flag == "normal" and _near_edge(m.value, m.ref_low, m.ref_high)),
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


def _marker_history(db: Session, user_id: int) -> dict:
    """Every reading of every marker, oldest first, keyed by canonical name."""
    from app.models import Biomarker, Report

    rows = (
        db.query(Biomarker)
        .join(Report, Biomarker.report_id == Report.id)
        .filter(Report.user_id == user_id)
        .order_by(Biomarker.measured_at.asc().nullsfirst(), Biomarker.id.asc())
        .all()
    )
    history: dict = {}
    for marker in rows:
        history.setdefault(marker.name, []).append(marker.value)
    return history


def build_systems(db: Session, user: User) -> List[System]:
    from app.models import Profile
    from app.services.explanations import explain
    from app.twin import latest_markers

    state = build_health_state(db, user)
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    markers = {m.name: m for m in latest_markers(db, user.id)}
    history = _marker_history(db, user.id)

    def marker(name: str, label: str) -> Metric:
        return _marker_metric(markers, history, name, label)

    def missing_from(names: List[str]) -> List[str]:
        """Markers this system looks for that have not been measured.

        The honest stand-in for a confidence score: an interpretation drawn from
        four of six markers is more complete than one drawn from two, and saying
        which are absent is truthful where a percentage would be invented.
        """
        return [label for key, label in names if key not in markers]

    bmi = state.bmi
    bmi_status = (
        "none" if bmi is None
        else "good" if 18.5 <= bmi <= 24.9
        else "attention"
    )
    bmr = _bmr(state, profile)

    def logged(value: Optional[float], target: float, unit: str, label: str,
               key: str, places: int = 0) -> Metric:
        if value is None:
            return Metric(label=label, value=None, unit=unit, status="none",
                          explanation=explain(key))
        return Metric(
            label=label,
            value=round(value, places),
            unit=unit,
            status="good" if value >= target else "attention",
            detail=f"target {target:g} {unit}",
            explanation=explain(key),
        )

    systems = [
        System(
            key="metabolic",
            label="Metabolic",
            tagline="How your body handles sugar and energy",
            purpose="Tracks how your body processes sugar and burns energy — the "
                    "system behind long-term diabetes and weight risk.",
            accent="#f59e0b",
            region="core",
            covered_by="nutrition",
            unlock_hint="Upload a blood report with HbA1c or glucose, and complete your profile.",
            missing=missing_from([("hba1c", "HbA1c"), ("fasting_glucose", "Fasting glucose")]),
            relates_to=[
                Related("heart", "Heart & lipids",
                        "Raised blood sugar and abnormal lipids often travel together"),
                Related("lifestyle", "Lifestyle",
                        "Activity and diet move blood sugar directly"),
            ],
            metrics=[
                marker("hba1c", "HbA1c"),
                marker("fasting_glucose", "Fasting glucose"),
                Metric("BMI", bmi, "", bmi_status, "healthy 18.5–24.9",
                       computed=True, explanation=explain("bmi")),
                Metric("Basal metabolic rate", bmr, "kcal/day",
                       "good" if bmr else "none", "at rest, estimated",
                       computed=True, explanation=explain("bmr")),
            ],
        ),
        System(
            key="heart",
            label="Heart & lipids",
            tagline="Fats in your blood and cardiovascular risk",
            purpose="Assesses cardiovascular health and long-term heart disease risk "
                    "through the fats carried in your blood.",
            accent="#f472b6",
            region="chest",
            covered_by="doctor",
            unlock_hint="Upload a lipid profile (cholesterol, LDL, HDL, triglycerides).",
            missing=missing_from([
                ("total_cholesterol", "Total cholesterol"), ("ldl", "LDL"),
                ("hdl", "HDL"), ("triglycerides", "Triglycerides"),
            ]),
            relates_to=[
                Related("metabolic", "Metabolic",
                        "Blood sugar and lipids influence each other"),
                Related("lifestyle", "Lifestyle",
                        "Exercise raises HDL and lowers triglycerides"),
            ],
            metrics=[
                marker("total_cholesterol", "Total cholesterol"),
                marker("ldl", "LDL"),
                marker("hdl", "HDL"),
                marker("triglycerides", "Triglycerides"),
            ],
        ),
        System(
            key="blood",
            label="Blood & oxygen",
            tagline="How well your blood carries oxygen",
            purpose="Measures your blood's ability to carry oxygen, which supports "
                    "energy, focus and physical recovery.",
            accent="#38bdf8",
            region="torso",
            covered_by="doctor",
            unlock_hint="Upload a Complete Blood Count.",
            missing=missing_from([
                ("hemoglobin", "Haemoglobin"), ("rbc", "RBC count"),
                ("hct", "Haematocrit"), ("mcv", "MCV"),
            ]),
            relates_to=[
                Related("lifestyle", "Lifestyle",
                        "Oxygen delivery underpins exercise capacity and recovery"),
                Related("organs", "Liver & kidney",
                        "The kidneys signal the body to make red cells"),
            ],
            metrics=[
                marker("hemoglobin", "Haemoglobin"),
                marker("rbc", "RBC count"),
                marker("hct", "Haematocrit"),
                marker("mcv", "MCV"),
            ],
        ),
        System(
            key="organs",
            label="Liver & kidney",
            tagline="How your liver and kidneys are coping",
            purpose="Checks how well your liver and kidneys are filtering and "
                    "processing what passes through your blood.",
            accent="#a78bfa",
            region="abdomen",
            covered_by="doctor",
            unlock_hint="Upload a liver or kidney function test.",
            missing=missing_from([
                ("alt", "ALT"), ("ast", "AST"),
                ("creatinine", "Creatinine"), ("uric_acid", "Uric acid"),
            ]),
            relates_to=[
                Related("metabolic", "Metabolic",
                        "The liver is central to how the body handles sugar and fat"),
                Related("blood", "Blood & oxygen",
                        "Kidney function affects red-cell production"),
            ],
            metrics=[
                marker("alt", "ALT (SGPT)"),
                marker("ast", "AST (SGOT)"),
                marker("creatinine", "Creatinine"),
                marker("uric_acid", "Uric acid"),
            ],
        ),
        System(
            key="lifestyle",
            label="Lifestyle",
            tagline="The habits your score is built from",
            purpose="The daily habits — movement, sleep, hydration — that shape "
                    "almost every other system over time.",
            accent="#4ade80",
            region="legs",
            covered_by="fitness",
            unlock_hint="Log a day of steps, sleep and water.",
            relates_to=[
                Related("metabolic", "Metabolic",
                        "Activity and sleep move blood sugar and weight"),
                Related("heart", "Heart & lipids",
                        "Exercise improves your lipid profile"),
            ],
            metrics=[
                logged(state.avg_steps, 8000, "steps/day", "Steps", "steps"),
                logged(state.avg_sleep_hours, 7, "hrs/night", "Sleep", "sleep", 1),
                logged(state.avg_water_ml, 2500, "ml/day", "Water", "water"),
                marker("tsh", "TSH"),
            ],
        ),
    ]

    return systems
