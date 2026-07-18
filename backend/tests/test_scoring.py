"""Tests for the Health Score.

The score is the number a user will trust most, so the properties pinned here
are the ones that make it trustworthy: it is deterministic, it never invents a
verdict from absent data, no single component can dominate, and every deduction
carries a reason.
"""

import pytest

from app.services.scoring import (
    MAX_DEDUCTIONS,
    Deduction,
    HealthState,
    MarkerReading,
    calculate_score,
)


def marker(name, value, low=None, high=None, flag="high", label=None):
    return MarkerReading(
        name=name,
        label=label or name.upper(),
        value=value,
        ref_low=low,
        ref_high=high,
        flag=flag,
        unit="mg/dL",
    )


# --- missing data ---------------------------------------------------------


def test_empty_state_scores_none_not_one_hundred():
    """An empty account claiming perfect health is the worst possible failure."""
    result = calculate_score(HealthState())
    assert result.score is None
    assert result.status == "insufficient_data"


def test_unlogged_lifestyle_is_not_penalised():
    """Not tracking sleep must not read as sleeping badly."""
    result = calculate_score(HealthState(bmi=22.0))
    assert result.score == 100
    assert result.coverage["sleep"] is False
    assert not any(d.category == "sleep" for d in result.deductions)


def test_coverage_reports_what_was_actually_assessed():
    state = HealthState(bmi=22.0, avg_steps=5000.0, logged_days=7)
    coverage = calculate_score(state).coverage
    assert coverage["body"] is True
    assert coverage["activity"] is True
    assert coverage["labs"] is False
    assert coverage["hydration"] is False


def test_max_possible_deduction_reflects_coverage_only():
    """Shows how much of the score was actually in play."""
    state = HealthState(bmi=22.0, avg_steps=9000.0, logged_days=7)
    result = calculate_score(state)
    assert result.max_possible_deduction == MAX_DEDUCTIONS["body"] + MAX_DEDUCTIONS["activity"]


# --- determinism ----------------------------------------------------------


def test_same_state_always_gives_same_score():
    """Required for the simulator: a projection must be comparable to reality."""
    state = HealthState(
        bmi=27.5,
        markers=[marker("hba1c", 6.4, 4.0, 5.6)],
        avg_sleep_hours=5.5,
        avg_steps=4000.0,
        avg_water_ml=1200.0,
        logged_days=7,
    )
    scores = {calculate_score(state).score for _ in range(5)}
    assert len(scores) == 1


def test_healthy_state_scores_one_hundred():
    state = HealthState(
        bmi=22.0,
        markers=[marker("hba1c", 5.1, 4.0, 5.6, flag="normal")],
        avg_sleep_hours=8.0,
        avg_steps=9000.0,
        avg_water_ml=2600.0,
        logged_days=7,
    )
    result = calculate_score(state)
    assert result.score == 100
    assert result.deductions == []


# --- caps and bounds ------------------------------------------------------


def test_labs_cannot_exceed_their_cap():
    """One catastrophic panel must not wipe out the whole score."""
    markers = [marker(f"marker_{i}", 900, 1.0, 2.0) for i in range(30)]
    result = calculate_score(HealthState(markers=markers))
    lab_points = sum(d.points for d in result.deductions if d.category == "labs")
    assert lab_points <= MAX_DEDUCTIONS["labs"] + 0.01


@pytest.mark.parametrize("steps", [0.0, 100.0])
def test_activity_deduction_is_capped(steps):
    result = calculate_score(HealthState(avg_steps=steps, logged_days=7))
    assert sum(d.points for d in result.deductions) <= MAX_DEDUCTIONS["activity"] + 0.01


def test_score_never_goes_below_zero():
    state = HealthState(
        bmi=55.0,
        markers=[marker(f"m{i}", 999, 1.0, 2.0) for i in range(20)],
        avg_sleep_hours=1.0,
        avg_steps=0.0,
        avg_water_ml=0.0,
        logged_days=7,
        has_medications=True,
        medication_conflicts=[
            {"drugs": ["aspirin", "warfarin"], "severity": "major", "description": "x"}
        ],
    )
    assert calculate_score(state).score == 0


def test_score_stays_within_bounds_across_extremes():
    for bmi in (12.0, 18.5, 24.9, 40.0):
        result = calculate_score(HealthState(bmi=bmi))
        assert 0 <= result.score <= 100


# --- severity grading -----------------------------------------------------


def test_worse_values_deduct_more():
    """Severity must track how far outside the range a value sits."""
    mild = calculate_score(HealthState(markers=[marker("hba1c", 5.8, 4.0, 5.6)]))
    severe = calculate_score(HealthState(markers=[marker("hba1c", 11.0, 4.0, 5.6)]))
    assert severe.score < mild.score


def test_clinically_weightier_markers_cost_more():
    """A raised HbA1c should outrank a mildly low vitamin D."""
    hba1c = calculate_score(HealthState(markers=[marker("hba1c", 9.0, 4.0, 5.6)]))
    vit_d = calculate_score(HealthState(markers=[marker("vitamin_d", 5.0, 30.0, 100.0, flag="low")]))
    assert hba1c.score < vit_d.score


def test_severity_bands_do_not_flip_on_floating_point_noise():
    """HbA1c 6.4 against 4.0-5.6 lands exactly on the moderate/severe boundary.

    In binary floating point the ratio computes as 0.5000000000000008, which
    silently promoted it to severe. A clinical grading must not depend on
    representation error.
    """
    from app.services.scoring import _severity

    reading = marker("hba1c", 6.4, 4.0, 5.6)
    assert _severity(reading) == "moderate"


def test_open_ended_range_still_grades_severity():
    """Labs print '< 200'; a value of 400 must not be graded as mild."""
    mild = calculate_score(HealthState(markers=[marker("total_cholesterol", 210, None, 200)]))
    severe = calculate_score(HealthState(markers=[marker("total_cholesterol", 400, None, 200)]))
    assert severe.score < mild.score


# --- lifestyle components -------------------------------------------------


def test_oversleeping_also_deducts():
    """The target is a band, not a floor."""
    result = calculate_score(HealthState(avg_sleep_hours=12.0, logged_days=7))
    assert any(d.category == "sleep" for d in result.deductions)


def test_sleep_inside_target_band_is_free():
    for hours in (7.0, 8.0, 9.0):
        result = calculate_score(HealthState(avg_sleep_hours=hours, logged_days=7))
        assert result.deductions == []


def test_bmi_at_healthy_bounds_is_free():
    for bmi in (18.5, 24.9):
        assert calculate_score(HealthState(bmi=bmi)).deductions == []


def test_exceeding_step_target_earns_no_penalty():
    result = calculate_score(HealthState(avg_steps=20000.0, logged_days=7))
    assert result.deductions == []


# --- explainability -------------------------------------------------------


def test_every_deduction_carries_a_reason():
    """A point lost with no explanation is the failure mode this design avoids."""
    state = HealthState(
        bmi=31.0,
        markers=[marker("hba1c", 7.2, 4.0, 5.6)],
        avg_sleep_hours=5.0,
        avg_steps=3000.0,
        avg_water_ml=900.0,
        logged_days=7,
    )
    result = calculate_score(state)
    assert result.deductions
    for deduction in result.deductions:
        assert deduction.reason.strip()
        assert deduction.points > 0


def test_lab_deductions_cite_the_measurement():
    state = HealthState(markers=[MarkerReading(
        name="hba1c", label="HbA1c", value=6.4, ref_low=4.0, ref_high=5.6,
        flag="high", unit="%", measured_on="2026-07-10",
    )])
    lab = [d for d in calculate_score(state).deductions if d.category == "labs"][0]
    assert "6.4" in lab.evidence
    assert "2026-07-10" in lab.evidence


def test_deductions_are_ordered_worst_first():
    state = HealthState(
        bmi=26.0,
        markers=[marker("hba1c", 9.5, 4.0, 5.6)],
        avg_steps=2000.0,
        logged_days=7,
    )
    points = [d.points for d in calculate_score(state).deductions]
    assert points == sorted(points, reverse=True)


def test_summary_never_leaves_the_number_bare():
    result = calculate_score(HealthState(bmi=31.0))
    assert result.summary.strip()


def test_medication_conflict_advises_a_doctor_not_an_action():
    """Safety rule: flag for discussion, never suggest changing a medication."""
    state = HealthState(
        has_medications=True,
        medication_conflicts=[{
            "drugs": ["aspirin", "warfarin"],
            "severity": "major",
            "description": "Raises bleeding risk.",
        }],
    )
    reason = [d for d in calculate_score(state).deductions if d.category == "medication"][0].reason
    assert "doctor" in reason.lower()
    for forbidden in ("stop taking", "discontinue", "reduce your dose"):
        assert forbidden not in reason.lower()


def test_deduction_serialises_for_the_api():
    payload = Deduction("labs", 4.26, "reason", "evidence").as_dict()
    assert payload["points"] == 4.3
    assert set(payload) == {"category", "points", "reason", "evidence"}
