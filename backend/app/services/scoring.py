"""Health Score.

Per Decision 4 in ROADMAP.md this is a transparent weighted formula, not a
model. The reason is practical: the first question anyone asks is "why is my
score 68?", and only an explainable formula can answer it. Every deduction
carries the reason and the evidence that produced it, which also makes the
score directly usable by the Lifestyle Simulator.

Two properties this module guarantees:

**Purity.** `calculate_score` is a function of `HealthState` alone -- no
database, no clock, no I/O. The simulator answers "what if I walked 8,000
steps?" by rebuilding the state with one field changed and calling the same
function, so a simulated score and a real score can never drift apart.

**Honesty about missing data.** A component with no data is not scored as
perfect; it is left unassessed and reported in `coverage`. Otherwise an empty
account would score 100, which is the single most misleading thing a health
app can display.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional

# Component ceilings. Sum to 100 so a fully-assessed score has the full range.
MAX_DEDUCTIONS = {
    "labs": 30,
    "sleep": 20,
    "activity": 20,
    "body": 15,
    "hydration": 10,
    "medication": 5,
}

# Targets used for lifestyle scoring.
SLEEP_TARGET_LOW = 7.0
SLEEP_TARGET_HIGH = 9.0
STEP_TARGET = 8000
WATER_TARGET_ML = 2500
BMI_HEALTHY_LOW = 18.5
BMI_HEALTHY_HIGH = 24.9

# Some markers carry more weight for long-term risk than others. A raised HbA1c
# matters more than a mildly low vitamin D, and a flat weighting would let three
# minor deficiencies outrank one serious signal.
MARKER_WEIGHTS: Dict[str, float] = {
    "hba1c": 1.5,
    "fasting_glucose": 1.4,
    "ldl": 1.2,
    "triglycerides": 1.1,
    "total_cholesterol": 1.0,
    "hdl": 1.0,
    "creatinine": 1.3,
    "hemoglobin": 1.2,
    "tsh": 1.0,
    "alt": 1.0,
    "ast": 1.0,
    "vitamin_d": 0.7,
    "vitamin_b12": 0.7,
    "uric_acid": 0.8,
}
DEFAULT_MARKER_WEIGHT = 0.8

BASE_MARKER_POINTS = {"mild": 2.0, "moderate": 4.0, "severe": 7.0}


@dataclass
class MarkerReading:
    name: str
    label: str
    value: float
    unit: Optional[str] = None
    ref_low: Optional[float] = None
    ref_high: Optional[float] = None
    flag: str = "unknown"
    measured_on: Optional[str] = None


@dataclass
class HealthState:
    """Everything the score depends on, and nothing else.

    Lifestyle averages are Optional rather than defaulted to zero: "did not log"
    and "did not move" are different facts, and conflating them would penalise
    users for not tracking.
    """

    bmi: Optional[float] = None
    markers: List[MarkerReading] = field(default_factory=list)
    avg_sleep_hours: Optional[float] = None
    avg_steps: Optional[float] = None
    avg_water_ml: Optional[float] = None
    logged_days: int = 0
    medication_conflicts: List[dict] = field(default_factory=list)
    has_medications: bool = False


@dataclass
class Deduction:
    category: str
    points: float
    reason: str
    evidence: Optional[str] = None

    def as_dict(self) -> dict:
        return {
            "category": self.category,
            "points": round(self.points, 1),
            "reason": self.reason,
            "evidence": self.evidence,
        }


@dataclass
class ScoreResult:
    score: Optional[int]
    status: str  # "scored" | "insufficient_data"
    deductions: List[Deduction]
    coverage: Dict[str, bool]
    max_possible_deduction: int
    summary: str

    def as_dict(self) -> dict:
        return {
            "score": self.score,
            "status": self.status,
            "summary": self.summary,
            "max_possible_deduction": self.max_possible_deduction,
            "coverage": self.coverage,
            "deductions": [d.as_dict() for d in self.deductions],
        }


def _severity(reading: MarkerReading) -> str:
    """Grade how far outside its range a value sits.

    Scaled by the width of the reference range where one exists, so "10 over"
    means something different for cholesterol than for HbA1c. Falls back to a
    percentage of the breached bound for open-ended ranges like "< 200".
    """
    low, high, value = reading.ref_low, reading.ref_high, reading.value

    if low is not None and high is not None and high > low:
        width = high - low
        excess = (value - high) if value > high else (low - value)
        ratio = excess / width
    else:
        bound = high if (high is not None and value > high) else low
        if not bound:
            return "mild"
        ratio = abs(value - bound) / abs(bound)

    # Rounded before comparison. Without this, 6.4 against a 4.0-5.6 range gives
    # 0.5000000000000008 from binary floating point and tips into the next
    # severity band -- a clinical grading changing on representation noise.
    ratio = round(ratio, 6)

    if ratio <= 0.15:
        return "mild"
    if ratio <= 0.5:
        return "moderate"
    return "severe"


def _score_labs(state: HealthState) -> List[Deduction]:
    abnormal = [m for m in state.markers if m.flag in {"low", "high"}]
    if not abnormal:
        return []

    # Worst first, so that when the cap bites it is the least significant
    # findings that get truncated rather than the most serious one.
    scored = []
    for marker in abnormal:
        severity = _severity(marker)
        weight = MARKER_WEIGHTS.get(marker.name, DEFAULT_MARKER_WEIGHT)
        scored.append((BASE_MARKER_POINTS[severity] * weight, severity, marker))
    scored.sort(key=lambda item: item[0], reverse=True)

    deductions: List[Deduction] = []
    spent = 0.0
    for points, severity, marker in scored:
        remaining = MAX_DEDUCTIONS["labs"] - spent
        if remaining <= 0:
            break
        applied = min(points, remaining)
        spent += applied

        direction = "above" if marker.flag == "high" else "below"
        unit = f" {marker.unit}" if marker.unit else ""
        deductions.append(
            Deduction(
                category="labs",
                points=applied,
                # Colon rather than a verb: marker names are a mix of singular
                # and plural ("HbA1c", "Triglycerides"), so any "is"/"are"
                # choice reads wrong for half of them.
                reason=f"{marker.label}: {severity}ly {direction} the normal range.",
                evidence=(
                    f"{marker.value}{unit}"
                    + (f" measured on {marker.measured_on}" if marker.measured_on else "")
                ),
            )
        )
    return deductions


def _score_sleep(state: HealthState) -> List[Deduction]:
    hours = state.avg_sleep_hours
    if hours is None:
        return []

    if SLEEP_TARGET_LOW <= hours <= SLEEP_TARGET_HIGH:
        return []

    if hours < SLEEP_TARGET_LOW:
        gap = SLEEP_TARGET_LOW - hours
        reason = f"Averaging {hours:.1f} hours of sleep, below the {SLEEP_TARGET_LOW:.0f}-hour target."
    else:
        gap = hours - SLEEP_TARGET_HIGH
        reason = f"Averaging {hours:.1f} hours of sleep, above the {SLEEP_TARGET_HIGH:.0f}-hour target."

    # 5 points per hour off target, capped.
    points = min(gap * 5, MAX_DEDUCTIONS["sleep"])
    return [
        Deduction(
            category="sleep",
            points=points,
            reason=reason,
            evidence=f"Average over {state.logged_days} logged day(s).",
        )
    ]


def _score_activity(state: HealthState) -> List[Deduction]:
    steps = state.avg_steps
    if steps is None:
        return []
    if steps >= STEP_TARGET:
        return []

    shortfall = (STEP_TARGET - steps) / STEP_TARGET
    points = min(shortfall * MAX_DEDUCTIONS["activity"], MAX_DEDUCTIONS["activity"])
    return [
        Deduction(
            category="activity",
            points=points,
            reason=f"Averaging {steps:,.0f} steps a day, below the {STEP_TARGET:,} step target.",
            evidence=f"Average over {state.logged_days} logged day(s).",
        )
    ]


def _score_body(state: HealthState) -> List[Deduction]:
    bmi = state.bmi
    if bmi is None:
        return []
    if BMI_HEALTHY_LOW <= bmi <= BMI_HEALTHY_HIGH:
        return []

    if bmi > BMI_HEALTHY_HIGH:
        gap = bmi - BMI_HEALTHY_HIGH
        band = "overweight range" if bmi < 30 else "obese range"
        reason = f"BMI of {bmi} falls in the {band}."
    else:
        gap = BMI_HEALTHY_LOW - bmi
        reason = f"BMI of {bmi} falls below the healthy range."

    points = min(gap * 2.5, MAX_DEDUCTIONS["body"])
    return [
        Deduction(
            category="body",
            points=points,
            reason=reason,
            evidence=f"Healthy range is {BMI_HEALTHY_LOW}-{BMI_HEALTHY_HIGH}.",
        )
    ]


def _score_hydration(state: HealthState) -> List[Deduction]:
    water = state.avg_water_ml
    if water is None:
        return []
    if water >= WATER_TARGET_ML:
        return []

    shortfall = (WATER_TARGET_ML - water) / WATER_TARGET_ML
    points = min(shortfall * MAX_DEDUCTIONS["hydration"], MAX_DEDUCTIONS["hydration"])
    return [
        Deduction(
            category="hydration",
            points=points,
            reason=f"Averaging {water:,.0f} ml of water a day, below the {WATER_TARGET_ML:,} ml target.",
            evidence=f"Average over {state.logged_days} logged day(s).",
        )
    ]


def _score_medication(state: HealthState) -> List[Deduction]:
    if not state.medication_conflicts:
        return []

    # Flat per-conflict points, capped. A conflict is a prompt to talk to a
    # doctor, not a graded health penalty, so severity does not scale the score.
    per_conflict = MAX_DEDUCTIONS["medication"] / max(len(state.medication_conflicts), 1)
    return [
        Deduction(
            category="medication",
            points=per_conflict,
            reason=(
                f"Possible interaction between {conflict['drugs'][0]} and "
                f"{conflict['drugs'][1]}. Discuss with your doctor."
            ),
            evidence=conflict["description"],
        )
        for conflict in state.medication_conflicts
    ]


def _summarise(score: int, deductions: List[Deduction]) -> str:
    """Plain-language qualifier shown beside the number.

    A bare score invites over-trust, so it is never rendered without one.
    """
    if not deductions:
        return "No concerns found in the data available."

    biggest = max(deductions, key=lambda d: d.points)
    area = {
        "labs": "lab results",
        "sleep": "sleep",
        "activity": "daily activity",
        "body": "body weight",
        "hydration": "hydration",
        "medication": "medications",
    }[biggest.category]

    if score >= 85:
        band = "Broadly healthy"
    elif score >= 70:
        band = "Some areas need attention"
    elif score >= 50:
        band = "Several areas need attention"
    else:
        band = "Multiple areas need attention"

    return f"{band}. The largest single factor is {area}."


def calculate_score(state: HealthState) -> ScoreResult:
    """Compute the score and the full breakdown behind it.

    Deterministic: the same state always yields the same score.
    """
    coverage = {
        "labs": bool(state.markers),
        "sleep": state.avg_sleep_hours is not None,
        "activity": state.avg_steps is not None,
        "body": state.bmi is not None,
        "hydration": state.avg_water_ml is not None,
        "medication": state.has_medications,
    }

    if not any(coverage.values()):
        return ScoreResult(
            score=None,
            status="insufficient_data",
            deductions=[],
            coverage=coverage,
            max_possible_deduction=0,
            summary=(
                "Not enough data to calculate a score yet. "
                "Add your profile, upload a report, or log a day to get started."
            ),
        )

    deductions = (
        _score_labs(state)
        + _score_sleep(state)
        + _score_activity(state)
        + _score_body(state)
        + _score_hydration(state)
        + _score_medication(state)
    )

    total = sum(d.points for d in deductions)
    # Clamped at 0: a floor of zero is easier to reason about than a negative
    # score, and the breakdown still lists every contributing factor.
    score = max(0, min(100, round(100 - total)))

    max_possible = sum(
        points for key, points in MAX_DEDUCTIONS.items() if coverage[key]
    )

    return ScoreResult(
        score=score,
        status="scored",
        deductions=sorted(deductions, key=lambda d: d.points, reverse=True),
        coverage=coverage,
        max_possible_deduction=max_possible,
        summary=_summarise(score, deductions),
    )
