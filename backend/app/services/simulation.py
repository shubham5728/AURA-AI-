"""Lifestyle Simulation Engine.

The payoff for keeping `calculate_score` pure. A projection is produced by
rebuilding the same `HealthState` with one or more fields changed and calling
the same scoring function -- not by a second, parallel formula.

That matters beyond tidiness. A separate projection formula drifts from the real
score over time, and the demo then shows "projected 72" next to an actual 68
with no explanation. Reusing the function makes that impossible by construction.

Only lifestyle inputs can be simulated. Lab markers are deliberately excluded:
"what if my HbA1c were normal?" is a wish, not a decision the user can act on,
and answering it would imply a causal claim this system cannot support.
"""

from dataclasses import dataclass, replace
from typing import Dict, List, Optional

from app.services.scoring import Deduction, HealthState, calculate_score

# field -> (label, unit) for the levers a user can actually pull.
SIMULATABLE = {
    "avg_steps": ("Daily steps", "steps"),
    "avg_sleep_hours": ("Sleep", "hours"),
    "avg_water_ml": ("Water intake", "ml"),
    "bmi": ("BMI", ""),
}

ASSUMPTION = (
    "Assumes the change is sustained consistently. Based on general population "
    "targets, not a personalised medical prediction."
)
HORIZON = "8 to 12 weeks"


@dataclass
class Change:
    field: str
    label: str
    before: Optional[float]
    after: float


@dataclass
class SimulationResult:
    current_score: Optional[int]
    projected_score: Optional[int]
    delta: Optional[int]
    changes: List[Change]
    resolved: List[Deduction]
    assumption: str = ASSUMPTION
    horizon: str = HORIZON

    def as_dict(self) -> dict:
        return {
            "current_score": self.current_score,
            "projected_score": self.projected_score,
            "delta": self.delta,
            "changes": [
                {"field": c.field, "label": c.label, "from": c.before, "to": c.after}
                for c in self.changes
            ],
            "resolved": [d.as_dict() for d in self.resolved],
            "assumption": self.assumption,
            "horizon": self.horizon,
        }


def simulate(state: HealthState, overrides: Dict[str, float]) -> SimulationResult:
    """Score the current state and a modified copy of it.

    `resolved` lists the deductions the change removes entirely, which is what
    turns a number into an explanation: not "your score goes up 12" but "you
    stop losing 12 points for low activity".
    """
    applied = {
        field: float(value)
        for field, value in overrides.items()
        if field in SIMULATABLE and value is not None
    }
    if not applied:
        raise ValueError(
            f"No simulatable fields supplied. Allowed: {sorted(SIMULATABLE)}"
        )

    current = calculate_score(state)
    projected = calculate_score(replace(state, **applied))

    changes = [
        Change(
            field=field,
            label=SIMULATABLE[field][0],
            before=getattr(state, field),
            after=value,
        )
        for field, value in applied.items()
    ]

    # Matched on category alone, not on the reason text. Reason strings embed
    # the value ("Averaging 3,200 steps a day"), so raising steps from 3,200 to
    # 5,000 rewrites the string and made a deduction that merely shrank look
    # solved -- the simulator would claim a problem was fixed when it was only
    # reduced. Each lifestyle category produces at most one deduction, and lab
    # markers cannot be simulated, so category is the right granularity.
    projected_categories = {d.category for d in projected.deductions}
    resolved = [
        d for d in current.deductions if d.category not in projected_categories
    ]

    delta = (
        projected.score - current.score
        if current.score is not None and projected.score is not None
        else None
    )

    return SimulationResult(
        current_score=current.score,
        projected_score=projected.score,
        delta=delta,
        changes=changes,
        resolved=resolved,
    )
