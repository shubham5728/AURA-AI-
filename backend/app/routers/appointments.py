"""Doctor appointments the user keeps track of.

AURA books nothing and has no clinic network, so this stores only what the user
tells it: a visit they arranged themselves. That honesty is the whole design --
no invented doctors, no fake "confirmed" slots. Every row is scoped to its owner
by user_id, like the rest of the app.
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Appointment, User
from app.schemas import AppointmentIn, AppointmentOut

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def add_appointment(
    payload: AppointmentIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Appointment:
    appointment = Appointment(user_id=user.id, **payload.model_dump())
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


@router.get("", response_model=List[AppointmentOut])
def list_appointments(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Appointment]:
    """Soonest first: the next visit is the one the user needs to see."""
    return (
        db.query(Appointment)
        .filter(Appointment.user_id == user.id)
        .order_by(Appointment.scheduled_at.asc())
        .all()
    )


@router.put("/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    appointment_id: int,
    payload: AppointmentIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Appointment:
    appointment = (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id, Appointment.user_id == user.id)
        .first()
    )
    if appointment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found."
        )
    for field, value in payload.model_dump().items():
        setattr(appointment, field, value)
    db.commit()
    db.refresh(appointment)
    return appointment


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_appointment(
    appointment_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    appointment = (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id, Appointment.user_id == user.id)
        .first()
    )
    if appointment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found."
        )
    db.delete(appointment)
    db.commit()
