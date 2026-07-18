from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.services.simulation import simulate
from app.twin import build_health_state

router = APIRouter(prefix="/api", tags=["simulation"])


class SimulateIn(BaseModel):
    """Levers the user can actually pull. Lab values are not simulatable."""

    avg_steps: Optional[float] = Field(default=None, ge=0, le=100_000)
    avg_sleep_hours: Optional[float] = Field(default=None, ge=0, le=24)
    avg_water_ml: Optional[float] = Field(default=None, ge=0, le=20_000)
    bmi: Optional[float] = Field(default=None, ge=10, le=80)


@router.post("/simulate")
def run_simulation(
    payload: SimulateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Project the Health Score under a changed lifestyle.

    Runs the same scoring function as `/api/score` against a modified copy of
    the user's state, so a projection and a real score can never disagree.
    """
    state = build_health_state(db, user)

    try:
        result = simulate(state, payload.model_dump(exclude_none=True))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return result.as_dict()
