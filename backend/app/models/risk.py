from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RiskConfigModel(Base):
    __tablename__ = "risk_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    w_margin: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    w_trend: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    w_deadline: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    w_missed: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    t_watch: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    t_risk: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    t_critical: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    min_classes: Mapped[int] = mapped_column(Integer, default=8)
    version: Mapped[str] = mapped_column(String(50))


class RiskSnapshotModel(Base):
    __tablename__ = "risk_snapshots"
    __table_args__ = (
        Index("ix_risk_snapshots_student_computed", "student_id", "computed_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.user_id")
    )
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True)
    )
    score: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    band: Mapped[str] = mapped_column(String(20))
    worst_course_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("courses.id")
    )
    config_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("risk_config.id")
    )
