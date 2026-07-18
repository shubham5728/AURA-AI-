"""Request and response shapes for the API."""

from datetime import date, datetime
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


class BiomarkerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    label: str
    value: float
    unit: Optional[str]
    ref_low: Optional[float]
    ref_high: Optional[float]
    flag: str
    measured_at: Optional[date]


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    report_type: str
    parse_status: str
    parse_error: Optional[str]
    created_at: datetime
    biomarker_count: int = 0
    abnormal_count: int = 0


class ReportDetailOut(ReportOut):
    biomarkers: List[BiomarkerOut] = []


class TrendPoint(BaseModel):
    value: float
    measured_at: Optional[date]
    flag: str
    report_id: int


class TrendOut(BaseModel):
    """A single marker across every report, oldest first.

    This is the query the biomarkers/reports table split exists to make cheap.
    """

    name: str
    label: str
    unit: Optional[str]
    ref_low: Optional[float]
    ref_high: Optional[float]
    points: List[TrendPoint]


class DailyLogIn(BaseModel):
    """Every field optional: users log what they track and skip the rest.

    None means "not logged" and is excluded from averages -- distinct from 0,
    which means the user genuinely recorded nothing that day.
    """

    steps: Optional[int] = Field(default=None, ge=0, le=100_000)
    sleep_hours: Optional[float] = Field(default=None, ge=0, le=24)
    water_ml: Optional[int] = Field(default=None, ge=0, le=20_000)
    calories_in: Optional[int] = Field(default=None, ge=0, le=20_000)
    calories_out: Optional[int] = Field(default=None, ge=0, le=20_000)


class DailyLogOut(DailyLogIn):
    model_config = ConfigDict(from_attributes=True)

    date: date


class MedicationIn(BaseModel):
    drug_name: str = Field(min_length=1, max_length=128)
    dose: Optional[str] = Field(default=None, max_length=64)
    schedule: Optional[str] = Field(default=None, max_length=128)
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class MedicationOut(MedicationIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class InteractionOut(BaseModel):
    drugs: List[str]
    severity: str
    description: str


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
