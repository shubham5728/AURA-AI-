"""Request and response shapes for the API."""

from datetime import date
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

SEXES = {"male", "female", "other"}


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str


class ProfileIn(BaseModel):
    """Onboarding payload. Kept to eight fields on purpose -- long forms cost
    completion rate, and stage time during a live demo."""

    dob: date
    sex: str
    height_cm: float = Field(gt=50, lt=260)
    weight_kg: float = Field(gt=10, lt=400)
    conditions: List[str] = []
    allergies: List[str] = []
    goals: List[str] = []

    @field_validator("sex")
    @classmethod
    def valid_sex(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in SEXES:
            raise ValueError(f"sex must be one of {sorted(SEXES)}")
        return v

    @field_validator("dob")
    @classmethod
    def plausible_dob(cls, v: date) -> date:
        today = date.today()
        if v >= today:
            raise ValueError("dob must be in the past")
        if (today - v).days > 365 * 120:
            raise ValueError("dob is implausibly old")
        return v


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    dob: date
    sex: str
    height_cm: float
    weight_kg: float
    conditions: List[str]
    allergies: List[str]
    goals: List[str]

    # Derived server-side so every consumer -- dashboard, scoring, AI context --
    # sees the same numbers instead of each recomputing them.
    age: Optional[int] = None
    bmi: Optional[float] = None


class TwinContext(BaseModel):
    """De-identified snapshot sent to the model.

    Deliberately has no name, email, or exact date of birth. See Decision 5 in
    ROADMAP.md -- the model does not need an identity to reason about a lab value,
    so it never receives one.
    """

    age: int
    sex: str
    bmi: Optional[float]
    conditions: List[str]
    allergies: List[str]
    goals: List[str]
