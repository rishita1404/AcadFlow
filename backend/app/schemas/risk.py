"""
Pydantic schemas for Risk Engine API responses and Attendance endpoints.
Member 3 (Raghav) — Evaluation 1
"""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

# ──────────────────────────────────────────────────────────────────────────────
# Attendance schemas
# ──────────────────────────────────────────────────────────────────────────────


class AttendanceMarkRequest(BaseModel):
    """Payload to mark/update attendance for a single session."""

    session_id: int = Field(..., description="ID of the class session")
    student_id: int = Field(..., description="student.user_id")
    status: str = Field(
        ...,
        pattern="^(present|absent|late)$",
        description="present | absent | late",
    )


class AttendanceBulkMarkRequest(BaseModel):
    """Payload to mark attendance for multiple students in one session."""

    session_id: int = Field(..., description="ID of the class session")
    records: List[AttendanceMarkRequest] = Field(
        ..., min_length=1, description="List of per-student status entries"
    )


class AttendanceRecordOut(BaseModel):
    id: int
    session_id: int
    student_id: int
    status: str
    marked_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClassSessionCreate(BaseModel):
    course_id: int
    held_on: date
    is_cancelled: bool = False


class ClassSessionOut(BaseModel):
    id: int
    course_id: int
    held_on: date
    is_cancelled: bool

    model_config = ConfigDict(from_attributes=True)


# ──────────────────────────────────────────────────────────────────────────────
# Buffer / risk schemas
# ──────────────────────────────────────────────────────────────────────────────


class AttendanceBufferOut(BaseModel):
    """
    Per-course attendance buffer result returned by the API.
    Distinguishes insufficient data from a valid (possibly negative) buffer.
    """

    student_id: int
    course_id: int
    total_classes: int
    held: int
    attended: int
    required: Optional[int] = None
    still_need: Optional[int] = None
    remaining: Optional[int] = None
    buffer: Optional[int] = Field(
        None,
        description=(
            "Classes student can still miss. Negative means "
            "not recoverable by attendance alone."
        ),
    )
    attendance_pct: Optional[float] = Field(
        None, description="attended/held × 100, rounded to 2 dp"
    )
    holiday_count: int = 0
    insufficient_data: bool
    status_message: str


class RiskScoreOut(BaseModel):
    """
    Full risk score result for one student in one course.
    API consumers can distinguish insufficient data (insufficient_data=True)
    from a genuine Safe score (score=0, band='Safe').
    """

    student_id: int
    course_id: int
    score: Optional[float] = Field(
        None,
        description="0–100 risk score. None when data is insufficient.",
    )
    band: str = Field(
        ...,
        description="Safe | Watch | At risk | Critical | Insufficient data",
    )
    margin_points: float
    trend_points: float
    deadline_points: float
    missed_points: float
    insufficient_data: bool
    factors: List[str] = Field(
        default_factory=list,
        description="Human-readable explanation of contributing risk factors.",
    )
    computed_at: datetime
    # Buffer sub-detail (so frontend can show 'Can miss N classes')
    buffer: Optional[int] = None
    remaining: Optional[int] = None
    attendance_pct: Optional[float] = None
    status_message: str = ""


class RiskConfigOut(BaseModel):
    id: int
    w_margin: float
    w_trend: float
    w_deadline: float
    w_missed: float
    t_watch: float
    t_risk: float
    t_critical: float
    min_classes: int
    version: str

    model_config = ConfigDict(from_attributes=True)


class RiskConfigUpdate(BaseModel):
    w_margin: Optional[float] = Field(None, ge=0, le=100)
    w_trend: Optional[float] = Field(None, ge=0, le=100)
    w_deadline: Optional[float] = Field(None, ge=0, le=100)
    w_missed: Optional[float] = Field(None, ge=0, le=100)
    t_watch: Optional[float] = Field(None, ge=0, le=100)
    t_risk: Optional[float] = Field(None, ge=0, le=100)
    t_critical: Optional[float] = Field(None, ge=0, le=100)
    min_classes: Optional[int] = Field(None, ge=0)
    version: Optional[str] = None
