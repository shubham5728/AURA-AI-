"""Tests for the physiological-system view of the Digital Twin.

The point of the feature is that every tab is real. These pin that a system
with no data admits it rather than showing an invented value, and that the two
computed figures are computed correctly.
"""

from datetime import date

from app.models import Biomarker, DailyLog, Profile, Report
from app.services.twin_systems import build_systems


def _system(systems, key):
    return next(s for s in systems if s.key == key)


def test_every_system_names_a_real_specialist(db_session, test_user):
    valid = {"doctor", "nutrition", "fitness", "medication", "prediction"}
    for system in build_systems(db_session, test_user):
        assert system.covered_by in valid


def test_a_new_user_has_no_system_data(db_session, test_user):
    """No labs, no logs, no profile -- every system reports empty rather than
    filling gauges with zeros."""
    for system in build_systems(db_session, test_user):
        assert system.has_data is False
        assert system.unlock_hint  # tells the user how to populate it


def test_bmi_and_bmr_are_computed_from_the_profile(db_session, test_user):
    db_session.add(Profile(
        user_id=test_user.id, dob=date(1990, 1, 1), sex="male",
        height_cm=180, weight_kg=80, conditions=[], allergies=[], goals=[],
    ))
    db_session.commit()

    metabolic = _system(build_systems(db_session, test_user), "metabolic")
    bmi = next(m for m in metabolic.metrics if m.label == "BMI")
    bmr = next(m for m in metabolic.metrics if m.label == "Basal metabolic rate")

    assert bmi.value == 24.7  # 80 / 1.8^2
    assert bmi.computed is True
    # Mifflin-St Jeor, male: 10*80 + 6.25*180 - 5*age + 5
    age = date.today().year - 1990 - (1 if (date.today().month, date.today().day) < (1, 1) else 0)
    assert bmr.value == round(10 * 80 + 6.25 * 180 - 5 * age + 5)
    assert bmr.computed is True


def test_bmr_uses_the_female_coefficient(db_session, test_user):
    db_session.add(Profile(
        user_id=test_user.id, dob=date(1990, 1, 1), sex="female",
        height_cm=165, weight_kg=60, conditions=[], allergies=[], goals=[],
    ))
    db_session.commit()

    metabolic = _system(build_systems(db_session, test_user), "metabolic")
    bmr = next(m for m in metabolic.metrics if m.label == "Basal metabolic rate")
    age = date.today().year - 1990 - (1 if (date.today().month, date.today().day) < (1, 1) else 0)
    assert bmr.value == round(10 * 60 + 6.25 * 165 - 5 * age - 161)


def test_a_lab_value_populates_its_system(db_session, test_user):
    report = Report(user_id=test_user.id, file_url="x", parse_status="parsed")
    db_session.add(report)
    db_session.commit()
    db_session.add(Biomarker(
        report_id=report.id, name="hba1c", value=6.4, unit="%",
        ref_low=4.0, ref_high=5.6, flag="high", measured_at=date(2026, 7, 10),
    ))
    db_session.commit()

    metabolic = _system(build_systems(db_session, test_user), "metabolic")
    hba1c = next(m for m in metabolic.metrics if m.label == "HbA1c")
    assert hba1c.value == 6.4
    assert hba1c.status == "attention"  # high
    assert metabolic.has_data is True


def test_a_normal_value_reads_as_good(db_session, test_user):
    report = Report(user_id=test_user.id, file_url="x", parse_status="parsed")
    db_session.add(report)
    db_session.commit()
    db_session.add(Biomarker(
        report_id=report.id, name="hemoglobin", value=14.2, unit="g/dL",
        ref_low=13.0, ref_high=17.0, flag="normal",
    ))
    db_session.commit()

    blood = _system(build_systems(db_session, test_user), "blood")
    hb = next(m for m in blood.metrics if m.label == "Haemoglobin")
    assert hb.status == "good"


def test_logged_habits_populate_lifestyle(db_session, test_user):
    from datetime import timedelta
    db_session.add(DailyLog(
        user_id=test_user.id, date=date.today() - timedelta(days=1),
        steps=9000, sleep_hours=5.0, water_ml=2600,
    ))
    db_session.commit()

    lifestyle = _system(build_systems(db_session, test_user), "lifestyle")
    steps = next(m for m in lifestyle.metrics if m.label == "Steps")
    sleep = next(m for m in lifestyle.metrics if m.label == "Sleep")

    assert steps.status == "good"       # 9000 >= 8000
    assert sleep.status == "attention"  # 5 < 7


def test_systems_cover_distinct_body_regions(db_session, test_user):
    regions = [s.region for s in build_systems(db_session, test_user)]
    # Each tab lights a different part of the figure, so switching tabs visibly
    # moves the highlight.
    assert len(set(regions)) == len(regions)


def test_missing_markers_are_named(db_session, test_user):
    """The honest substitute for a confidence score: which markers this system
    looked for and did not find."""
    metabolic = _system(build_systems(db_session, test_user), "metabolic")
    assert "HbA1c" in metabolic.missing
    assert "Fasting glucose" in metabolic.missing


def test_a_present_marker_leaves_the_missing_list(db_session, test_user):
    report = Report(user_id=test_user.id, file_url="x", parse_status="parsed")
    db_session.add(report)
    db_session.commit()
    db_session.add(Biomarker(
        report_id=report.id, name="hba1c", value=5.2, unit="%",
        ref_low=4.0, ref_high=5.6, flag="normal",
    ))
    db_session.commit()

    metabolic = _system(build_systems(db_session, test_user), "metabolic")
    assert "HbA1c" not in metabolic.missing


def test_relationships_point_at_real_tabs(db_session, test_user):
    """A 'relates to' link must open another system that exists, or clicking it
    goes nowhere."""
    systems = build_systems(db_session, test_user)
    keys = {s.key for s in systems}
    for system in systems:
        for related in system.relates_to:
            assert related.key in keys
            assert related.key != system.key  # never links to itself


def test_metrics_carry_a_plain_language_explanation(db_session, test_user):
    for system in build_systems(db_session, test_user):
        for metric in system.metrics:
            assert metric.explanation, f"{metric.label} has no explanation"


def test_direction_reads_movement_toward_the_range(db_session, test_user):
    """Improving means closer to the middle of the range, not merely lower.

    HbA1c falling 7.5 -> 6.4 moves toward the 4.0-5.6 band, so it improves even
    though a naive 'went down' rule and a 'went up is worse' rule would both
    mislabel some markers.
    """
    report_a = Report(user_id=test_user.id, file_url="a", parse_status="parsed",
                      created_at=None)
    db_session.add(report_a)
    db_session.commit()
    db_session.add(Biomarker(report_id=report_a.id, name="hba1c", value=7.5,
                             unit="%", ref_low=4.0, ref_high=5.6, flag="high",
                             measured_at=date(2026, 1, 1)))
    report_b = Report(user_id=test_user.id, file_url="b", parse_status="parsed")
    db_session.add(report_b)
    db_session.commit()
    db_session.add(Biomarker(report_id=report_b.id, name="hba1c", value=6.4,
                             unit="%", ref_low=4.0, ref_high=5.6, flag="high",
                             measured_at=date(2026, 6, 1)))
    db_session.commit()

    metabolic = _system(build_systems(db_session, test_user), "metabolic")
    hba1c = next(m for m in metabolic.metrics if m.label == "HbA1c")
    assert hba1c.direction == "improving"
    assert hba1c.history == [7.5, 6.4]


def test_system_summary_leads_with_abnormal_count(db_session, test_user):
    report = Report(user_id=test_user.id, file_url="x", parse_status="parsed")
    db_session.add(report)
    db_session.commit()
    db_session.add_all([
        Biomarker(report_id=report.id, name="ldl", value=180, unit="mg/dL",
                  ref_low=None, ref_high=100, flag="high"),
        Biomarker(report_id=report.id, name="hdl", value=55, unit="mg/dL",
                  ref_low=40, ref_high=60, flag="normal"),
    ])
    db_session.commit()

    heart = _system(build_systems(db_session, test_user), "heart")
    summary = heart.summary()
    assert summary["tone"] == "attention"
    assert "1 of 2" in summary["headline"]
