"""Tests for the safety guardrails.

The highest-stakes code in the project. A missed emergency means someone waits
for a chatbot instead of calling for help, so these cases are pinned explicitly
rather than trusted to a prompt.
"""

import pytest

from app.services.agents.safety import (
    find_unsupported_numbers,
    screen_input,
    screen_output,
)


@pytest.mark.parametrize(
    "message",
    [
        "I have severe chest pain right now",
        "my chest feels tight and my left arm hurts",
        "I think I'm having a heart attack",
        "I can't breathe properly",
        "having difficulty breathing since morning",
        "my face is drooping and my speech is slurred",
        "I just had a seizure",
        "he is unconscious",
        "I am vomiting blood",
        "I took too many pills",
    ],
)
def test_emergencies_are_intercepted(message):
    """These must never reach the model for an opinion."""
    verdict = screen_input(message)
    assert verdict.blocked
    assert "112" in verdict.response or "14416" in verdict.response


@pytest.mark.parametrize(
    "message",
    ["I want to kill myself", "I feel suicidal", "I want to die", "thinking of ending my life"],
)
def test_self_harm_gets_a_crisis_line_not_an_emergency_room(message):
    """A mental health crisis needs a helpline, not 'go to the ER'."""
    verdict = screen_input(message)
    assert verdict.blocked
    assert verdict.category == "self_harm"
    assert "14416" in verdict.response


def test_self_harm_wins_when_several_categories_match():
    """A mixed message must not have its crisis response overwritten."""
    verdict = screen_input("I have chest pain and I want to kill myself")
    assert verdict.category == "self_harm"
    assert "14416" in verdict.response


@pytest.mark.parametrize(
    "message",
    [
        "what should I eat for breakfast",
        "explain my cholesterol report",
        "how many steps should I walk daily",
        "my chesty cough is annoying",
        "I ran out of my tablets",
        "is 6.4 HbA1c bad",
    ],
)
def test_ordinary_questions_are_not_blocked(message):
    """Over-blocking makes the assistant useless and trains users to ignore it."""
    assert screen_input(message).blocked is False


def test_matching_is_case_insensitive():
    assert screen_input("SEVERE CHEST PAIN").blocked


# --- output screening -----------------------------------------------------


@pytest.mark.parametrize(
    "reply",
    [
        "You should stop taking warfarin immediately.",
        "I suggest you discontinue the medication.",
        "You should increase your dose to 10mg.",
    ],
)
def test_medication_change_advice_is_flagged(reply):
    assert "medication_change" in screen_output(reply)


@pytest.mark.parametrize(
    "reply",
    ["You have diabetes.", "This is definitely diabetes.", "I diagnose you with hypothyroidism."],
)
def test_diagnostic_verdicts_are_flagged(reply):
    assert "diagnosis" in screen_output(reply)


@pytest.mark.parametrize(
    "reply",
    [
        # Every one of these came back from a real reply and was wrongly flagged.
        "If you have any further questions about this, please ask your doctor.",
        "If you have concerns, discuss them at your next visit.",
        "Let me know if you have more questions.",
        "If you have had this before, mention it to your doctor.",
        "If you have an appointment coming up, raise it then.",
    ],
)
def test_polite_phrasing_is_not_read_as_a_diagnosis(reply):
    """"you have" alone is not a diagnosis. Flagging it marked correct answers
    as unsafe, which trains people to ignore the warning entirely."""
    assert "diagnosis" not in screen_output(reply)


def test_a_real_diagnostic_claim_is_still_caught():
    assert "diagnosis" in screen_output("Based on this, you have hypothyroidism.")


def test_hedged_explanation_is_allowed():
    """Explaining what a value can indicate is the product working, not a violation."""
    reply = (
        "An HbA1c of 6.4% sits above the normal range and can be associated with "
        "prediabetes. Please discuss this with your doctor, who can confirm what it means."
    )
    assert screen_output(reply) == []


def test_discussing_a_medication_without_advising_change_is_allowed():
    reply = (
        "Aspirin and warfarin together can raise bleeding risk. This is worth raising "
        "with your doctor at your next visit."
    )
    assert screen_output(reply) == []


# --- fabricated values ----------------------------------------------------


def test_value_present_in_context_is_accepted():
    assert find_unsupported_numbers("Your HbA1c is 6.4%.", [6.4]) == []


def test_invented_value_is_caught():
    """The model must not produce lab values the user never had measured."""
    assert 7.8 in find_unsupported_numbers("Your HbA1c is 7.8%.", [6.4])


def test_small_integers_are_ignored():
    """Step targets, hours, and list numbering are not fabricated lab values."""
    reply = "Try 3 changes this week: sleep 8 hours, walk 2 more times, drink water."
    assert find_unsupported_numbers(reply, []) == []


def test_large_known_numbers_pass_through():
    reply = "You averaged 3200 steps against a target of 8000."
    assert find_unsupported_numbers(reply, [3200.0, 8000.0]) == []


@pytest.mark.parametrize(
    "reply",
    [
        "Your HbA1c was 6.4% on 2026-07-10.",
        "Your HbA1c was 6.4% measured 10/07/2026.",
        "Your HbA1c was 6.4%, measured on July 10, 2026.",
        "Your HbA1c was 6.4% (Jul 10, 2026).",
    ],
)
def test_measurement_dates_are_not_read_as_invented_values(reply):
    """Roles are told to cite when a value was measured, so dates appear in
    every well-formed answer. Reading the year as a fabricated lab result
    flagged correct replies and would have trained everyone to ignore the
    warning."""
    assert find_unsupported_numbers(reply, [6.4]) == []
