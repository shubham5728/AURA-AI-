import logging
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Biomarker, Report, User
from app.schemas import BiomarkerOut, ReportDetailOut, ReportOut, TrendOut, TrendPoint
from app.services import storage
from app.services.parser import ParseError, ParsedReport, get_parser
from app.services.reference_ranges import (
    canonical_name,
    display_name,
    flag_value,
    resolve_range,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reports", tags=["reports"])

ABNORMAL = {"low", "high"}


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").date()
    except ValueError:
        logger.info("Unparseable measured_at from model: %r", value)
        return None


def _to_biomarker_out(marker: Biomarker) -> BiomarkerOut:
    return BiomarkerOut(
        id=marker.id,
        name=marker.name,
        label=display_name(marker.name),
        value=marker.value,
        unit=marker.unit,
        ref_low=marker.ref_low,
        ref_high=marker.ref_high,
        flag=marker.flag,
        measured_at=marker.measured_at,
    )


def _to_report_out(report: Report) -> ReportOut:
    markers = report.biomarkers or []
    return ReportOut(
        id=report.id,
        report_type=report.report_type,
        parse_status=report.parse_status,
        parse_error=report.parse_error,
        created_at=report.created_at,
        biomarker_count=len(markers),
        abnormal_count=sum(1 for m in markers if m.flag in ABNORMAL),
    )


def _persist_biomarkers(
    db: Session, report: Report, parsed: ParsedReport
) -> List[Biomarker]:
    """Turn extracted tests into flagged biomarker rows.

    The flag is computed here, from the stored range -- never taken from the
    model. Same inputs always produce the same flag.
    """
    measured_at = _parse_date(parsed.measured_at)
    created: List[Biomarker] = []

    for test in parsed.tests:
        name = canonical_name(test.name)
        ref_low, ref_high = resolve_range(test.name, test.ref_low, test.ref_high)

        marker = Biomarker(
            report_id=report.id,
            name=name,
            value=test.value,
            unit=test.unit,
            ref_low=ref_low,
            ref_high=ref_high,
            flag=flag_value(test.value, ref_low, ref_high),
            measured_at=measured_at,
        )
        db.add(marker)
        created.append(marker)

    return created


@router.post("", response_model=ReportDetailOut, status_code=status.HTTP_201_CREATED)
def upload_report(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportDetailOut:
    """Upload a report, extract its values, and store them as biomarkers.

    Parsing runs inline rather than as a background job. A user who uploads a
    report expects to see it read back immediately, and a queue would add
    infrastructure with no benefit at this scale.
    """
    content = file.file.read()
    storage.validate_upload(content, file.content_type or "")
    file_url, abs_path = storage.save_upload(content, file.content_type, user.id)

    report = Report(user_id=user.id, file_url=file_url, parse_status="pending")
    db.add(report)
    db.commit()
    db.refresh(report)

    try:
        parsed = get_parser().parse(content, file.content_type)
    except ParseError as exc:
        # The row is kept, not deleted. A failed parse is recoverable -- the file
        # is still stored, so it can be retried or entered manually.
        report.parse_status = "failed"
        report.parse_error = str(exc)
        db.commit()
        db.refresh(report)
        logger.warning("Parse failed for report=%s: %s", report.id, exc)
        return ReportDetailOut(**_to_report_out(report).model_dump(), biomarkers=[])

    _persist_biomarkers(db, report, parsed)

    report.extracted_json = parsed.raw
    report.report_type = parsed.report_type
    report.parse_status = "parsed" if parsed.tests else "empty"
    report.parsed_at = datetime.utcnow()
    if not parsed.tests:
        report.parse_error = "No readable test values were found in this file."

    db.commit()
    db.refresh(report)

    return ReportDetailOut(
        **_to_report_out(report).model_dump(),
        biomarkers=[_to_biomarker_out(m) for m in report.biomarkers],
    )


@router.get("", response_model=List[ReportOut])
def list_reports(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ReportOut]:
    reports = (
        db.query(Report)
        .filter(Report.user_id == user.id)
        .order_by(Report.created_at.desc())
        .all()
    )
    return [_to_report_out(r) for r in reports]


@router.get("/trends", response_model=List[TrendOut])
def biomarker_trends(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[TrendOut]:
    """Every marker across every report, grouped and ordered oldest first.

    Declared before /{report_id} on purpose -- FastAPI matches routes in order,
    and "trends" would otherwise be captured as a report id.
    """
    rows = (
        db.query(Biomarker)
        .join(Report, Biomarker.report_id == Report.id)
        .filter(Report.user_id == user.id)
        .order_by(Biomarker.name, Biomarker.measured_at, Biomarker.id)
        .all()
    )

    grouped: dict = {}
    for marker in rows:
        trend = grouped.get(marker.name)
        if trend is None:
            trend = TrendOut(
                name=marker.name,
                label=display_name(marker.name),
                unit=marker.unit,
                ref_low=marker.ref_low,
                ref_high=marker.ref_high,
                points=[],
            )
            grouped[marker.name] = trend

        trend.points.append(
            TrendPoint(
                value=marker.value,
                measured_at=marker.measured_at,
                flag=marker.flag,
                report_id=marker.report_id,
            )
        )

    return list(grouped.values())


@router.get("/{report_id}", response_model=ReportDetailOut)
def get_report(
    report_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportDetailOut:
    report = (
        db.query(Report)
        .filter(Report.id == report_id, Report.user_id == user.id)
        .first()
    )
    # Filtering on user_id means another user's report is indistinguishable from
    # one that does not exist -- no id enumeration.
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found."
        )

    return ReportDetailOut(
        **_to_report_out(report).model_dump(),
        biomarkers=[_to_biomarker_out(m) for m in report.biomarkers],
    )


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    report = (
        db.query(Report)
        .filter(Report.id == report_id, Report.user_id == user.id)
        .first()
    )
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found."
        )

    storage.delete_upload(report.file_url)
    db.delete(report)  # biomarkers cascade
    db.commit()
