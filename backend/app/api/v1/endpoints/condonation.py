"""
Condonation Requests API Endpoints — AcadFlow Phase 2.

Handles faculty/mentor recommendations, dean condonation queue, approval/rejection
decisions with student profile note logging and audit logging.
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
    check_can_decide_condonation,
    check_can_recommend_condonation,
    check_is_dean,
    verify_access,
)
from app.core.permissions import Role
from app.core.deps import get_db
from app.models import (
    AuditLogModel,
    DepartmentModel,
    RiskConfigModel,
    SemesterModel,
    StudentModel,
    UserModel,
)
from app.models.leave import CondonationRequestModel
from app.schemas.leave import (
    CondonationDecision,
    CondonationRecommendRequest,
    CondonationRequestOut,
)
from app.services.attendance_stats import get_student_overall_attendance
from app.services.notification_service import _upsert_notification

router = APIRouter()


def _get_condonation_config(db: Session) -> tuple[float, bool]:
    cfg = db.scalar(select(RiskConfigModel).order_by(RiskConfigModel.id.desc()).limit(1))
    floor_pct = float(cfg.condonation_floor_pct) if cfg and cfg.condonation_floor_pct is not None else 65.0
    require_rec = bool(cfg.require_recommendation) if cfg and cfg.require_recommendation is not None else True
    return floor_pct, require_rec


def _enrich_condonation_out(db: Session, row: CondonationRequestModel) -> CondonationRequestOut:
    student_user = db.get(UserModel, row.student_id)
    student_rec = db.get(StudentModel, row.student_id)
    dept = db.get(DepartmentModel, student_user.department_id) if student_user and student_user.department_id else None
    recommender_user = db.get(UserModel, row.recommended_by) if row.recommended_by else None
    decided_by_user = db.get(UserModel, row.decided_by) if row.decided_by else None

    return CondonationRequestOut(
        id=row.id,
        student_id=row.student_id,
        student_name=student_user.name if student_user else None,
        student_roll_no=student_rec.roll_no if student_rec else None,
        department_name=dept.name if dept else None,
        semester_id=row.semester_id,
        attendance_pct_at_request=float(row.attendance_pct_at_request),
        reason=row.reason,
        status=row.status,
        recommended_by=row.recommended_by,
        recommended_by_name=recommender_user.name if recommender_user else None,
        decided_by=row.decided_by,
        decided_by_name=decided_by_user.name if decided_by_user else None,
        decision_note=row.decision_note,
        decided_at=row.decided_at,
        created_at=row.created_at,
    )


@router.post(
    "/recommend",
    response_model=CondonationRequestOut,
    status_code=status.HTTP_201_CREATED,
    summary="Recommend a student for attendance condonation",
)
async def recommend_condonation(
    payload: CondonationRecommendRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"]) if "sub" in current_user else current_user.get("id")
    user_role = current_user.get("role", "")

    # Role & scope check: Student's mentor OR instructor of one of the student's courses
    is_authorized = check_can_recommend_condonation(db, user_id, user_role, payload.student_id)
    verify_access(
        current_user,
        Action.RECOMMEND_CONDONATION,
        {"is_authorized_recommender": is_authorized},
    )

    # Check student exists
    student = db.get(StudentModel, payload.student_id)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": f"Student {payload.student_id} not found"},
        )

    # Check eligibility against admin config
    floor_pct, _ = _get_condonation_config(db)
    attendance_stats = get_student_overall_attendance(db, payload.student_id)
    current_pct = attendance_stats.get("overall_attendance_pct")
    
    # If student has recorded attendance and is below floor, reject recommendation
    if current_pct is not None and current_pct < floor_pct:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "BELOW_CONDONATION_FLOOR",
                "message": f"Student attendance ({current_pct}%) is below the minimum condonation threshold of {floor_pct}%.",
            },
        )

    actual_pct = current_pct if current_pct is not None else 0.0

    cond_req = CondonationRequestModel(
        student_id=payload.student_id,
        semester_id=payload.semester_id,
        attendance_pct_at_request=Decimal(str(round(actual_pct, 2))),
        reason=payload.reason.strip(),
        status="recommended",
        recommended_by=user_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(cond_req)
    db.commit()
    db.refresh(cond_req)

    # Write audit event for recommendation
    await audit_logger.log_event(
        actor_id=user_id,
        actor_role=user_role,
        action=AuditAction.CONDONATION_RECOMMENDATION,
        resource_type="condonation_request",
        resource_id=cond_req.id,
        outcome="SUCCESS",
        metadata={
            "student_id": payload.student_id,
            "semester_id": payload.semester_id,
            "attendance_pct_at_request": float(actual_pct),
            "reason": payload.reason,
        },
    )

    return _enrich_condonation_out(db, cond_req)


@router.get(
    "/queue",
    response_model=List[CondonationRequestOut],
    summary="List condonation requests in dean's department queue",
)
async def get_condonation_queue(
    department_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, pattern="^(recommended|approved|rejected)$"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"]) if "sub" in current_user else current_user.get("id")
    user_role = current_user.get("role", "")

    # Resolve department
    curr_db_user = db.get(UserModel, user_id)
    effective_dept_id = department_id or (curr_db_user.department_id if curr_db_user else None)

    # Dean scope check
    is_authorized = False
    if user_role == Role.ADMIN.value:
        is_authorized = True
    elif effective_dept_id and check_is_dean(db, user_id, effective_dept_id):
        is_authorized = True

    verify_access(
        current_user,
        Action.VIEW_CONDONATION,
        {"is_authorized_viewer": is_authorized},
    )

    query = select(CondonationRequestModel)
    if status_filter:
        query = query.where(CondonationRequestModel.status == status_filter)

    if effective_dept_id and user_role != Role.ADMIN.value:
        # Join UserModel to filter students in dean's department
        query = query.join(UserModel, UserModel.id == CondonationRequestModel.student_id).where(
            UserModel.department_id == effective_dept_id
        )

    rows = db.scalars(query.order_by(CondonationRequestModel.created_at.desc())).all()

    # Every dean record view must write an audit entry
    await audit_logger.log_event(
        actor_id=user_id,
        actor_role=user_role,
        action=AuditAction.DEAN_RECORD_VIEW,
        resource_type="condonation_queue",
        resource_id=effective_dept_id or 0,
        outcome="SUCCESS",
        metadata={
            "department_id": effective_dept_id,
            "records_count": len(rows),
        },
    )

    return [_enrich_condonation_out(db, r) for r in rows]


@router.get(
    "/my-requests",
    response_model=List[CondonationRequestOut],
    summary="List student's own condonation requests",
)
async def get_my_condonation_requests(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"]) if "sub" in current_user else current_user.get("id")
    verify_access(current_user, Action.VIEW_CONDONATION, {"student_id": user_id})

    rows = db.scalars(
        select(CondonationRequestModel)
        .where(CondonationRequestModel.student_id == user_id)
        .order_by(CondonationRequestModel.created_at.desc())
    ).all()

    return [_enrich_condonation_out(db, r) for r in rows]


@router.post(
    "/{request_id}/decide",
    response_model=CondonationRequestOut,
    summary="Dean approves or rejects a condonation request",
)
async def decide_condonation_request(
    request_id: int,
    payload: CondonationDecision,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"]) if "sub" in current_user else current_user.get("id")
    user_role = current_user.get("role", "")

    req = db.get(CondonationRequestModel, request_id)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Condonation request not found"},
        )

    # Dean scope check: Dean of the student's department decides
    is_authorized_dean = check_can_decide_condonation(db, user_id, user_role, req.student_id)
    verify_access(
        current_user,
        Action.DECIDE_CONDONATION,
        {"is_authorized_dean": is_authorized_dean},
    )

    floor_pct, require_rec = _get_condonation_config(db)
    if require_rec and req.status != "recommended":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_STATE",
                "message": f"Cannot decide request with current status '{req.status}'. A recommendation is required.",
            },
        )

    req.status = payload.status
    req.decided_by = user_id
    req.decided_at = datetime.now(timezone.utc)
    req.decision_note = payload.decision_note.strip()

    # Record decision as note on student profile (NEVER change attendance percentage!)
    note_log = AuditLogModel(
        entity="student_notes",
        entity_id=str(req.student_id),
        action="condonation_decision",
        new_value=f"Condonation {req.status.upper()}: {payload.decision_note.strip()}",
        actor_id=user_id,
        reason="Attendance Condonation Official Record",
        created_at=datetime.now(timezone.utc),
    )
    db.add(note_log)
    db.commit()
    db.refresh(req)

    # Audit logging
    audit_action = AuditAction.CONDONATION_APPROVAL if payload.status == "approved" else AuditAction.CONDONATION_REJECTION
    await audit_logger.log_event(
        actor_id=user_id,
        actor_role=user_role,
        action=audit_action,
        resource_type="condonation_request",
        resource_id=req.id,
        outcome="SUCCESS",
        metadata={
            "student_id": req.student_id,
            "status": req.status,
            "decision_note": req.decision_note,
        },
    )

    # Notify student
    _upsert_notification(
        db,
        recipient_id=req.student_id,
        title=f"Condonation Request {payload.status.capitalize()}",
        message=f"Your attendance condonation request was {payload.status}. Note: {req.decision_note}",
        kind="info" if payload.status == "approved" else "warning",
        dedup_key=f"condonation_decided_{req.id}",
    )
    db.commit()

    return _enrich_condonation_out(db, req)
