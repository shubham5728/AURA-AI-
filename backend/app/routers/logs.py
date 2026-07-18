from datetime import date as date_type
from datetime import timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import DailyLog, Medication, User
from app.schemas import (
    DailyLogIn,
    DailyLogOut,
    InteractionOut,
    MedicationIn,
    MedicationOut,
    MedicationTakenIn,
)
from app.services.interactions import find_interactions

router = APIRouter(prefix="/api", tags=["logs"])


@router.put("/logs/{log_date}", response_model=DailyLogOut)
def upsert_log(
    log_date: date_type,
    payload: DailyLogIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DailyLog:
    """Create or update a day's lifestyle log.

    Only fields present in the request are written, so logging water in the
    morning does not erase the step count recorded later.
    """
    if log_date > date_type.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot log a future date.",
        )

    log = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id, DailyLog.date == log_date)
        .first()
    )
    if log is None:
        log = DailyLog(user_id=user.id, date=log_date)
        db.add(log)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(log, field, value)

    db.commit()
    db.refresh(log)
    return log


@router.get("/logs", response_model=List[DailyLogOut])
def list_logs(
    days: int = Query(default=7, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[DailyLog]:
    cutoff = date_type.today() - timedelta(days=days)
    return (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id, DailyLog.date >= cutoff)
        .order_by(DailyLog.date.desc())
        .all()
    )


@router.post("/medications", response_model=MedicationOut, status_code=status.HTTP_201_CREATED)
def add_medication(
    payload: MedicationIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Medication:
    if payload.end_date and payload.start_date and payload.end_date < payload.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date cannot be before start_date.",
        )

    medication = Medication(user_id=user.id, **payload.model_dump())
    db.add(medication)
    db.commit()
    db.refresh(medication)
    return medication


@router.get("/medications", response_model=List[MedicationOut])
def list_medications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Medication]:
    return (
        db.query(Medication)
        .filter(Medication.user_id == user.id)
        .order_by(Medication.id.desc())
        .all()
    )


@router.patch("/medications/{medication_id}/taken", response_model=MedicationOut)
def mark_taken(
    medication_id: int,
    payload: MedicationTakenIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Medication:
    """Mark today's dose as taken or not taken.

    Records the date rather than a flag, so the state resets on its own at
    midnight instead of reporting a stale dose as current.
    """
    medication = (
        db.query(Medication)
        .filter(Medication.id == medication_id, Medication.user_id == user.id)
        .first()
    )
    if medication is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Medication not found."
        )

    medication.last_taken_on = date_type.today() if payload.taken else None
    db.commit()
    db.refresh(medication)
    return medication


@router.delete("/medications/{medication_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_medication(
    medication_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    medication = (
        db.query(Medication)
        .filter(Medication.id == medication_id, Medication.user_id == user.id)
        .first()
    )
    if medication is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Medication not found."
        )
    db.delete(medication)
    db.commit()


@router.get("/medications/interactions", response_model=List[InteractionOut])
def check_interactions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[dict]:
    """Known interactions among the user's current medications.

    Flags pairs worth raising with a doctor. It never recommends starting,
    stopping, or adjusting a medication -- that is a hard safety boundary.
    """
    medications = db.query(Medication).filter(Medication.user_id == user.id).all()
    return find_interactions([m.drug_name for m in medications])
