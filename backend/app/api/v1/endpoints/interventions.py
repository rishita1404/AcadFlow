"""
Interventions API Endpoints — AcadFlow Phase 3.

Manages mentor and faculty interventions, student timeline tracking with score deltas,
human-driven outcomes, follow-up queues, and audited Dean read-only access.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.audit import AuditAction, audit_logger
from app.core.authorization import (
    Action,
    can_access,
    check_can_create_intervention,
    check_can_update_intervention,
    check_can_view_interventions,
    check_is_dean,
    verify_access,
)
from app.core.deps import get_db
from app.core.permissions import Role
from app.models import (
    CourseModel,
    MentorAssignmentModel,
    RiskSnapshotModel,
    StudentModel,
    UserModel,
)
from app.models.intervention import InterventionModel
from app.schemas.intervention import (
    InterventionCreate,
    InterventionOut,
    InterventionUpdate,
)
from app.services.risk_data import calculate_student_course_risk, load_risk_config

router = APIRouter()


def _get_student_current_risk(
    db: Session, student_id: int, course_id: Optional[int] = None
) -> tuple[float, str]:
    """Helper to retrieve current score and band for student."""
    query = (
        select(RiskSnapshotModel)
        .where(RiskSnapshotModel.student_id == student_id)
        .order_by(RiskSnapshotModel.computed_at.desc())
    )
    if course_id:
        query = query.where(RiskSnapshotModel.worst_course_id == course_id)

    snap = db.scalar(query.limit(1))
    if snap and snap.score is not None:
        return float(snap.score), snap.band or "Safe"

    # Fallback to compute live if course is known
    if course_id:
        try:
            cfg, cfg_id = load_risk_config(db)
            calc = calculate_student_course_risk(db, student_id, course_id, config=cfg, config_id=cfg_id)
            if calc.get("score") is not None:
                return float(calc["score"]), calc.get("band", "Safe")
        except Exception:
            pass

    return 0.0, "Safe"


def _enrich_intervention_out(
    db: Session, row: InterventionModel, current_score: Optional[float] = None
) -> InterventionOut:
    student_user = db.get(UserModel, row.student_id)
    student_rec = db.get(StudentModel, row.student_id)
    creator_user = db.get(UserModel, row.created_by)
    course = db.get(CourseModel, row.course_id) if row.course_id else None

    curr = current_score
    if curr is None:
        curr, _ = _get_student_current_risk(db, row.student_id, row.course_id)

    creation_score = float(row.score_at_creation)
    score_delta = round(curr - creation_score, 2)

    return InterventionOut(
        id=row.id,
        student_id=row.student_id,
        student_name=student_user.name if student_user else None,
        student_roll_no=student_rec.roll_no if student_rec else None,
        course_id=row.course_id,
        course_name=course.name if course else None,
        course_code=course.code if course else None,
        created_by=row.created_by,
        created_by_name=creator_user.name if creator_user else None,
        kind=row.kind,
        note=row.note,
        follow_up_on=row.follow_up_on,
        outcome=row.outcome,
        score_at_creation=creation_score,
        band_at_creation=row.band_at_creation,
        current_score=curr,
        score_change=score_delta,
        created_at=row.created_at,
        closed_at=row.closed_at,
    )


@router.post(
    "",
    response_model=InterventionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Log a supportive intervention action",
)
async def create_intervention(
    payload: InterventionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"]) if "sub" in current_user else current_user.get("id")
    user_role = current_user.get("role", "")

    # Visibility rule: Creator must be student's mentor or course instructor (or admin)
    # Dean has read-only access (403), Students cannot access (403)
    is_authorized = check_can_create_intervention(
        db, user_id, user_role, payload.student_id, payload.course_id
    )
    verify_access(
        current_user,
        Action.CREATE_INTERVENTION,
        {"is_authorized_creator": is_authorized},
    )

    student = db.get(StudentModel, payload.student_id)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": f"Student {payload.student_id} not found"},
        )

    # Capture baseline risk at creation
    score_now, band_now = _get_student_current_risk(db, payload.student_id, payload.course_id)

    intervention = InterventionModel(
        student_id=payload.student_id,
        course_id=payload.course_id,
        created_by=user_id,
        kind=payload.kind,
        note=payload.note.strip(),
        follow_up_on=payload.follow_up_on,
        outcome="open",
        score_at_creation=Decimal(str(round(score_now, 2))),
        band_at_creation=band_now,
        created_at=datetime.now(timezone.utc),
    )
    db.add(intervention)
    db.commit()
    db.refresh(intervention)

    # Audit logging
    await audit_logger.log_event(
        actor_id=user_id,
        actor_role=user_role,
        action=AuditAction.INTERVENTION_CREATE,
        resource_type="intervention",
        resource_id=intervention.id,
        outcome="SUCCESS",
        metadata={
            "student_id": payload.student_id,
            "kind": payload.kind,
            "score_at_creation": score_now,
            "band_at_creation": band_now,
        },
    )

    return _enrich_intervention_out(db, intervention, current_score=score_now)


@router.get(
    "/students/{student_id}",
    response_model=List[InterventionOut],
    summary="Get timeline of interventions for a student",
)
async def get_student_interventions(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"]) if "sub" in current_user else current_user.get("id")
    user_role = current_user.get("role", "")

    # Visibility: creator, student's mentor, course instructors, or dean of department.
    # Students get 403!
    is_authorized = check_can_view_interventions(db, user_id, user_role, student_id)
    verify_access(
        current_user,
        Action.VIEW_INTERVENTIONS,
        {"is_authorized_viewer": is_authorized},
    )

    student_user = db.get(UserModel, student_id)
    is_dean = False
    if student_user and student_user.department_id:
        is_dean = check_is_dean(db, user_id, student_user.department_id)

    # Audited view when dean accesses student records
    if is_dean and user_role != Role.ADMIN.value:
        await audit_logger.log_event(
            actor_id=user_id,
            actor_role=user_role,
            action=AuditAction.DEAN_RECORD_VIEW,
            resource_type="student_interventions",
            resource_id=student_id,
            outcome="SUCCESS",
            metadata={"student_id": student_id, "action": "view_interventions_timeline"},
        )

    rows = db.scalars(
        select(InterventionModel)
        .where(InterventionModel.student_id == student_id)
        .order_by(InterventionModel.created_at.desc())
    ).all()

    current_score, _ = _get_student_current_risk(db, student_id)
    return [_enrich_intervention_out(db, r, current_score=current_score) for r in rows]


@router.patch(
    "/{intervention_id}",
    response_model=InterventionOut,
    summary="Update intervention outcome or notes (Human-driven only)",
)
async def update_intervention(
    intervention_id: int,
    payload: InterventionUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"]) if "sub" in current_user else current_user.get("id")
    user_role = current_user.get("role", "")

    intervention = db.get(InterventionModel, intervention_id)
    if not intervention:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Intervention not found"},
        )

    # Scope check: creator, mentor, or course instructor. Dean is read-only (403), students forbidden (403)
    is_authorized = check_can_update_intervention(db, user_id, user_role, intervention)
    verify_access(
        current_user,
        Action.UPDATE_INTERVENTION,
        {"is_authorized_updater": is_authorized},
    )

    if payload.outcome is not None:
        intervention.outcome = payload.outcome
        if payload.outcome in ("recovered", "not_recovered", "escalated"):
            intervention.closed_at = datetime.now(timezone.utc)
        elif payload.outcome == "open":
            intervention.closed_at = None

    if payload.note is not None:
        intervention.note = payload.note.strip()

    if payload.follow_up_on is not None:
        intervention.follow_up_on = payload.follow_up_on

    db.commit()
    db.refresh(intervention)

    return _enrich_intervention_out(db, intervention)


@router.get(
    "/follow-ups-due",
    response_model=List[InterventionOut],
    summary="List active follow-ups due for the authenticated user",
)
async def get_follow_ups_due(
    days_ahead: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"]) if "sub" in current_user else current_user.get("id")
    user_role = current_user.get("role", "")

    if user_role == Role.STUDENT.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "PERM_403", "message": "Students cannot access intervention follow-ups"},
        )

    query = select(InterventionModel).where(
        InterventionModel.outcome == "open",
        InterventionModel.follow_up_on.is_not(None),
    )

    if user_role != Role.ADMIN.value:
        # Filter for students where user is creator, mentor, or instructor
        mentee_ids = db.scalars(
            select(MentorAssignmentModel.student_id).where(MentorAssignmentModel.mentor_id == user_id)
        ).all()
        query = query.where(
            (InterventionModel.created_by == user_id) | (InterventionModel.student_id.in_(mentee_ids))
        )

    rows = db.scalars(query.order_by(InterventionModel.follow_up_on.asc())).all()
    return [_enrich_intervention_out(db, r) for r in rows]
