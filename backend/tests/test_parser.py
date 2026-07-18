"""Tests for handling model output.

Model responses are untrusted input. Everything here is a case that has been
observed from real LLM extraction: fenced JSON, prose wrappers, values with
stray characters, and rows that cannot be read at all.
"""

import pytest

from app.services.parser import (
    MockReportParser,
    ParseError,
    _extract_json,
    _to_float,
    normalise,
)


def test_strips_markdown_fences():
    assert _extract_json('```json\n{"tests": []}\n```') == {"tests": []}


def test_recovers_json_wrapped_in_prose():
    assert _extract_json('Here you go:\n{"tests": []}\nHope that helps') == {"tests": []}


def test_response_without_json_raises():
    with pytest.raises(ParseError):
        _extract_json("I could not read this image.")


def test_malformed_json_raises():
    with pytest.raises(ParseError):
        _extract_json('{"tests": [not valid}')


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("<200", 200.0),
        ("> 40", 40.0),
        ("6.4 %", 6.4),
        ("-1.5", -1.5),
        (14, 14.0),
        ("not detected", None),
        (None, None),
        (True, None),  # bool is an int subclass; must not become 1.0
    ],
)
def test_value_coercion(raw, expected):
    assert _to_float(raw) == expected


def test_bad_rows_are_dropped_without_losing_good_ones():
    """One unreadable line must not cost the user the rest of the report."""
    parsed = normalise(
        {
            "tests": [
                {"name": "HbA1c", "value": 6.4, "unit": "%"},
                {"name": "", "value": 5},
                {"name": "LDL", "value": "unreadable"},
                "garbage string",
                {"name": "HDL", "value": 38, "unit": "mg/dL"},
            ]
        }
    )
    assert [t.name for t in parsed.tests] == ["HbA1c", "HDL"]


def test_unexpected_report_type_is_coerced():
    assert normalise({"report_type": "hacked", "tests": []}).report_type == "other"


def test_missing_tests_key_yields_empty_report():
    assert normalise({}).tests == []


def test_mock_parser_returns_usable_sample():
    """The mock is the demo safety net, so it must stay valid."""
    parsed = MockReportParser().parse(b"", "image/png")
    assert len(parsed.tests) == 9
    assert any(t.name == "HbA1c" for t in parsed.tests)
