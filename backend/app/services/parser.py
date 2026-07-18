"""Report extraction.

Per Decision 1 in ROADMAP.md, a multimodal model reads the report image
directly and returns structured JSON, rather than running generic OCR and then
asking a model to make sense of scrambled text.

Everything sits behind the `ReportParser` interface so the implementation can be
swapped for Vision API or Tesseract without touching the upload route -- that
swap is the documented fallback if extraction accuracy proves too low.

Interpretation is *not* done here. The model reports what is printed; flagging
happens in reference_ranges.py against stored ranges.
"""

import json
import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """You are reading a medical lab report image.

Extract EVERY test result you can see. Return ONLY a JSON object, no prose and
no markdown fences, in exactly this shape:

{
  "report_type": "blood_test" | "prescription" | "other",
  "measured_at": "YYYY-MM-DD or null",
  "tests": [
    {
      "name": "test name exactly as printed",
      "value": number,
      "unit": "unit as printed or null",
      "ref_low": number or null,
      "ref_high": number or null
    }
  ]
}

Rules:
- Copy values exactly as printed. Do not convert units or round.
- If a reference range is printed as "13.0 - 17.0", split it into ref_low and
  ref_high. For "< 200" use ref_low null and ref_high 200. For "> 40" use
  ref_low 40 and ref_high null.
- Omit any test whose numeric value you cannot read clearly. A missing test is
  recoverable; a guessed value is not.
- Do not interpret, diagnose, or comment on whether a value is normal.
"""


@dataclass
class ParsedTest:
    name: str
    value: float
    unit: Optional[str] = None
    ref_low: Optional[float] = None
    ref_high: Optional[float] = None


@dataclass
class ParsedReport:
    tests: List[ParsedTest] = field(default_factory=list)
    report_type: str = "blood_test"
    measured_at: Optional[str] = None
    raw: Optional[dict] = None


class ParseError(Exception):
    """Extraction failed in a way the caller should surface to the user."""


class ReportParser(ABC):
    @abstractmethod
    def parse(self, file_bytes: bytes, mime_type: str) -> ParsedReport:
        ...


def _extract_json(text: str) -> dict:
    """Pull a JSON object out of a model response.

    Models wrap JSON in ``` fences often enough that stripping them is cheaper
    than a retry.
    """
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Last resort: grab the outermost braces.
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            raise ParseError("Model response contained no JSON object.")
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise ParseError(f"Model returned malformed JSON: {exc}")


def _to_float(value) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    # Strip stray characters labs print alongside numbers ("<200", "6.4 %").
    match = re.search(r"-?\d+(?:\.\d+)?", str(value))
    return float(match.group(0)) if match else None


def normalise(payload: dict) -> ParsedReport:
    """Turn raw model output into validated tests, dropping anything unusable.

    Silently skipping a malformed row is intentional: one unreadable line should
    not cost the user the other twenty that parsed fine.
    """
    tests: List[ParsedTest] = []

    for item in payload.get("tests") or []:
        if not isinstance(item, dict):
            continue

        name = str(item.get("name") or "").strip()
        value = _to_float(item.get("value"))
        if not name or value is None:
            logger.info("Skipping unusable test row: %r", item)
            continue

        unit = item.get("unit")
        tests.append(
            ParsedTest(
                name=name,
                value=value,
                unit=str(unit).strip() if unit else None,
                ref_low=_to_float(item.get("ref_low")),
                ref_high=_to_float(item.get("ref_high")),
            )
        )

    report_type = str(payload.get("report_type") or "blood_test")
    if report_type not in {"blood_test", "prescription", "other"}:
        report_type = "other"

    measured_at = payload.get("measured_at")
    return ParsedReport(
        tests=tests,
        report_type=report_type,
        measured_at=str(measured_at) if measured_at else None,
        raw=payload,
    )


class GeminiReportParser(ReportParser):
    """Multimodal extraction via the Gemini API."""

    def __init__(self, api_key: str, model: str):
        from google import genai

        self._client = genai.Client(api_key=api_key)
        self._model = model

    def parse(self, file_bytes: bytes, mime_type: str) -> ParsedReport:
        from google.genai import types

        last_error: Optional[Exception] = None

        # One retry only. A second malformed response usually means the image is
        # the problem, not the model, and further retries just burn demo time.
        for attempt in (1, 2):
            try:
                response = self._client.models.generate_content(
                    model=self._model,
                    contents=[
                        types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                        EXTRACTION_PROMPT,
                    ],
                )
                return normalise(_extract_json(response.text or ""))
            except ParseError as exc:
                last_error = exc
                logger.warning("Extraction attempt %s returned bad JSON: %s", attempt, exc)
            except Exception as exc:
                last_error = exc
                logger.warning("Extraction attempt %s failed: %s", attempt, exc)

        raise ParseError(f"Extraction failed after 2 attempts: {last_error}")


class MockReportParser(ReportParser):
    """Fixed sample output, used when no API key is configured.

    Lets the entire upload path -- storage, extraction, flagging, persistence,
    trends -- be built and tested without an API key or network access. It is
    also the safety net for a live demo: if the API is unreachable on stage, the
    flow still runs end to end.
    """

    SAMPLE = {
        "report_type": "blood_test",
        "measured_at": "2026-07-10",
        "tests": [
            {"name": "Hemoglobin", "value": 14.2, "unit": "g/dL", "ref_low": 13.0, "ref_high": 17.0},
            {"name": "HbA1c", "value": 6.4, "unit": "%", "ref_low": 4.0, "ref_high": 5.6},
            {"name": "Fasting Glucose", "value": 112, "unit": "mg/dL", "ref_low": 70, "ref_high": 99},
            {"name": "Total Cholesterol", "value": 214, "unit": "mg/dL", "ref_low": None, "ref_high": 200},
            {"name": "HDL", "value": 38, "unit": "mg/dL", "ref_low": 40, "ref_high": 60},
            {"name": "LDL", "value": 142, "unit": "mg/dL", "ref_low": None, "ref_high": 100},
            {"name": "Triglycerides", "value": 168, "unit": "mg/dL", "ref_low": None, "ref_high": 150},
            {"name": "Vitamin D", "value": 18.5, "unit": "ng/mL", "ref_low": 30, "ref_high": 100},
            {"name": "TSH", "value": 2.1, "unit": "mIU/L", "ref_low": 0.4, "ref_high": 4.0},
        ],
    }

    def parse(self, file_bytes: bytes, mime_type: str) -> ParsedReport:
        logger.warning("MockReportParser in use -- returning sample data, not the uploaded file.")
        return normalise(self.SAMPLE)


def get_parser() -> ReportParser:
    """Select an implementation based on configuration."""
    from app.config import get_settings

    settings = get_settings()
    if settings.gemini_api_key:
        return GeminiReportParser(settings.gemini_api_key, settings.gemini_model)

    logger.warning("GEMINI_API_KEY not set -- falling back to MockReportParser.")
    return MockReportParser()
