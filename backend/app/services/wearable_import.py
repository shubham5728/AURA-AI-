"""Parses a real health/wearable export into per-day metrics.

The honest alternative to a fake "device connected" dashboard: the user exports
their own data (Apple Health, Fitbit, Google Takeout) and AURA reads it. Nothing
is synthesised -- every value traces back to a row in the file the user uploaded.

Two formats are understood:

* CSV -- Fitbit, Google Takeout, or a hand-made sheet. Columns are detected by
  name, so "Steps", "Resting Heart Rate", "Minutes Asleep" all map even though
  the exact headers differ between sources.
* Apple Health `export.xml` -- streamed with iterparse because the file is
  routinely hundreds of megabytes; each element is cleared after reading so
  memory stays flat.

Only three metrics are kept -- steps, resting heart rate, sleep -- because those
are the ones every source records and the ones the rest of AURA can use. A metric
missing from the file stays None rather than being guessed.
"""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Dict, List, Optional
from xml.etree import ElementTree as ET


@dataclass
class DayReading:
    measured_on: date
    steps: Optional[int] = None
    resting_hr: Optional[int] = None
    sleep_hours: Optional[float] = None


@dataclass
class ParsedWearable:
    source: str
    days: List[DayReading] = field(default_factory=list)


class WearableParseError(ValueError):
    """The file could not be read as any supported export."""


# --- shared helpers --------------------------------------------------------

def _parse_date(value: str) -> Optional[date]:
    text = (value or "").strip()
    if not text:
        return None
    # Most exports are ISO-ish; take the leading date and try that first.
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        pass
    for fmt in ("%m/%d/%Y", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d", "%m/%d/%y"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    return None


def _to_float(value: str) -> Optional[float]:
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _aggregate(
    steps: Dict[date, float],
    hr: Dict[date, List[float]],
    sleep: Dict[date, float],
) -> List[DayReading]:
    days = sorted(set(steps) | set(hr) | set(sleep))
    out: List[DayReading] = []
    for d in days:
        rhr = hr.get(d)
        out.append(
            DayReading(
                measured_on=d,
                steps=int(round(steps[d])) if d in steps else None,
                resting_hr=int(round(sum(rhr) / len(rhr))) if rhr else None,
                sleep_hours=round(sleep[d], 2) if d in sleep else None,
            )
        )
    return out


# --- CSV --------------------------------------------------------------------

def _find_col(headers: List[str], *, any_of: List[str], all_of: List[str] = []) -> Optional[int]:
    for i, raw in enumerate(headers):
        h = raw.strip().lower()
        if all_of and not all(k in h for k in all_of):
            continue
        if any(k in h for k in any_of):
            return i
    return None


def _parse_csv(content: bytes) -> ParsedWearable:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = [r for r in reader if any(cell.strip() for cell in r)]
    if len(rows) < 2:
        raise WearableParseError("The CSV has no data rows.")

    headers = rows[0]
    date_col = _find_col(headers, any_of=["date", "day"])
    steps_col = _find_col(headers, any_of=["step"])
    # Prefer an explicit "resting" heart column; fall back to a plain HR column.
    hr_col = _find_col(headers, all_of=["resting"], any_of=["heart", "hr"])
    if hr_col is None:
        hr_col = _find_col(headers, any_of=["resting_hr", "restinghr", "rhr"])
    if hr_col is None:
        hr_col = _find_col(headers, all_of=["heart"], any_of=["rate"])
    sleep_col = _find_col(headers, any_of=["sleep", "asleep"])

    if date_col is None or (steps_col is None and hr_col is None and sleep_col is None):
        raise WearableParseError(
            "Could not find a date column and at least one of steps, resting heart "
            "rate, or sleep. Check the export's headers."
        )

    sleep_in_minutes = sleep_col is not None and "min" in headers[sleep_col].strip().lower()

    steps: Dict[date, float] = defaultdict(float)
    hr: Dict[date, List[float]] = defaultdict(list)
    sleep: Dict[date, float] = defaultdict(float)

    def cell(row: List[str], col: Optional[int]) -> Optional[str]:
        return row[col] if col is not None and col < len(row) else None

    for row in rows[1:]:
        d = _parse_date(cell(row, date_col) or "")
        if d is None:
            continue
        s = _to_float(cell(row, steps_col) or "")
        if s is not None:
            steps[d] += s
        h = _to_float(cell(row, hr_col) or "")
        if h is not None and h > 0:
            hr[d].append(h)
        sl = _to_float(cell(row, sleep_col) or "")
        if sl is not None and sl > 0:
            hours = sl / 60 if (sleep_in_minutes or sl > 16) else sl
            sleep[d] += hours

    days = _aggregate(steps, hr, sleep)
    if not days:
        raise WearableParseError("No dated rows could be read from the CSV.")
    return ParsedWearable(source="CSV", days=days)


# --- Apple Health XML -------------------------------------------------------

_APPLE_STEPS = "HKQuantityTypeIdentifierStepCount"
_APPLE_RHR = "HKQuantityTypeIdentifierRestingHeartRate"
_APPLE_SLEEP = "HKCategoryTypeIdentifierSleepAnalysis"


def _apple_date(value: str) -> Optional[date]:
    # Apple stamps look like "2025-07-20 08:14:00 +0530"; the date is the head.
    return _parse_date(value)


def _parse_apple_xml(content: bytes) -> ParsedWearable:
    steps: Dict[date, float] = defaultdict(float)
    hr: Dict[date, List[float]] = defaultdict(list)
    sleep: Dict[date, float] = defaultdict(float)

    saw_record = False
    try:
        for _event, elem in ET.iterparse(io.BytesIO(content), events=("end",)):
            if elem.tag != "Record":
                continue
            saw_record = True
            rtype = elem.get("type", "")
            if rtype == _APPLE_STEPS:
                d = _apple_date(elem.get("startDate", ""))
                v = _to_float(elem.get("value", ""))
                if d and v is not None:
                    steps[d] += v
            elif rtype == _APPLE_RHR:
                d = _apple_date(elem.get("startDate", ""))
                v = _to_float(elem.get("value", ""))
                if d and v is not None and v > 0:
                    hr[d].append(v)
            elif rtype == _APPLE_SLEEP:
                value = elem.get("value", "")
                # Only actual asleep phases count; "InBed"/"Awake" are excluded.
                if "Asleep" in value:
                    start = _parse_apple_datetime(elem.get("startDate", ""))
                    end = _parse_apple_datetime(elem.get("endDate", ""))
                    if start and end and end > start:
                        hours = (end - start).total_seconds() / 3600
                        sleep[start.date()] += hours
            elem.clear()
    except ET.ParseError as exc:
        raise WearableParseError(f"The XML could not be parsed: {exc}") from exc

    if not saw_record:
        raise WearableParseError("No Apple Health records were found in the file.")

    days = _aggregate(steps, hr, sleep)
    if not days:
        raise WearableParseError("No usable step, heart-rate, or sleep records were found.")
    return ParsedWearable(source="Apple Health", days=days)


def _parse_apple_datetime(value: str) -> Optional[datetime]:
    text = (value or "").strip()
    if not text:
        return None
    try:
        # "2025-07-20 08:14:00 +0530"
        return datetime.strptime(text[:19], "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None


# --- entry point ------------------------------------------------------------

def parse_wearable(filename: str, content: bytes) -> ParsedWearable:
    name = (filename or "").lower()
    if name.endswith(".xml"):
        return _parse_apple_xml(content)
    if name.endswith(".csv"):
        return _parse_csv(content)
    # No usable extension: sniff the first bytes.
    head = content[:256].lstrip()
    if head.startswith(b"<?xml") or b"<HealthData" in content[:512]:
        return _parse_apple_xml(content)
    return _parse_csv(content)
