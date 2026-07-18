from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.services.scoring import calculate_score
from app.twin import build_health_state

router = APIRouter(prefix="/api", tags=["score"])


@router.get("/score")
def read_score(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """The Health Score with the full breakdown that produced it.

    The breakdown ships with the score rather than behind a second call: a
    number nobody can explain is the thing this design exists to avoid, so
    displaying one without its reasons should never be the easy path.
    """
    state = build_health_state(db, user)
    return calculate_score(state).as_dict()
