"""Tests for hereditary risk.

The line this module must not cross is prediction. It connects a recorded
family condition to the user's own results; it never says what will happen.
"""

import pytest

from app.services.heredity import assess, match_condition


def marker(name, label, value, flag="normal"):
    return {"name": name, "label": label, "value": value, "unit": "", "flag": flag}


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Diabetes", "diabetes"),
        ("type 2 diabetes", "diabetes"),
        ("diabetic since 2010", "diabetes"),
        ("sugar problem", "diabetes"),
        ("High BP", "hypertension"),
        ("blood pressure", "hypertension"),
        ("had a heart attack", "heart_disease"),
        ("thyroid issue", "thyroid"),
        ("kidney failure", "kidney_disease"),
        ("anemia", "anaemia"),
        ("anaemia", "anaemia"),
        ("fatty liver", "liver_disease"),
    ],
)
def test_free_text_conditions_are_recognised(text, expected):
    """People type what they remember being told, not a coded diagnosis."""
    assert match_condition(text) == expected


def test_unknown_condition_is_ignored_rather_than_guessed():
    assert match_condition("broken ankle") is None


def test_longer_alias_wins():
    """'blood pressure' must not be claimed by a shorter alias."""
    assert match_condition("high blood pressure") == "hypertension"


def test_family_condition_links_to_the_users_own_markers():
    findings = assess(
        [{"name": "Ramesh", "relation": "father", "conditions": ["Diabetes"]}],
        [marker("hba1c", "HbA1c", 6.4, "high"), marker("tsh", "TSH", 2.1)],
    )
    assert len(findings) == 1
    assert findings[0]["condition"] == "Diabetes"
    # Only the markers that relate to the condition, not everything on file.
    assert [m["name"] for m in findings[0]["your_markers"]] == ["hba1c"]


def test_first_degree_relative_carries_more_weight():
    close = assess(
        [{"name": "Mother", "relation": "mother", "conditions": ["diabetes"]}], []
    )
    distant = assess(
        [{"name": "Cousin", "relation": "cousin", "conditions": ["diabetes"]}], []
    )
    assert close[0]["strength"] == "higher"
    assert distant[0]["strength"] == "some"


def test_several_relatives_with_one_condition_are_grouped():
    findings = assess(
        [
            {"name": "Father", "relation": "father", "conditions": ["diabetes"]},
            {"name": "Aunt", "relation": "aunt", "conditions": ["diabetes"]},
        ],
        [],
    )
    assert len(findings) == 1
    assert len(findings[0]["relatives"]) == 2
    # The closest relation is what the strength reflects.
    assert findings[0]["closest_relation"] == "father"


def test_one_relative_with_several_conditions_yields_several_findings():
    findings = assess(
        [{"name": "Father", "relation": "father", "conditions": ["diabetes", "thyroid"]}],
        [],
    )
    assert {f["condition_key"] for f in findings} == {"diabetes", "thyroid"}


def test_conditions_with_related_readings_sort_first():
    findings = assess(
        [
            {"name": "Father", "relation": "father", "conditions": ["diabetes"]},
            {"name": "Mother", "relation": "mother", "conditions": ["thyroid"]},
        ],
        [marker("tsh", "TSH", 2.1)],
    )
    # Both are first-degree; the one with a reading to look at comes first.
    assert findings[0]["condition_key"] == "thyroid"


def test_no_family_history_yields_nothing():
    assert assess([], [marker("hba1c", "HbA1c", 6.4, "high")]) == []


def test_untrackable_conditions_still_surface_with_guidance():
    """Blood pressure is not measured here, but the family history still matters."""
    findings = assess(
        [{"name": "Father", "relation": "father", "conditions": ["high BP"]}], []
    )
    assert findings[0]["condition_key"] == "hypertension"
    assert findings[0]["your_markers"] == []
    assert "doctor" in findings[0]["watch"]


def test_findings_never_predict():
    """A finding states a link and what to watch. It must not forecast."""
    findings = assess(
        [{"name": "Father", "relation": "father", "conditions": ["diabetes"]}],
        [marker("hba1c", "HbA1c", 6.4, "high")],
    )
    text = " ".join(f["watch"] for f in findings).lower()
    for forbidden in ("you will", "will develop", "you are going to", "guaranteed"):
        assert forbidden not in text
