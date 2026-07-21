from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Profile, User
from app.schemas import ProfileIn, ProfileOut, TwinContext, UserOut
from app.twin import build_twin_context, profile_to_out
from app.services.twin_systems import build_systems

router = APIRouter(prefix="/api", tags=["profile"])


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.get("/profile", response_model=ProfileOut)
def read_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileOut:
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if profile is None:
        # 404 rather than an empty object: the client needs to distinguish
        # "not onboarded yet" from "onboarded with blank values".
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found. Complete onboarding first.",
        )
    return profile_to_out(profile)


@router.put("/profile", response_model=ProfileOut)
def upsert_profile(
    payload: ProfileIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileOut:
    """Create or replace the profile.

    A single idempotent PUT covers both onboarding and later edits, so the
    client never has to know which one it is doing.
    """
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()

    if profile is None:
        profile = Profile(user_id=user.id)
        db.add(profile)

    for field, value in payload.model_dump().items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile_to_out(profile)


@router.get("/twin/context", response_model=TwinContext)
def read_twin_context(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TwinContext:
    """The de-identified snapshot the AI layer will consume.

    Exposed as an endpoint so the privacy boundary is inspectable -- anyone can
    see exactly what does and does not reach the model.
    """
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found. Complete onboarding first.",
        )
    return build_twin_context(profile)


@router.get("/twin/systems")
def twin_systems(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list:
    """The Digital Twin grouped into physiological systems.

    Every value is the user's own -- lab panels, logged habits, and BMI/BMR
    computed from the profile. A system with no data reports it honestly rather
    than showing an empty gauge, and names the specialist that covers it from
    the real five roles.
    """
    return [s.as_dict() for s in build_systems(db, user)]
