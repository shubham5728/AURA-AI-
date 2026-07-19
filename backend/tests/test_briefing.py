"""Tests for the daily briefing.

The briefing is the first thing seen each day, which makes it the worst place
in the product for an invented figure. These pin the guards that stop one
appearing.
"""

from datetime import date, timedelta

import pytest

from app.models import DailyBriefing, DailyLog, Profile
from app.services import briefing as briefing_service
from app.services.agents.llm import LLMError


class StubLLM:
    """Returns whatever it is told to, and counts how often it was asked."""

    def __init__(self, reply="Your score is steady today and nothing needs urgent attention."):
        self.reply = reply
        self.calls = 0

    def generate_text(self, prompt):
        self.calls += 1
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply

    def chat(self, system, history, message):
        return self.reply


@pytest.fixture
def profiled_user(db_session, test_user):
    db_session.add(Profile(
        user_id=test_user.id, dob=date(1990, 1, 1), sex="male",
        height_cm=175, weight_kg=95, conditions=[], allergies=[], goals=[],
    ))
    db_session.commit()
    return test_user


def test_generated_once_then_reused(db_session, profiled_user):
    """A page load must not cost an API call. The free tier is twenty a day."""
    llm = StubLLM()

    first = briefing_service.build(db_session, profiled_user, llm=llm)
    for _ in range(5):
        again = briefing_service.build(db_session, profiled_user, llm=llm)
        assert again.text == first.text

    assert llm.calls == 1


def test_regenerated_when_the_score_moves(db_session, profiled_user):
    """Yesterday's sentence about a score that has since changed is not stale,
    it is wrong."""
    llm = StubLLM()
    briefing_service.build(db_session, profiled_user, llm=llm)

    db_session.add(DailyLog(
        user_id=profiled_user.id, date=date.today() - timedelta(days=1),
        steps=1200, sleep_hours=4.0, water_ml=500,
    ))
    db_session.commit()

    briefing_service.build(db_session, profiled_user, llm=llm)
    assert llm.calls == 2


def test_invented_figures_are_rejected(db_session, profiled_user):
    """A number that appears in no fact must never reach the first screen."""
    llm = StubLLM("Your HbA1c of 7.9 has risen sharply since your last test.")
    result = briefing_service.build(db_session, profiled_user, llm=llm)

    assert result.source == "computed"
    assert "7.9" not in result.text


def test_diagnostic_language_is_rejected(db_session, profiled_user):
    llm = StubLLM("You have metabolic syndrome and should act immediately.")
    assert briefing_service.build(db_session, profiled_user, llm=llm).source == "computed"


def test_overlong_output_is_rejected(db_session, profiled_user):
    llm = StubLLM(" ".join(["word"] * 200))
    assert briefing_service.build(db_session, profiled_user, llm=llm).source == "computed"


def test_model_failure_falls_back_without_raising(db_session, profiled_user):
    """The homepage must render when the API is down or out of quota."""
    llm = StubLLM(LLMError("429 RESOURCE_EXHAUSTED"))
    result = briefing_service.build(db_session, profiled_user, llm=llm)

    assert result.source == "computed"
    assert result.text.strip()


def test_source_is_reported_honestly(db_session, profiled_user):
    """Fallback text must not be presented as generated insight."""
    good = briefing_service.build(db_session, profiled_user, llm=StubLLM())
    assert good.source == "model"


def test_a_user_with_no_data_is_told_so(db_session, test_user):
    """With nothing measured there is nothing to narrate.

    Asked to write a briefing for an empty account, the model produced "your
    score is steady today" -- not merely wrong, but reassuring about a state
    nobody has looked at. Generation is skipped rather than trusted to the
    output checks, which cannot catch a sentence containing no figures.
    """
    llm = StubLLM()
    result = briefing_service.build(db_session, test_user, llm=llm)

    assert result.score is None
    assert result.source == "computed"
    assert "not enough data" in result.text.lower()
    assert llm.calls == 0


def test_computed_text_does_not_repeat_itself(db_session, profiled_user):
    """The score summary already names the largest area, so restating it gave
    "the largest single factor is daily activity ... the largest single factor
    right now: ..." in one paragraph."""
    db_session.add(DailyLog(
        user_id=profiled_user.id, date=date.today() - timedelta(days=1),
        steps=1000, sleep_hours=8.0, water_ml=2600,
    ))
    db_session.commit()

    text = briefing_service.build(
        db_session, profiled_user, llm=StubLLM(LLMError("down")),
    ).text
    assert text.lower().count("largest single factor") <= 1


def test_computed_text_names_what_was_not_assessed(db_session, profiled_user):
    """A score built on one measurement reads as a clean bill of health unless
    the gaps are stated."""
    result = briefing_service.build(db_session, profiled_user, llm=StubLLM(LLMError("down")))
    assert "not yet assessed" in result.text.lower()


def test_actions_come_from_the_score(db_session, profiled_user):
    """The overview used to show three fixed instructions to everyone."""
    db_session.add(DailyLog(
        user_id=profiled_user.id, date=date.today() - timedelta(days=1),
        steps=900, sleep_hours=8.0, water_ml=2600,
    ))
    db_session.commit()

    result = briefing_service.build(db_session, profiled_user, llm=StubLLM())
    joined = " ".join(result.actions).lower()

    assert "walk" in joined          # activity was the shortfall
    assert "water" not in joined     # hydration was met, so it is not suggested


def test_one_row_per_user_per_day(db_session, profiled_user):
    for _ in range(3):
        briefing_service.build(db_session, profiled_user, llm=StubLLM())

    rows = db_session.query(DailyBriefing).filter(
        DailyBriefing.user_id == profiled_user.id,
        DailyBriefing.date == date.today(),
    ).count()
    assert rows == 1
