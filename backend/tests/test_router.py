"""Tests for specialist routing.

Routing decides which context slice a question gets, so a mis-route is not
cosmetic: ask the Fitness role about a drug interaction and it has no medication
data to answer from.
"""

import pytest

from app.services.agents.router import classify, score_roles


class StubLLM:
    """Records whether the model was consulted, and what it was asked."""

    def __init__(self, reply="nutrition"):
        self.reply = reply
        self.calls = []

    def generate_text(self, prompt):
        self.calls.append(prompt)
        return self.reply


@pytest.mark.parametrize(
    "message,expected",
    [
        ("What should I eat for breakfast?", "nutrition"),
        ("Suggest a high protein meal plan", "nutrition"),
        ("How many steps should I walk daily?", "fitness"),
        ("Is my sleep enough for recovery?", "fitness"),
        ("Can I take these two tablets together?", "medication"),
        ("What are the side effects of this drug?", "medication"),
        ("Explain my cholesterol report", "doctor"),
        ("I feel tired all the time", "doctor"),
        ("What if I walk 8000 steps daily?", "prediction"),
        ("Is my HbA1c trend improving?", "prediction"),
    ],
)
def test_clear_questions_route_by_keywords(message, expected):
    decision = classify(message)
    assert decision.role.key == expected
    assert decision.method == "keywords"


def test_keyword_routing_does_not_call_the_model():
    """The common path must stay off the network -- it is latency on every turn."""
    llm = StubLLM()
    classify("What should I eat for breakfast?", llm=llm)
    assert llm.calls == []


def test_ambiguous_message_falls_through_to_the_model():
    llm = StubLLM(reply="nutrition")
    decision = classify("hmm, not sure about this", llm=llm)
    assert llm.calls
    assert decision.method == "model"
    assert decision.role.key == "nutrition"


def test_model_answer_wrapped_in_prose_is_still_understood():
    decision = classify("something vague", llm=StubLLM(reply="Category: fitness"))
    assert decision.role.key == "fitness"


def test_unrecognised_model_answer_degrades_to_default():
    decision = classify("something vague", llm=StubLLM(reply="banana"))
    assert decision.role.key == "doctor"
    assert decision.confidence == "low"


def test_model_failure_never_breaks_routing():
    """A failed route must still answer. A crash here loses the whole turn."""

    class BrokenLLM:
        def generate_text(self, prompt):
            raise RuntimeError("API down")

    decision = classify("something vague", llm=BrokenLLM())
    assert decision.role.key == "doctor"


def test_empty_message_routes_to_default():
    assert classify("").role.key == "doctor"


def test_multi_word_keywords_outweigh_single_words():
    """'what if' is a far stronger prediction signal than 'if' alone."""
    scores = score_roles("what if I improve my diet")
    assert scores["prediction"] > 0


def test_word_boundaries_prevent_false_matches():
    """'run' must not fire on 'running nose'."""
    scores = score_roles("I have a running nose")
    assert scores["fitness"] == 0
