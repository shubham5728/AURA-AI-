"""Tests for handling model output.

Model responses are untrusted input. Everything here is a case that has been
observed from real LLM extraction: fenced JSON, prose wrappers, values with
stray characters, and rows that cannot be read at all.
"""

import pytest

from app.services.parser import (
    GeminiReportParser,
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


def _parser_that_fails_with(error: str) -> GeminiReportParser:
    """A GeminiReportParser whose API client always raises.

    Built with __new__ so no real client is constructed and no key is needed.
    """
    parser = GeminiReportParser.__new__(GeminiReportParser)

    class _Models:
        def generate_content(self, **_kwargs):
            raise RuntimeError(error)

    class _Client:
        models = _Models()

    parser._client = _Client()
    parser._model = "test-model"
    parser._fallback_model = ""
    return parser


@pytest.mark.parametrize(
    "provider_error,expected",
    [
        (
            "429 RESOURCE_EXHAUSTED {'error': {'code': 429, 'quotaMetric': 'generate_content'}}",
            "daily limit",
        ),
        ("403 PERMISSION_DENIED invalid API_KEY", "not configured"),
        ("connection reset by peer", "could not be read"),
    ],
)
def test_provider_errors_become_readable_messages(provider_error, expected):
    """Someone who uploaded a blood report must not be shown quota JSON."""
    with pytest.raises(ParseError) as exc:
        _parser_that_fails_with(provider_error).parse(b"x", "image/png")

    message = str(exc.value)
    assert expected in message
    for leak in ("RESOURCE_EXHAUSTED", "quotaMetric", "PERMISSION_DENIED", "429"):
        assert leak not in message


def _parser_with_fallback(errors, fallback="fallback-model"):
    """A parser whose client raises the given errors in order, then succeeds."""
    parser = GeminiReportParser.__new__(GeminiReportParser)
    calls = []

    class _Models:
        def generate_content(self, *, model, contents):
            calls.append(model)
            if calls_remaining := errors[len(calls) - 1] if len(calls) <= len(errors) else None:
                raise RuntimeError(calls_remaining)

            class _R:
                text = '{"tests":[{"name":"HbA1c","value":6.4,"unit":"%"}]}'

            return _R()

    class _Client:
        models = _Models()

    parser._client = _Client()
    parser._model = "primary-model"
    parser._fallback_model = fallback
    return parser, calls


def test_quota_error_falls_back_to_the_lighter_model():
    """Free-tier limits are per-model, so a quota failure is worth retrying
    elsewhere rather than giving up on the upload."""
    quota = "429 RESOURCE_EXHAUSTED quota exceeded"
    parser, calls = _parser_with_fallback([quota, quota])

    result = parser.parse(b"x", "image/png")

    assert calls == ["primary-model", "primary-model", "fallback-model"]
    assert result.tests[0].name == "HbA1c"


def test_non_quota_failure_does_not_reach_for_the_fallback():
    """A malformed image fails the same way on a weaker model. Retrying there
    only costs time and a second API call."""
    parser, calls = _parser_with_fallback(["connection reset", "connection reset"])

    with pytest.raises(ParseError):
        parser.parse(b"x", "image/png")

    assert "fallback-model" not in calls


def test_failure_message_tells_the_user_their_upload_survived():
    """The file is kept on a failed parse, so the message must say so."""
    with pytest.raises(ParseError) as exc:
        _parser_that_fails_with("boom").parse(b"x", "image/png")
    assert "saved" in str(exc.value)


def test_mock_parser_returns_usable_sample():
    """The mock is the demo safety net, so it must stay valid."""
    parsed = MockReportParser().parse(b"", "image/png")
    assert len(parsed.tests) == 9
    assert any(t.name == "HbA1c" for t in parsed.tests)
