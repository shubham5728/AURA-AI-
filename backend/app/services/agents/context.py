"""Assembles the context a role receives.

Two rules govern this module.

**De-identification.** Nothing here emits a name, email, or date of birth. Age
and sex are derived; the model reasons about "28y male" and never about a
person. This is the boundary described in Decision 5 of ROADMAP.md.

**Need to know.** A role receives only the slices listed in its `context_needs`.
The Fitness role does not see the medication list. Narrower context produces
sharper answers, sends less data to a third party, and makes an off-topic
tangent structurally harder.

Full context is sent rather than retrieved. A single user's health record fits
comfortably in a modern context window, and RAG here would add an embedding
pipeline, a vector store, and the failure mode where the retriever misses the
one relevant chunk. Retrieval becomes correct once history outgrows the window;
it is not correct yet.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import DailyLog, Medication, Profile, User
from app.services.interactions import find_interactions
from app.services.scoring import HealthState, calculate_score
from app.twin import build_health_state, calculate_age, calculate_bmi, latest_markers

# Markers the nutrition role reasons about. Sending it a thyroid result invites
# advice it has no business giving.
METABOLIC_MARKERS = {
    "hba1c", "fasting_glucose", "total_cholesterol", "ldl", "hdl",
    "triglycerides", "uric_acid", "alt", "ast",
}

RECENT_LOG_DAYS = 7


def _marker_numbers(markers) -> List[float]:
    """Every number a marker line puts in front of the model.

    Reference bounds count, not just the value. Roles are asked to explain what
    normal looks like, so "normal is 70.0 to 99.0" appears in good answers, and
    omitting the bounds here flagged those answers as fabricated.
    """
    values: List[float] = []
    for marker in markers:
        values.append(marker.value)
        if marker.ref_low is not None:
            values.append(marker.ref_low)
        if marker.ref_high is not None:
            values.append(marker.ref_high)
    return values


@dataclass
class ContextBundle:
    text: str
    # Every clinical number the model has legitimately been shown. Used to
    # detect fabricated values in the reply.
    known_numbers: List[float] = field(default_factory=list)
    sections: List[str] = field(default_factory=list)


def _format_marker(marker, include_range: bool = True) -> str:
    unit = f" {marker.unit}" if marker.unit else ""
    line = f"{marker.label}: {marker.value}{unit}"

    if include_range and (marker.ref_low is not None or marker.ref_high is not None):
        low = marker.ref_low if marker.ref_low is not None else "-"
        high = marker.ref_high if marker.ref_high is not None else "-"
        line += f" (normal {low} to {high})"

    if marker.flag in {"low", "high"}:
        line += f" [{marker.flag.upper()}]"
    if marker.measured_on:
        line += f" measured {marker.measured_on}"
    return line


def build_context(
    db: Session,
    user: User,
    needs: List[str],
    state: Optional[HealthState] = None,
) -> ContextBundle:
    """Assemble only the slices this role asked for."""
    state = state or build_health_state(db, user)
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()

    parts: List[str] = []
    sections: List[str] = []
    numbers: List[float] = []

    def add(section: str, body: str) -> None:
        parts.append(body)
        sections.append(section)

    if "profile" in needs and profile:
        age = calculate_age(profile.dob)
        bmi = calculate_bmi(profile.height_cm, profile.weight_kg)
        line = f"ABOUT: {age} year old {profile.sex}"
        if bmi:
            line += f", BMI {bmi}"
            numbers.append(bmi)
        numbers.extend([float(age), profile.height_cm, profile.weight_kg])
        add("profile", line)

    if "conditions" in needs and profile and profile.conditions:
        add("conditions", "KNOWN CONDITIONS: " + ", ".join(profile.conditions))

    if "allergies" in needs and profile and profile.allergies:
        add("allergies", "ALLERGIES (never suggest these): " + ", ".join(profile.allergies))

    if "goals" in needs and profile and profile.goals:
        add("goals", "STATED GOALS: " + ", ".join(profile.goals))

    markers = state.markers
    if "all_markers" in needs and markers:
        numbers.extend(_marker_numbers(markers))
        add(
            "all_markers",
            "LATEST LAB RESULTS:\n"
            + "\n".join(f"- {_format_marker(m)}" for m in markers),
        )

    elif "metabolic_markers" in needs and markers:
        subset = [m for m in markers if m.name in METABOLIC_MARKERS]
        if subset:
            numbers.extend(_marker_numbers(subset))
            add(
                "metabolic_markers",
                "RELEVANT LAB RESULTS:\n"
                + "\n".join(f"- {_format_marker(m)}" for m in subset),
            )

    if "marker_trends" in needs:
        trends = _build_trends(db, user)
        if trends:
            numbers.extend(v for _, values in trends for v in values)
            lines = []
            for label, values in trends:
                series = " -> ".join(str(v) for v in values)
                lines.append(f"- {label}: {series}")
            add(
                "marker_trends",
                "MARKER HISTORY (oldest to newest):\n" + "\n".join(lines),
            )

    if "score" in needs:
        result = calculate_score(state)
        if result.score is not None:
            numbers.append(float(result.score))
            # Deduction points are shown to the model, so they must count as
            # known values. Omitting them flagged replies that were quoting the
            # context correctly -- a warning that fires on good answers is worse
            # than no warning, because it teaches everyone to ignore it.
            numbers.extend(float(d.points) for d in result.deductions)
            top = "; ".join(f"{d.category} -{d.points:g}" for d in result.deductions[:3])
            add(
                "score",
                f"HEALTH SCORE: {result.score}/100. {result.summary}"
                + (f"\nLargest factors: {top}" if top else ""),
            )

    if "medications" in needs:
        medications = db.query(Medication).filter(Medication.user_id == user.id).all()
        if medications:
            lines = [
                f"- {m.drug_name}" + (f" {m.dose}" if m.dose else "")
                + (f", {m.schedule}" if m.schedule else "")
                for m in medications
            ]
            add("medications", "CURRENT MEDICATIONS:\n" + "\n".join(lines))

            if "interactions" in needs:
                conflicts = find_interactions([m.drug_name for m in medications])
                if conflicts:
                    lines = [
                        f"- {c['drugs'][0]} + {c['drugs'][1]} ({c['severity']}): {c['description']}"
                        for c in conflicts
                    ]
                    add(
                        "interactions",
                        "KNOWN INTERACTIONS (flag for doctor, never advise changes):\n"
                        + "\n".join(lines),
                    )

    log_slice = _log_slice(needs)
    if log_slice:
        summary, values = _summarise_logs(state, log_slice)
        if summary:
            numbers.extend(values)
            add(log_slice, summary)

    if not parts:
        return ContextBundle(
            text="No health data on file for this user yet.",
            known_numbers=[],
            sections=[],
        )

    return ContextBundle(
        text="\n\n".join(parts),
        known_numbers=numbers,
        sections=sections,
    )


def _log_slice(needs: List[str]) -> Optional[str]:
    for candidate in ("recent_logs", "activity_logs", "diet_logs"):
        if candidate in needs:
            return candidate
    return None


def _summarise_logs(state: HealthState, slice_name: str):
    """Summarise lifestyle logs as averages rather than raw rows.

    Averages are what the advice is actually about, and seven days of raw rows
    would crowd out the lab results without adding anything a role can use.
    """
    if state.logged_days == 0:
        return None, []

    metrics = {
        "recent_logs": [
            ("Average steps", state.avg_steps, "steps/day", 0),
            ("Average sleep", state.avg_sleep_hours, "hours/night", 1),
            ("Average water", state.avg_water_ml, "ml/day", 0),
        ],
        "activity_logs": [
            ("Average steps", state.avg_steps, "steps/day", 0),
            ("Average sleep", state.avg_sleep_hours, "hours/night", 1),
        ],
        "diet_logs": [
            ("Average water", state.avg_water_ml, "ml/day", 0),
        ],
    }[slice_name]

    lines: List[str] = []
    values: List[float] = []
    for label, value, unit, places in metrics:
        if value is None:
            continue
        rounded = round(value, places)
        values.append(float(rounded))
        lines.append(f"- {label}: {rounded:g} {unit}")

    if not lines:
        return None, []

    header = f"LIFESTYLE (average over {state.logged_days} logged day(s) in the last {RECENT_LOG_DAYS}):"
    return header + "\n" + "\n".join(lines), values


def _build_trends(db: Session, user: User):
    """Markers with more than one reading, oldest to newest.

    Single-reading markers are excluded: a "trend" of one point invites the
    model to describe movement that has not been observed.
    """
    from app.models import Biomarker, Report
    from app.services.reference_ranges import display_name

    rows = (
        db.query(Biomarker)
        .join(Report, Biomarker.report_id == Report.id)
        .filter(Report.user_id == user.id)
        .order_by(Biomarker.measured_at.asc().nullsfirst(), Biomarker.id.asc())
        .all()
    )

    grouped: dict = {}
    for marker in rows:
        grouped.setdefault(marker.name, []).append(marker.value)

    return [
        (display_name(name), values)
        for name, values in grouped.items()
        if len(values) > 1
    ]
