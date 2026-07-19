"""Tests for the pipeline trace.

The trace is a claim about how the system behaves, shown to the person using
it. If it can drift from what actually ran, it is worse than showing nothing --
so these tests pin it to reality rather than to a shape.
"""

import time

import pytest

from app.services.agents.trace import Timer


def test_durations_are_measured_not_invented():
    timer = Timer()
    with timer.stage("slow", "Slow step"):
        time.sleep(0.02)
    trace = timer.finish()

    assert trace.stages[0].ms >= 18  # ~20ms, allowing for timer resolution
    assert trace.total_ms >= trace.stages[0].ms


def test_stages_appear_in_the_order_they_ran():
    timer = Timer()
    for name in ("first", "second", "third"):
        with timer.stage(name, name.title()):
            pass
    assert [s.name for s in timer.finish().stages] == ["first", "second", "third"]


def test_a_stage_that_raised_is_still_recorded():
    """A failed step is part of what happened. Dropping it would turn the trace
    into a highlight reel."""
    timer = Timer()
    with pytest.raises(ValueError):
        with timer.stage("boom", "Failing step"):
            raise ValueError("nope")

    trace = timer.finish()
    assert [s.name for s in trace.stages] == ["boom"]
    assert trace.stages[0].detail == "failed"


def test_only_stages_that_ran_are_present():
    """The trace must not describe work that did not happen."""
    timer = Timer()
    with timer.stage("safety_in", "Safety screen"):
        pass
    assert [s.name for s in timer.finish().stages] == ["safety_in"]


def test_serialises_for_the_api():
    timer = Timer()
    with timer.stage("routing", "Route") as stage:
        stage.detail = "Nutrition"
        stage.data = {"chosen": "nutrition"}
    payload = timer.finish().as_dict()

    assert payload["stages"][0]["label"] == "Route"
    assert payload["stages"][0]["data"]["chosen"] == "nutrition"
    assert isinstance(payload["total_ms"], float)


# --- what the orchestrator records ----------------------------------------


class StubLLM:
    def generate_text(self, prompt):
        return "doctor"

    def chat(self, system, history, message):
        return "Your HbA1c was 6.4% on 2026-07-10."


def test_emergency_trace_shows_the_model_was_never_reached(db_session, test_user):
    """The absence of a generation stage is the evidence. Without it, "we
    intercept before calling the model" is only an assertion."""
    from app.services.agents.orchestrator import answer

    reply = answer(db_session, test_user, "I have severe chest pain", llm=StubLLM())
    names = [s["name"] for s in reply.trace["stages"]]

    assert reply.emergency
    assert names == ["safety_in"]
    assert "generation" not in names
    assert reply.trace["context_sent"] == ""


def test_normal_trace_records_every_stage(db_session, test_user):
    from app.services.agents.orchestrator import answer

    reply = answer(db_session, test_user, "explain my cholesterol", llm=StubLLM())
    names = [s["name"] for s in reply.trace["stages"]]

    assert names == ["safety_in", "routing", "context", "generation", "safety_out"]


def test_trace_reports_what_the_role_was_denied(db_session, test_user):
    """Withheld slices are the proof that context narrowing is real."""
    from app.services.agents.orchestrator import answer

    reply = answer(db_session, test_user, "what should I eat", llm=StubLLM())
    context = next(s for s in reply.trace["stages"] if s["name"] == "context")

    assert "medications" in context["data"]["withheld"]
    assert "medications" not in context["data"]["sections"]


def test_missing_data_is_not_reported_as_withheld(db_session, test_user):
    """A slice the role may read but the user has no data for is "empty", not
    "withheld". Conflating them overstates the guarantee -- it would show the
    Nutrition role being denied lab results it is entitled to read."""
    from app.services.agents.orchestrator import answer
    from app.services.agents.roles import NUTRITION

    reply = answer(db_session, test_user, "what should I eat", llm=StubLLM())
    context = next(s for s in reply.trace["stages"] if s["name"] == "context")

    # This user has no reports, so the role's own marker slice is empty.
    assert "metabolic_markers" in NUTRITION.context_needs
    assert "metabolic_markers" in context["data"]["empty"]
    assert "metabolic_markers" not in context["data"]["withheld"]

    # Nothing may appear in both lists.
    assert not set(context["data"]["withheld"]) & set(context["data"]["empty"])


def test_routing_stage_shows_every_role_considered(db_session, test_user):
    """A close call should look like one, not like an obvious choice."""
    from app.services.agents.orchestrator import answer

    reply = answer(db_session, test_user, "how many steps should I walk", llm=StubLLM())
    routing = next(s for s in reply.trace["stages"] if s["name"] == "routing")

    assert routing["data"]["chosen"] == "fitness"
    assert set(routing["data"]["scores"]) >= {"doctor", "nutrition", "fitness"}
