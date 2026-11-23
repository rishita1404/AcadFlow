from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class InterventionModel(Base):
    __tablename__ = "interventions"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('talk', 'call', 'email', 'referral', 'other')",
            name="check_intervention_kind",
        ),
        CheckConstraint(
            "outcome IN ('open', 'recovered', 'not_recovered', 'escalated')",
            name="check_intervention_outcome",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.user_id"), nullable=False, index=True
    )
    course_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("courses.id"), nullable=True
    )
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    follow_up_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    outcome: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    score_at_creation: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    band_at_creation: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    closed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
