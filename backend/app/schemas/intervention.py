"""
Pydantic schemas for Interventions and Deadline Collision Previews — AcadFlow Phase 3.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Dict, Optional

from pydantic import BaseModel, ConfigDict, Field


class InterventionCreate(BaseModel):
    student_id: int
    course_id: Optional[int] = None
    kind: str = Field(..., pattern="^(talk|call|email|referral|other)$")
    note: str = Field(..., min_length=3, max_length=2000)
    follow_up_on: Optional[date] = None


class InterventionUpdate(BaseModel):
    outcome: Optional[str] = Field(None, pattern="^(open|recovered|not_recovered|escalated)$")
    note: Optional[str] = Field(None, max_length=2000)
    follow_up_on: Optional[date] = None


class InterventionOut(BaseModel):
    id: int
    student_id: int
    student_name: Optional[str] = None
    student_roll_no: Optional[str] = None
    course_id: Optional[int] = None
    course_name: Optional[str] = None
    course_code: Optional[str] = None
    created_by: int
    created_by_name: Optional[str] = None
    kind: str
    note: str
    follow_up_on: Optional[date] = None
    outcome: str
    score_at_creation: float
    band_at_creation: str
    current_score: Optional[float] = None
    score_change: Optional[float] = None
    created_at: datetime
    closed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DeadlineCollisionPreviewRequest(BaseModel):
    course_id: int
    section: Optional[str] = "A"
    proposed_due_at: datetime
    assignment_id: Optional[int] = None


class DeadlineCollisionPreviewResponse(BaseModel):
    has_collision_warning: bool
    warning_threshold: int
    window_count: int
    daily_counts: Dict[str, int]
    lightest_nearby_date: Optional[date] = None
    message: str
