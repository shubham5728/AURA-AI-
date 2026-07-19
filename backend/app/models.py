"""Database models for the Digital Twin.

Schema follows the data model in ROADMAP.md. The one design decision worth
restating here: `Biomarker` is a separate table from `Report`, not a JSON blob
inside it. Reports are documents; biomarkers are queryable data points. That
split is what makes "show my HbA1c across every report" a single query, and
every trend chart and risk calculation depends on it.

List-valued columns use JSON rather than Postgres ARRAY so the same models run
on SQLite in development and Postgres in production.
"""

from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base


class User(Base):
    """Identity only. No health data lives here."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    profile: Mapped[Optional["Profile"]] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    reports: Mapped[List["Report"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    daily_logs: Mapped[List["DailyLog"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    medications: Mapped[List["Medication"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    chat_messages: Mapped[List["ChatMessage"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    family_members: Mapped[List["FamilyMember"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    briefings: Mapped[List["DailyBriefing"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Profile(Base):
    """The static baseline of the Digital Twin.

    This is the starting state every AI response reasons from. An empty profile
    is what produces the generic advice AURA exists to avoid.
    """

    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )

    dob: Mapped[date] = mapped_column(Date)
    sex: Mapped[str] = mapped_column(String(16))
    height_cm: Mapped[float] = mapped_column(Float)
    weight_kg: Mapped[float] = mapped_column(Float)

    conditions: Mapped[list] = mapped_column(JSON, default=list)
    allergies: Mapped[list] = mapped_column(JSON, default=list)
    goals: Mapped[list] = mapped_column(JSON, default=list)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="profile")


class Report(Base):
    """An uploaded document plus the raw result of parsing it."""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    file_url: Mapped[str] = mapped_column(Text)
    report_type: Mapped[str] = mapped_column(String(64), default="blood_test")

    # Unmodified model output, kept even after biomarkers are extracted so a
    # bad parse can be re-run without asking the user to upload again.
    extracted_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    parse_status: Mapped[str] = mapped_column(String(32), default="pending")
    parse_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    parsed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="reports")
    biomarkers: Mapped[List["Biomarker"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )


class Biomarker(Base):
    """One lab value. The queryable layer under every trend and risk signal."""

    __tablename__ = "biomarkers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_id: Mapped[int] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), index=True
    )

    name: Mapped[str] = mapped_column(String(128), index=True)
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    ref_low: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ref_high: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Computed in our code from the reference range, never taken from the model.
    # Deterministic comparison removes a whole class of misinterpretation.
    flag: Mapped[str] = mapped_column(String(16), default="unknown")

    measured_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    report: Mapped["Report"] = relationship(back_populates="biomarkers")


class DailyLog(Base):
    """Time-series lifestyle data. One row per user per day."""

    __tablename__ = "daily_logs"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_user_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    date: Mapped[date] = mapped_column(Date, index=True)

    # Nullable throughout: a missing metric is not the same as a zero, and
    # scoring must be able to tell "did not log" from "did not move".
    steps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sleep_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    water_ml: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    calories_in: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    calories_out: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    user: Mapped["User"] = relationship(back_populates="daily_logs")


class DailyBriefing(Base):
    """The narrative shown at the top of the overview, generated once a day.

    Cached rather than generated per page load for three reasons: the free API
    tier allows twenty calls a day and a homepage would spend them all,
    generation takes several seconds during which the first screen would be
    blank, and a briefing that is rewritten on every visit reads as unstable
    even when the underlying data has not changed.

    `score_at_generation` records what the score was when the text was written.
    If the score has since moved, the briefing is stale and describes a state
    the user is no longer in -- worse than showing nothing.
    """

    __tablename__ = "daily_briefings"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_briefing_user_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    date: Mapped[date] = mapped_column(Date, index=True)

    text: Mapped[str] = mapped_column(Text)
    # "model" or "computed" -- the interface says which, rather than passing
    # deterministic fallback text off as generated insight.
    source: Mapped[str] = mapped_column(String(16), default="computed")
    score_at_generation: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="briefings")


class FamilyMember(Base):
    """A relative's health information, recorded by the user.

    Deliberately not a user account. Multi-user family access needs a consent
    model, and getting consent wrong with health data causes real harm -- so
    this is the user's own notebook about their household, which is a smaller
    thing that can be built correctly.

    It also carries the family history that hereditary risk is derived from:
    "father, diabetes" is the input that makes a raised HbA1c worth a closer
    look.
    """

    __tablename__ = "family_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    name: Mapped[str] = mapped_column(String(128))
    relation: Mapped[str] = mapped_column(String(64))

    # Year rather than a full date: it is enough to estimate age, and asking for
    # a relative's exact birthday collects more than the feature needs.
    birth_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    conditions: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="family_members")


class ChatMessage(Base):
    """One turn of conversation.

    `agent_role` records which specialist handled an assistant turn, so the
    interface can show that routing happened -- the multi-agent design is
    visible to the user even though the deployment is unified.
    """

    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    role: Mapped[str] = mapped_column(String(16))  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text)
    agent_role: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="chat_messages")


class Medication(Base):
    """An active or past prescription."""

    __tablename__ = "medications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    drug_name: Mapped[str] = mapped_column(String(128), index=True)
    dose: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    schedule: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Adherence is stored as the date last marked, not a boolean. A boolean
    # would stay true forever once ticked, so yesterday's dose would still read
    # as taken this morning.
    last_taken_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    user: Mapped["User"] = relationship(back_populates="medications")

    @property
    def taken_today(self) -> bool:
        return self.last_taken_on == date.today()
