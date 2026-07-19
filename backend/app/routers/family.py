from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import FamilyMember, User
from app.schemas import FamilyMemberIn, FamilyMemberOut, HereditaryFinding
from app.services.heredity import CONDITIONS, assess
from app.twin import latest_markers

router = APIRouter(prefix="/api/family", tags=["family"])


@router.get("", response_model=List[FamilyMemberOut])
def list_family(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[FamilyMember]:
    return (
        db.query(FamilyMember)
        .filter(FamilyMember.user_id == user.id)
        .order_by(FamilyMember.id)
        .all()
    )


@router.post("", response_model=FamilyMemberOut, status_code=status.HTTP_201_CREATED)
def add_family_member(
    payload: FamilyMemberIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FamilyMember:
    member = FamilyMember(user_id=user.id, **payload.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.put("/{member_id}", response_model=FamilyMemberOut)
def update_family_member(
    member_id: int,
    payload: FamilyMemberIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FamilyMember:
    member = (
        db.query(FamilyMember)
        .filter(FamilyMember.id == member_id, FamilyMember.user_id == user.id)
        .first()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="Family member not found.")

    for field, value in payload.model_dump().items():
        setattr(member, field, value)
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_family_member(
    member_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    member = (
        db.query(FamilyMember)
        .filter(FamilyMember.id == member_id, FamilyMember.user_id == user.id)
        .first()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="Family member not found.")
    db.delete(member)
    db.commit()


@router.get("/hereditary", response_model=List[HereditaryFinding])
def hereditary_risk(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[dict]:
    """Conditions in the family, matched against the user's own results.

    Returns findings, never predictions. A family history plus a related lab
    value is a reason to pay attention; it is not a forecast, and nothing here
    claims otherwise.
    """
    family = (
        db.query(FamilyMember).filter(FamilyMember.user_id == user.id).all()
    )
    members = [
        {"name": m.name, "relation": m.relation, "conditions": m.conditions or []}
        for m in family
    ]

    markers = [
        {
            "name": m.name,
            "label": m.label,
            "value": m.value,
            "unit": m.unit,
            "flag": m.flag,
        }
        for m in latest_markers(db, user.id)
    ]

    return assess(members, markers)


@router.get("/trackable-conditions")
def trackable_conditions() -> List[dict]:
    """Conditions AURA can connect to a result, for the entry form.

    Offering conditions it cannot track would collect data that produces
    nothing.
    """
    return [
        {"key": c.key, "label": c.label, "tracked_by": c.markers}
        for c in CONDITIONS
    ]
