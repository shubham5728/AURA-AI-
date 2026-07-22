"""Wearable data: a real Fitbit link, plus an import fallback for the rest.

Two honest paths, because a browser app cannot sync every device:

* Fitbit -- a real OAuth link. "Connected" means tokens exist and a sync ran;
  there is no fake connected state, and when the server has no Fitbit
  credentials the status says so.
* Everything else (Apple Watch has no web API, Google Fit's is retiring) -- the
  user imports the file they exported themselves.

Both funnel into the same wearable_readings store and the same summary, scoped
to the owner by user_id.
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models import FitbitConnection, User, WearableReading
from app.schemas import (
    FitbitStatusOut,
    WearableImportOut,
    WearableReadingOut,
    WearableSummaryOut,
)
from app.services import fitbit
from app.services.wearable_import import DayReading, WearableParseError, parse_wearable

router = APIRouter(prefix="/api/wearable", tags=["wearable"])

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
        readings=[WearableReadingOut.model_validate(r) for r in ordered[:30]],
    )


def _store_readings(db: Session, user_id: int, days: List[DayReading], source: str) -> int:
    """Upsert per (day, source): re-syncing updates rather than duplicating."""
    stored = 0
    for day in days:
        row = (
            db.query(WearableReading)
            .filter(
                WearableReading.user_id == user_id,
                WearableReading.measured_on == day.measured_on,
                WearableReading.source == source,
            )
            .first()
        )
        if row is None:
            row = WearableReading(user_id=user_id, measured_on=day.measured_on, source=source)
            db.add(row)
        if day.steps is not None:
            row.steps = day.steps
        if day.resting_hr is not None:
            row.resting_hr = day.resting_hr
        if day.sleep_hours is not None:
            row.sleep_hours = day.sleep_hours
        stored += 1
    db.commit()
    return stored


# --- file import (Apple / Fitbit CSV / Google / manual) ---------------------

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

    imported = _store_readings(db, user.id, parsed.days, parsed.source)
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


# --- Fitbit (real device connect) -------------------------------------------

@router.get("/fitbit/status", response_model=FitbitStatusOut)
def fitbit_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FitbitStatusOut:
    conn = db.query(FitbitConnection).filter(FitbitConnection.user_id == user.id).first()
    return FitbitStatusOut(
        configured=fitbit.is_configured(),
        connected=conn is not None,
        last_synced_at=conn.last_synced_at if conn else None,
    )


@router.get("/fitbit/authorize")
def fitbit_authorize(user: User = Depends(get_current_user)) -> dict:
    """Return the Fitbit consent URL for the browser to redirect to."""
    if not fitbit.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Fitbit sync is not set up on the server yet.",
        )
    state = fitbit.sign_state(user.id)
    return {"url": fitbit.build_authorize_url(state)}


@router.get("/fitbit/callback")
def fitbit_callback(
    code: str = "",
    state: str = "",
    error: str = "",
    db: Session = Depends(get_db),
):
    """Fitbit redirects the browser here after the user consents.

    Not an authenticated API call -- the user is identified by the signed
    `state`, which also guards against forged callbacks. On success it syncs and
    sends the browser back to the wearable page.
    """
    frontend = get_settings().frontend_url.rstrip("/")

    def back(status_param: str) -> RedirectResponse:
        return RedirectResponse(url=f"{frontend}/app/wearable?fitbit={status_param}")

    if error or not code:
        return back("cancelled")

    user_id = fitbit.verify_state(state)
    if user_id is None:
        return back("error")

    try:
        tokens = fitbit.exchange_code(code)
    except fitbit.FitbitError:
        return back("error")

    conn = db.query(FitbitConnection).filter(FitbitConnection.user_id == user_id).first()
    if conn is None:
        conn = FitbitConnection(user_id=user_id, access_token="", refresh_token="")
        db.add(conn)
    conn.access_token = tokens["access_token"]
    conn.refresh_token = tokens.get("refresh_token", "")
    conn.expires_at = fitbit.expiry_from(tokens)
    conn.fitbit_user_id = tokens.get("user_id")

    try:
        days = fitbit.fetch_readings(conn.access_token)
        _store_readings(db, user_id, days, "Fitbit")
        conn.last_synced_at = datetime.utcnow()
    except fitbit.FitbitError:
        db.commit()  # keep the connection even if the first sync hiccuped
        return back("connected")

    db.commit()
    return back("connected")


def _valid_access_token(db: Session, conn: FitbitConnection) -> str:
    """Refresh the token if it has expired, and persist the new one."""
    if conn.expires_at <= datetime.utcnow():
        tokens = fitbit.refresh_tokens(conn.refresh_token)
        conn.access_token = tokens["access_token"]
        conn.refresh_token = tokens.get("refresh_token", conn.refresh_token)
        conn.expires_at = fitbit.expiry_from(tokens)
        db.commit()
    return conn.access_token


@router.post("/fitbit/sync", response_model=WearableSummaryOut)
def fitbit_sync(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WearableSummaryOut:
    conn = db.query(FitbitConnection).filter(FitbitConnection.user_id == user.id).first()
    if conn is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Fitbit is not connected.")
    try:
        token = _valid_access_token(db, conn)
        days = fitbit.fetch_readings(token)
    except fitbit.FitbitError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    _store_readings(db, user.id, days, "Fitbit")
    conn.last_synced_at = datetime.utcnow()
    db.commit()
    readings = db.query(WearableReading).filter(WearableReading.user_id == user.id).all()
    return _summary(readings)


@router.delete("/fitbit", status_code=status.HTTP_204_NO_CONTENT)
def fitbit_disconnect(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Drop the link and the data that came from it, leaving imports untouched."""
    db.query(FitbitConnection).filter(FitbitConnection.user_id == user.id).delete()
    db.query(WearableReading).filter(
        WearableReading.user_id == user.id, WearableReading.source == "Fitbit"
    ).delete()
    db.commit()
