"""
Pydantic schemas for Department Trends, Hotspots, Intervention Funnel, and Mentor Load.
AcadFlow Phase 4.
"""

from __future__ import annotations

from datetime import date
from typing import List

from pydantic import BaseModel, ConfigDict


class WeeklyRiskTrend(BaseModel):
    week_number: int
    week_label: str
    week_start: date
    week_end: date
    safe: int
    watch: int
    at_risk: int
    needs_support: int  # Critical / Needs support band
    total_snapshots: int

    model_config = ConfigDict(from_attributes=True)


class HotspotCourseSection(BaseModel):
    course_id: int
    course_code: str
    course_name: str
    section: str
    total_students: int
    students_needing_support: int
    support_share_pct: float

    model_config = ConfigDict(from_attributes=True)


class InterventionFunnel(BaseModel):
    flagged: int
    contacted: int
    recovered: int
    contact_rate_pct: float
    recovery_rate_pct: float

    model_config = ConfigDict(from_attributes=True)


class DepartmentTrendsResponse(BaseModel):
    department_id: int
    department_name: str
    department_code: str
    weeks_analyzed: int
    weekly_risk_trends: List[WeeklyRiskTrend]
    top_hotspots: List[HotspotCourseSection]
    intervention_funnel: InterventionFunnel

    model_config = ConfigDict(from_attributes=True)


class MentorLoadItem(BaseModel):
    mentor_id: int
    mentor_name: str
    mentor_email: str
    mentee_count: int
    high_risk_mentee_count: int
    high_risk_share_pct: float
    open_interventions_count: int

    model_config = ConfigDict(from_attributes=True)


class MentorLoadResponse(BaseModel):
    department_id: int
    department_name: str
    total_mentors: int
    total_mentees: int
    mentors: List[MentorLoadItem]

    model_config = ConfigDict(from_attributes=True)
