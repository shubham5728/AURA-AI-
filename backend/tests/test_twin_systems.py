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
