"""Tests for the wearable export parser.

The parser is the honest core of the wearable feature: it reads a file the user
exported themselves and must report only what is actually in it. These tests
pin down the two formats, the unit handling that trips people up (sleep in
minutes vs hours), and the rule that a missing metric stays None rather than
being invented.
"""

from datetime import date

import pytest

from app.services.wearable_import import WearableParseError, parse_wearable


def _days_by_date(parsed):
    return {d.measured_on: d for d in parsed.days}


# --- CSV --------------------------------------------------------------------

def test_csv_reads_steps_hr_and_sleep_minutes():
    csv = (
        b"Date,Steps,Resting Heart Rate,Minutes Asleep\n"
        b"2026-07-18,8200,61,432\n"
        b"2026-07-19,10500,59,455\n"
    )
    parsed = parse_wearable("fitbit.csv", csv)
    assert parsed.source == "CSV"
    days = _days_by_date(parsed)

    assert days[date(2026, 7, 18)].steps == 8200
    assert days[date(2026, 7, 18)].resting_hr == 61
    # 432 minutes -> 7.2 hours
    assert days[date(2026, 7, 18)].sleep_hours == pytest.approx(7.2, abs=0.01)


def test_csv_treats_large_sleep_values_as_minutes():
    # No "minute" in the header, but 420 cannot be hours in a day -- it's minutes.
    csv = b"date,sleep\n2026-07-20,420\n"
    parsed = parse_wearable("x.csv", csv)
    assert _days_by_date(parsed)[date(2026, 7, 20)].sleep_hours == pytest.approx(7.0, abs=0.01)


def test_csv_keeps_hours_when_plausible():
    csv = b"date,sleep hours\n2026-07-20,7.5\n"
    parsed = parse_wearable("x.csv", csv)
    assert _days_by_date(parsed)[date(2026, 7, 20)].sleep_hours == pytest.approx(7.5, abs=0.01)


def test_csv_missing_metric_stays_none():
    csv = b"Date,Steps\n2026-07-21,5000\n"
    parsed = parse_wearable("steps.csv", csv)
    day = _days_by_date(parsed)[date(2026, 7, 21)]
    assert day.steps == 5000
    assert day.resting_hr is None
    assert day.sleep_hours is None


def test_csv_aggregates_multiple_rows_per_day():
    csv = b"date,steps\n2026-07-22,3000\n2026-07-22,2500\n"
    parsed = parse_wearable("x.csv", csv)
    assert _days_by_date(parsed)[date(2026, 7, 22)].steps == 5500


def test_csv_without_recognisable_columns_raises():
    csv = b"foo,bar\n1,2\n"
    with pytest.raises(WearableParseError):
        parse_wearable("bad.csv", csv)


# --- Apple Health XML -------------------------------------------------------

APPLE = b"""<?xml version="1.0"?><HealthData>
<Record type="HKQuantityTypeIdentifierStepCount" startDate="2026-07-21 08:00:00 +0000" endDate="2026-07-21 08:10:00 +0000" value="500"/>
<Record type="HKQuantityTypeIdentifierStepCount" startDate="2026-07-21 09:00:00 +0000" endDate="2026-07-21 09:10:00 +0000" value="700"/>
<Record type="HKQuantityTypeIdentifierRestingHeartRate" startDate="2026-07-21 07:00:00 +0000" endDate="2026-07-21 07:00:00 +0000" value="58"/>
<Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepCore" startDate="2026-07-21 23:00:00 +0000" endDate="2026-07-22 06:30:00 +0000"/>
<Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisInBed" startDate="2026-07-21 22:30:00 +0000" endDate="2026-07-22 07:00:00 +0000"/>
</HealthData>"""


def test_apple_sums_steps_and_reads_hr_and_sleep():
    parsed = parse_wearable("export.xml", APPLE)
    assert parsed.source == "Apple Health"
    day = _days_by_date(parsed)[date(2026, 7, 21)]
    assert day.steps == 1200          # 500 + 700
    assert day.resting_hr == 58
    # 23:00 -> 06:30 asleep = 7.5h; the "InBed" record is excluded.
    assert day.sleep_hours == pytest.approx(7.5, abs=0.01)


def test_apple_ignores_inbed_only_and_reports_asleep():
    xml = b"""<?xml version="1.0"?><HealthData>
    <Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisInBed" startDate="2026-07-21 22:00:00 +0000" endDate="2026-07-22 07:00:00 +0000"/>
    <Record type="HKQuantityTypeIdentifierStepCount" startDate="2026-07-21 09:00:00 +0000" endDate="2026-07-21 09:10:00 +0000" value="100"/>
    </HealthData>"""
    parsed = parse_wearable("export.xml", xml)
    day = _days_by_date(parsed)[date(2026, 7, 21)]
    assert day.sleep_hours is None    # only InBed, no Asleep
    assert day.steps == 100


def test_empty_apple_export_raises():
    with pytest.raises(WearableParseError):
        parse_wearable("export.xml", b"<?xml version='1.0'?><HealthData></HealthData>")


def test_sniffs_apple_xml_without_extension():
    parsed = parse_wearable("download", APPLE)
    assert parsed.source == "Apple Health"
