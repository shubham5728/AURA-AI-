"""Importing and reading real wearable data.

There is no live device connection here by design -- the numbers come from a
file the user exported from their own watch or phone. The parser does the
reading; this router stores what it found (one row per day, updated on
re-import) and reports honest counts and averages over the days that actually
had data. Everything is scoped to the owner by user_id.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, WearableReading
from app.schemas import WearableImportOut, WearableSummaryOut, WearableReadingOut
from app.services.wearable_import import WearableParseError, parse_wearable

router = APIRouter(prefix="/api/wearable", tags=["wearable"])

# Apple Health exports can be large; cap the upload so a single request cannot
# exhaust memory on a small instance. CSVs are far smaller than this.
_MAX_BYTES = 50 * 1024 * 1024


def _summary(readings: List[WearableReading]) -> WearableSummaryOut:
    if not readings:
        return WearableSummaryOut(days=0, sources=[], readings=[])

    steps = [r.steps for r in readings if r.steps is not None]
    hrs = [r.resting_hr for r in readings if r.resting_hr is not None]
    sleeps = [r.sleep_hours for r in readings if r.sleep_hours is not None]
    dates = [r.measured_on for r in readings]

    ordered = sorted(readings, key=lambda r: r.measured_on, reverse=True)
    return WearableSummaryOut(
        days=len(readings),
        date_from=min(dates),
        date_to=max(dates),
        sources=sorted({r.source for r in readings}),
        avg_steps=int(round(sum(steps) / len(steps))) if steps else None,
        avg_resting_hr=int(round(sum(hrs) / len(hrs))) if hrs else None,
        avg_sleep_hours=round(sum(sleeps) / len(sleeps), 1) if sleeps else None,
        # Recent window only, so the response stays small on a long history.
        readings=[WearableReadingOut.model_validate(r) for r in ordered[:30]],
    )


@router.post("/import", response_model=WearableImportOut, status_code=status.HTTP_201_CREATED)
def import_wearable(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WearableImportOut:
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The file was empty.")
    if len(content) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="The export is larger than 50 MB. Trim the date range and export again.",
        )

    try:
        parsed = parse_wearable(file.filename or "", content)
    except WearableParseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # Upsert per (day, source): re-importing an overlapping export updates the
    # day rather than duplicating it, and merges in any metric it newly carries.
    imported = 0
    for day in parsed.days:
        row = (
            db.query(WearableReading)
            .filter(
                WearableReading.user_id == user.id,
                WearableReading.measured_on == day.measured_on,
                WearableReading.source == parsed.source,
            )
            .first()
        )
        if row is None:
            row = WearableReading(
                user_id=user.id, measured_on=day.measured_on, source=parsed.source
            )
            db.add(row)
        if day.steps is not None:
            row.steps = day.steps
        if day.resting_hr is not None:
            row.resting_hr = day.resting_hr
        if day.sleep_hours is not None:
            row.sleep_hours = day.sleep_hours
        imported += 1
    db.commit()

    readings = db.query(WearableReading).filter(WearableReading.user_id == user.id).all()
    return WearableImportOut(imported=imported, source=parsed.source, summary=_summary(readings))


@router.get("", response_model=WearableSummaryOut)
def get_wearable(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WearableSummaryOut:
    readings = db.query(WearableReading).filter(WearableReading.user_id == user.id).all()
    return _summary(readings)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_wearable(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    db.query(WearableReading).filter(WearableReading.user_id == user.id).delete()
    db.commit()
