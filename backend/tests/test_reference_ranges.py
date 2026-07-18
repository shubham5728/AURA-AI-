"""Tests for naming and flagging.

This is the safety-critical layer. Flagging decides whether a user is told a
value is abnormal, so every boundary condition is pinned here rather than left
to manual checking.
"""

import pytest

from app.services.reference_ranges import (
    canonical_name,
    display_name,
    flag_value,
    resolve_range,
)


@pytest.mark.parametrize(
    "printed",
    ["HbA1c", "Hb A1C", "  glycated   HAEMOGLOBIN ", "Glycosylated Hemoglobin"],
)
def test_aliases_collapse_to_one_key(printed):
    """Trends break silently if the same test lands under two names."""
    assert canonical_name(printed) == "hba1c"


def test_indian_lab_abbreviations():
    assert canonical_name("SGPT") == "alt"
    assert canonical_name("SGOT") == "ast"
    assert canonical_name("FBS") == "fasting_glucose"


@pytest.mark.parametrize(
    "printed,expected",
    [
        # Every one of these came back from a real extraction run and was
        # missed by exact matching, silently splitting one marker into several.
        ("Glycosylated Haemoglobin (HbA1c)", "hba1c"),
        ("SGPT (ALT)", "alt"),
        ("SGOT (AST)", "ast"),
        ("Vitamin D (25-OH)", "vitamin_d"),
        ("Haemoglobin (Hb)", "hemoglobin"),
        ("Fasting Blood Sugar (FBS)", "fasting_glucose"),
    ],
)
def test_parenthetical_qualifiers_still_resolve(printed, expected):
    """Labs qualify test names in brackets. Both halves must be tried."""
    assert canonical_name(printed) == expected


def test_british_and_american_spellings_agree():
    assert canonical_name("Haemoglobin") == canonical_name("Hemoglobin")
    assert canonical_name("Glycated Hemoglobin") == canonical_name("Glycosylated Hemoglobin")


def test_unknown_marker_is_kept_not_dropped():
    """Storing an unrecognised marker beats losing the user's data."""
    assert canonical_name("Serum Zinc") == "serum_zinc"


def test_unknown_marker_with_qualifier_still_groups():
    """Unknown markers must not split on their bracket either."""
    assert canonical_name("Serum Zinc (Zn)") == canonical_name("Serum Zinc")


@pytest.mark.parametrize(
    "value,expected",
    [(3.9, "low"), (4.0, "normal"), (5.0, "normal"), (5.6, "normal"), (5.7, "high")],
)
def test_flag_boundaries_are_inclusive(value, expected):
    """A value sitting exactly on a bound is normal, not abnormal."""
    assert flag_value(value, 4.0, 5.6) == expected


def test_open_ended_ranges():
    """Labs print '< 200' and '> 40'; both must still flag correctly."""
    assert flag_value(214, None, 200) == "high"
    assert flag_value(180, None, 200) == "normal"
    assert flag_value(38, 40, None) == "low"
    assert flag_value(45, 40, None) == "normal"


def test_no_range_means_unknown_never_a_guess():
    assert flag_value(99, None, None) == "unknown"


def test_printed_range_beats_our_default_table():
    """The lab's own range accounts for its assay and the patient. Ours does not."""
    assert resolve_range("HbA1c", 4.2, 6.0) == (4.2, 6.0)


def test_partial_printed_range_is_not_topped_up_from_defaults():
    """Mixing a printed bound with a default one would invent a range nobody stated."""
    assert resolve_range("HbA1c", None, 6.0) == (None, 6.0)


def test_defaults_used_only_when_nothing_printed():
    assert resolve_range("HbA1c", None, None) == (4.0, 5.6)


def test_no_range_is_invented_for_unknown_markers():
    assert resolve_range("Serum Zinc", None, None) == (None, None)


@pytest.mark.parametrize(
    "printed,expected",
    [
        # Every spelling below is copied from a real Indian CBC report.
        ("Total WBC Count", "wbc"),
        ("TLC", "wbc"),
        ("R.B.C. count", "rbc"),
        ("Platelet Count", "platelets"),
        ("RDW-CV", "rdw"),
        ("PCV", "hct"),
        ("Haematocrit", "hct"),
        ("Polymorphs", "neutrophils"),
    ],
)
def test_cbc_names_from_a_real_report(printed, expected):
    assert canonical_name(printed) == expected


@pytest.mark.parametrize(
    "canonical,expected",
    [("hct", "Haematocrit (HCT)"), ("mcv", "MCV"), ("rdw", "RDW-CV"), ("wbc", "WBC Count")],
)
def test_abbreviations_are_not_title_cased(canonical, expected):
    """Title-casing produced "Hct", "Mcv" and "Rdw Cv" on a real report."""
    assert display_name(canonical) == expected


def test_display_names_are_human_readable():
    assert display_name("hba1c") == "HbA1c"
    assert display_name("ldl") == "LDL Cholesterol"
    assert display_name("fasting_glucose") == "Fasting Glucose"
