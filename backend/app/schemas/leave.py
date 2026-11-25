"""
Pydantic schemas for Leave Requests and Condonation.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class LeaveRequestCreate(BaseModel):
    type: str = Field(..., pattern="^(medical|duty)$", description="medical or duty")
    date_from: date
    date_to: date
    reason: Optional[str] = Field(None, max_length=1000, description="Reason for leave")
    event_name: Optional[str] = Field(None, max_length=120)
    club_org: Optional[str] = Field(None, max_length=80)
    duty_detail: Optional[str] = Field(None, max_length=80)


class LeaveRequestDecision(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    decision_note: Optional[str] = Field(None, max_length=1000)


class LeaveRequestOut(BaseModel):
    id: int
    student_id: int
    student_name: Optional[str] = None
    student_roll_no: Optional[str] = None
    type: str
    date_from: date
    date_to: date
    reason: str
    status: str
    decided_by: Optional[int] = None
    decided_by_name: Optional[str] = None
    decided_at: Optional[datetime] = None
    decision_note: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CondonationRecommendRequest(BaseModel):
    student_id: int
    semester_id: int
    reason: str = Field(..., min_length=3, max_length=1000)


class CondonationDecision(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    decision_note: str = Field(..., min_length=2, max_length=1000)


class CondonationRequestOut(BaseModel):
    id: int
    student_id: int
    student_name: Optional[str] = None
    student_roll_no: Optional[str] = None
    department_name: Optional[str] = None
    semester_id: int
    attendance_pct_at_request: float
    reason: str
    status: str
    recommended_by: int
    recommended_by_name: Optional[str] = None
    decided_by: Optional[int] = None
    decided_by_name: Optional[str] = None
    decision_note: Optional[str] = None
    decided_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
