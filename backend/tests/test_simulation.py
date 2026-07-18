"""Tests for the Lifestyle Simulator.

The property that matters most is consistency with the real score. A projection
that disagrees with the dashboard is worse than no projection at all.
"""

import pytest

from app.services.scoring import HealthState, MarkerReading, calculate_score
from app.services.simulation import simulate


def base_state():
    return HealthState(
        bmi=27.4,
        markers=[
            MarkerReading("hba1c", "HbA1c", 6.4, "%", 4.0, 5.6, "high", "2026-07-10")
        ],
        avg_sleep_hours=5.5,
        avg_steps=3200.0,
        avg_water_ml=1100.0,
        logged_days=7,
    )


def test_projection_uses_the_same_function_as_the_real_score():
    """A simulated state must score identically to that state scored directly."""
    state = base_state()
    result = simulate(state, {"avg_steps": 9000.0})

    from dataclasses import replace

    direct = calculate_score(replace(state, avg_steps=9000.0))
    assert result.projected_score == direct.score


def test_improving_activity_raises_the_score():
    result = simulate(base_state(), {"avg_steps": 9000.0})
    assert result.projected_score > result.current_score
    assert result.delta > 0


def test_worsening_a_habit_lowers_the_score():
    """The simulator must be honest in both directions."""
    result = simulate(base_state(), {"avg_sleep_hours": 3.0})
    assert result.delta < 0


def test_resolved_lists_what_the_change_actually_fixes():
    """The explanation is the feature -- not '+12' but 'you stop losing 12'."""
    result = simulate(base_state(), {"avg_steps": 9000.0})
    assert any(d.category == "activity" for d in result.resolved)
    assert all(d.category != "labs" for d in result.resolved)


def test_a_deduction_that_only_shrinks_is_not_reported_as_resolved():
    result = simulate(base_state(), {"avg_steps": 5000.0})
    assert all(d.category != "activity" for d in result.resolved)


def test_several_levers_can_move_together():
    result = simulate(
        base_state(),
        {"avg_steps": 9000.0, "avg_sleep_hours": 8.0, "avg_water_ml": 2600.0},
    )
    assert len(result.changes) == 3
    assert result.delta > 0


def test_changes_report_the_starting_value():
    result = simulate(base_state(), {"avg_steps": 9000.0})
    change = result.changes[0]
    assert change.before == 3200.0
    assert change.after == 9000.0


def test_lab_markers_cannot_be_simulated():
    """'What if my HbA1c were normal?' is a wish, not a decision."""
    with pytest.raises(ValueError):
        simulate(base_state(), {"markers": []})


def test_empty_request_is_rejected():
    with pytest.raises(ValueError):
        simulate(base_state(), {})


def test_every_projection_states_its_assumption():
    """A projection without a stated basis is a guess wearing a lab coat."""
    result = simulate(base_state(), {"avg_steps": 9000.0})
    assert result.assumption.strip()
    assert result.horizon.strip()


def test_simulating_from_an_empty_state_does_not_crash():
    """A new user must be able to explore before logging anything."""
    result = simulate(HealthState(), {"avg_steps": 9000.0})
    assert result.current_score is None
    assert result.delta is None


def test_the_original_state_is_never_mutated():
    """Scoring the same state twice must not be affected by a simulation."""
    state = base_state()
    before = calculate_score(state).score
    simulate(state, {"avg_steps": 9000.0})
    assert calculate_score(state).score == before
    assert state.avg_steps == 3200.0
