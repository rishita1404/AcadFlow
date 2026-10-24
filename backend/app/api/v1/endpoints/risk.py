"""
Risk API endpoints — AcadFlow (Member 3: Raghav)

Implements:
  GET  /risk/students/{sid}/courses/{cid}   — full risk score for one student/course
  GET  /risk/courses/{cid}/at-risk          — faculty at-risk list for a course
  POST /risk/students/{sid}/courses/{cid}/recalculate — force recalculation
  GET  /risk/config                         — read config
  PUT  /risk/config                         — update config (admin)
"""

from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.core.deps import can_access, get_db
from app.core.errors import NotFoundError
from app.models import (
    CourseModel,
    EnrolmentModel,
    RiskConfigModel,
    StudentModel,
)
from app.schemas.risk import RiskConfigOut, RiskConfigUpdate, RiskScoreOut
from app.services.risk_data import (
    calculate_student_course_risk,
    persist_risk_snapshot,
)

router = APIRouter()


@router.get("/")
async def get_risk_index():
    return {"endpoint": "risk", "status": "active"}


# ──────────────────────────────────────────────────────────────────────────────
# Student risk score
# ──────────────────────────────────────────────────────────────────────────────


@router.get(
    "/students/{student_id}/courses/{course_id}",
    response_model=RiskScoreOut,
    summary="Get risk score for one student in one course",
)
def get_student_risk(
    student_id: int,
    course_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Calculate and return the current risk score.

    Returns `insufficient_data=True` with band='Insufficient data' when
    fewer than min_classes sessions have been held (PRD minimum-evidence rule).
    API consumers MUST check `insufficient_data` before presenting the score.
    """
    can_access(user=current_user, action="read", resource="risk")

    if not db.get(StudentModel, student_id):
        raise NotFoundError(f"Student {student_id} not found.")
    if not db.get(CourseModel, course_id):
        raise NotFoundError(f"Course {course_id} not found.")

    data = calculate_student_course_risk(db, student_id, course_id)

    return RiskScoreOut(
        student_id=data["student_id"],
        course_id=data["course_id"],
        score=data["score"] if not data["insufficient_data"] else None,
        band=data["band"],
        margin_points=data["margin_points"],
        trend_points=data["trend_points"],
        deadline_points=data["deadline_points"],
        missed_points=data["missed_points"],
        insufficient_data=data["insufficient_data"],
        factors=data["factors"],
        computed_at=data["computed_at"],
        buffer=data["buffer"],
        remaining=data["remaining"],
        attendance_pct=data["attendance_pct"],
        status_message=data["status_message"],
    )


# ──────────────────────────────────────────────────────────────────────────────
# Force recalculation
# ──────────────────────────────────────────────────────────────────────────────


@router.post(
    "/students/{student_id}/courses/{course_id}/recalculate",
    response_model=RiskScoreOut,
    status_code=status.HTTP_200_OK,
    summary="Force risk recalculation and persist snapshot",
)
def recalculate_risk(
    student_id: int,
    course_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Recalculate risk from current attendance/submission data and
    persist a new RiskSnapshotModel row.
    """
    can_access(user=current_user, action="recalculate", resource="risk")

    if not db.get(StudentModel, student_id):
        raise NotFoundError(f"Student {student_id} not found.")
    if not db.get(CourseModel, course_id):
        raise NotFoundError(f"Course {course_id} not found.")

    data = persist_risk_snapshot(db, student_id, course_id)

    return RiskScoreOut(
        student_id=data["student_id"],
        course_id=data["course_id"],
        score=data["score"] if not data["insufficient_data"] else None,
        band=data["band"],
        margin_points=data["margin_points"],
        trend_points=data["trend_points"],
        deadline_points=data["deadline_points"],
        missed_points=data["missed_points"],
        insufficient_data=data["insufficient_data"],
        factors=data["factors"],
        computed_at=data["computed_at"],
        buffer=data["buffer"],
        remaining=data["remaining"],
        attendance_pct=data["attendance_pct"],
        status_message=data["status_message"],
    )


# ──────────────────────────────────────────────────────────────────────────────
# Faculty at-risk list for a course
# ──────────────────────────────────────────────────────────────────────────────


@router.get(
    "/courses/{course_id}/at-risk",
    response_model=List[RiskScoreOut],
    summary="Filterable at-risk student list for a course (faculty)",
)
def get_at_risk_list(
    course_id: int,
    band: Optional[str] = Query(
        None,
        description="Filter by band: Watch | At risk | Critical",
    ),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Return risk scores for all enrolled students in a course.
    Faculty can filter by band to focus on students needing attention.
    """
    can_access(user=current_user, action="list", resource="risk")

    if not db.get(CourseModel, course_id):
        raise NotFoundError(f"Course {course_id} not found.")

    enrolled_ids = db.scalars(
        select(EnrolmentModel.student_id).where(EnrolmentModel.course_id == course_id)
    ).all()

    results: list[RiskScoreOut] = []
    for sid in enrolled_ids:
        data = calculate_student_course_risk(db, sid, course_id)
        if band and data["band"] != band:
            continue
        results.append(
            RiskScoreOut(
                student_id=data["student_id"],
                course_id=data["course_id"],
                score=data["score"] if not data["insufficient_data"] else None,
                band=data["band"],
                margin_points=data["margin_points"],
                trend_points=data["trend_points"],
                deadline_points=data["deadline_points"],
                missed_points=data["missed_points"],
                insufficient_data=data["insufficient_data"],
                factors=data["factors"],
                computed_at=data["computed_at"],
                buffer=data["buffer"],
                remaining=data["remaining"],
                attendance_pct=data["attendance_pct"],
                status_message=data["status_message"],
            )
        )

    return results


# ──────────────────────────────────────────────────────────────────────────────
# Admin: risk config CRUD
# ──────────────────────────────────────────────────────────────────────────────


@router.get(
    "/config",
    response_model=Optional[RiskConfigOut],
    summary="Read current risk configuration (admin)",
)
def get_risk_config(
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    can_access(user=current_user, action="read", resource="risk_config")
    row = db.scalars(
        select(RiskConfigModel).order_by(RiskConfigModel.id.desc()).limit(1)
    ).first()
    if not row:
        return None
    return RiskConfigOut.model_validate(row)


@router.put(
    "/config",
    response_model=RiskConfigOut,
    summary="Create or update risk configuration (admin)",
)
def upsert_risk_config(
    payload: RiskConfigUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Admin-tunable risk weights and thresholds.
    Creates a new versioned row rather than mutating existing ones
    so every snapshot can reference the config that generated it.
    """
    can_access(user=current_user, action="admin", resource="risk_config")

    existing = db.scalars(
        select(RiskConfigModel).order_by(RiskConfigModel.id.desc()).limit(1)
    ).first()

    def _dec(val, fallback):
        return Decimal(str(val)) if val is not None else fallback

    if existing:
        new_row = RiskConfigModel(
            w_margin=_dec(payload.w_margin, existing.w_margin),
            w_trend=_dec(payload.w_trend, existing.w_trend),
            w_deadline=_dec(payload.w_deadline, existing.w_deadline),
            w_missed=_dec(payload.w_missed, existing.w_missed),
            t_watch=_dec(payload.t_watch, existing.t_watch),
            t_risk=_dec(payload.t_risk, existing.t_risk),
            t_critical=_dec(payload.t_critical, existing.t_critical),
            min_classes=payload.min_classes
            if payload.min_classes is not None
            else existing.min_classes,
            version=payload.version or f"v{existing.id + 1}",
        )
    else:
        new_row = RiskConfigModel(
            w_margin=Decimal("50"),
            w_trend=Decimal("20"),
            w_deadline=Decimal("20"),
            w_missed=Decimal("10"),
            t_watch=Decimal("30"),
            t_risk=Decimal("55"),
            t_critical=Decimal("80"),
            min_classes=8,
            version=payload.version or "v1",
        )

    db.add(new_row)
    db.commit()
    db.refresh(new_row)
    return RiskConfigOut.model_validate(new_row)
