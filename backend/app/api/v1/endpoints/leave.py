"""
Leave Requests API Endpoints — AcadFlow Phase 2.

Handles student leave submissions, mentor/dean inbox, decision logic with
neutral attendance excusal, worker recompute, and audit logging.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.audit import AuditAction, audit_logger
from app.core.authorization import (
    Action,
    check_can_decide_leave,
    check_is_course_instructor,
    check_is_dean,
    check_is_mentor,
    verify_access,
)
from app.core.deps import get_db
from app.core.permissions import Role
from app.models import (
    CourseStaffModel,
    DeanAssignmentModel,
    EnrolmentModel,
    MentorAssignmentModel,
    StudentModel,
    UserModel,
)
from app.models.leave import LeaveRequestModel
from app.schemas.leave import (
    LeaveRequestCreate,
    LeaveRequestDecision,
    LeaveRequestOut,
)
from app.services.notification_service import _upsert_notification
from app.services.risk_data import persist_risk_snapshot

router = APIRouter()


async def _invalidate_dashboard_cache(student_id: int):
    try:
        from app.db.redis import redis_client

        if redis_client:
            await redis_client.delete(f"dashboard:{student_id}")
            await redis_client.delete(f"attendance:{student_id}")
            await redis_client.delete(f"risk:{student_id}")
    except Exception:
        pass


def _enrich_leave_out(db: Session, row: LeaveRequestModel) -> LeaveRequestOut:
    student_user = db.get(UserModel, row.student_id)
    student_rec = db.get(StudentModel, row.student_id)
    decided_by_user = db.get(UserModel, row.decided_by) if row.decided_by else None

    return LeaveRequestOut(
        id=row.id,
        student_id=row.student_id,
        student_name=student_user.name if student_user else None,
        student_roll_no=student_rec.roll_no if student_rec else None,
        type=row.type,
        date_from=row.date_from,
        date_to=row.date_to,
        reason=row.reason,
        status=row.status,
        decided_by=row.decided_by,
        decided_by_name=decided_by_user.name if decided_by_user else None,
        decided_at=row.decided_at,
        decision_note=row.decision_note,
        created_at=row.created_at,
    )


def _build_leave_reason(payload: LeaveRequestCreate, medical_filename: Optional[str] = None) -> str:
    if payload.reason and payload.reason.strip():
        return payload.reason.strip()
    if payload.type == "duty":
        parts = []
        if payload.event_name and payload.event_name.strip():
            parts.append(payload.event_name.strip())
        if payload.club_org and payload.club_org.strip():
            parts.append(payload.club_org.strip())
        if payload.duty_detail and payload.duty_detail.strip():
            parts.append(f"({payload.duty_detail.strip()})")
        return " — ".join(parts) if parts else "Duty / event leave"
    if medical_filename:
        return f"Medical document: {medical_filename}"
    return "Medical leave"


async def _create_leave_request(
    payload: LeaveRequestCreate,
    db: Session,
    current_user: dict,
    medical_filename: Optional[str] = None,
) -> LeaveRequestOut:
    user_id = int(current_user["sub"]) if "sub" in current_user else current_user.get("id")

    # Scope check: students can only submit for themselves
    verify_access(current_user, Action.SUBMIT_LEAVE, {"student_id": user_id})

    if payload.date_from > payload.date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DATE_RANGE", "message": "date_from cannot be after date_to"},
        )

    leave_req = LeaveRequestModel(
        student_id=user_id,
        type=payload.type,
        date_from=payload.date_from,
        date_to=payload.date_to,
        reason=_build_leave_reason(payload, medical_filename=medical_filename),
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(leave_req)
    db.commit()
    db.refresh(leave_req)

    # Notify approver (assigned mentor, or fallback dean of student's department)
    student_user = db.get(UserModel, user_id)
    student_name = student_user.name if student_user else f"Student #{user_id}"
    mentor_id = db.scalar(
        select(MentorAssignmentModel.mentor_id).where(
            MentorAssignmentModel.student_id == user_id
        )
    )
    approver_ids: list[int] = []
    if mentor_id is not None:
        approver_ids = [int(mentor_id)]
    elif student_user and student_user.department_id:
        approver_ids = list(
            db.scalars(
                select(DeanAssignmentModel.user_id).where(
                    DeanAssignmentModel.department_id == student_user.department_id
                )
            ).all()
        )
    for app_id in approver_ids:
        _upsert_notification(
            db,
            recipient_id=app_id,
            title="New Leave Request Submitted",
            message=f"{student_name} submitted a {leave_req.type} leave request ({leave_req.date_from} to {leave_req.date_to}).",
            kind="reminder",
            dedup_key=f"leave_submit_{leave_req.id}_{app_id}",
        )
    if approver_ids:
        db.commit()

    return _enrich_leave_out(db, leave_req)


@router.post("/requests", response_model=LeaveRequestOut, status_code=status.HTTP_201_CREATED, summary="Submit a leave request")
async def submit_leave_request(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    content_type = request.headers.get("content-type", "")
    medical_filename: Optional[str] = None

    if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        medical_file = form.get("medical_file")
        if medical_file is not None and hasattr(medical_file, "filename"):
            medical_filename = medical_file.filename
        raw = {
            "type": form.get("type"),
            "date_from": form.get("date_from"),
            "date_to": form.get("date_to"),
            "reason": form.get("reason") or None,
            "event_name": form.get("event_name") or None,
            "club_org": form.get("club_org") or None,
            "duty_detail": form.get("duty_detail") or None,
        }
    else:
        try:
            raw = await request.json()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "INVALID_JSON", "message": "Invalid JSON request body."},
            )

    try:
        payload = LeaveRequestCreate.model_validate(raw)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(),
        )

    return await _create_leave_request(
        payload=payload,
        db=db,
        current_user=current_user,
        medical_filename=medical_filename,
    )


@router.get("/my-requests", response_model=List[LeaveRequestOut], summary="List own leave requests")
async def get_my_leave_requests(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"]) if "sub" in current_user else current_user.get("id")
    verify_access(current_user, Action.VIEW_LEAVE, {"student_id": user_id})

    rows = db.scalars(
        select(LeaveRequestModel)
        .where(LeaveRequestModel.student_id == user_id)
        .order_by(LeaveRequestModel.created_at.desc())
    ).all()

    return [_enrich_leave_out(db, r) for r in rows]


@router.get("/inbox", response_model=List[LeaveRequestOut], summary="List leave requests for mentor/dean inbox")
async def get_leave_inbox(
    status_filter: Optional[str] = Query(None, pattern="^(pending|approved|rejected)$"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"]) if "sub" in current_user else current_user.get("id")
    user_role = current_user.get("role", "")

    # Role capability check
    verify_access(current_user, Action.VIEW_LEAVE)

    query = select(LeaveRequestModel)
    if status_filter:
        query = query.where(LeaveRequestModel.status == status_filter)

    if user_role == Role.ADMIN.value:
        rows = db.scalars(query.order_by(LeaveRequestModel.created_at.desc())).all()
        return [_enrich_leave_out(db, r) for r in rows]

    # For mentor: find students assigned to this mentor
    assigned_student_ids = db.scalars(
        select(MentorAssignmentModel.student_id).where(MentorAssignmentModel.mentor_id == user_id)
    ).all()

    # For instructor: find students enrolled in courses taught by this faculty
    instructor_student_ids = db.scalars(
        select(EnrolmentModel.student_id)
        .join(CourseStaffModel, CourseStaffModel.course_id == EnrolmentModel.course_id)
        .where(CourseStaffModel.user_id == user_id)
    ).all()

    # For dean: all students in dean's department
    dean_student_ids = []
    current_db_user = db.get(UserModel, user_id)
    dept_id = current_db_user.department_id if current_db_user else None

    if dept_id and check_is_dean(db, user_id, dept_id):
        dean_student_ids = db.scalars(
            select(UserModel.id).where(
                UserModel.department_id == dept_id,
                UserModel.role == Role.STUDENT.value,
            )
        ).all()

    visible_student_ids = set(assigned_student_ids) | set(instructor_student_ids) | set(dean_student_ids)
    if not visible_student_ids:
        return []

    rows = db.scalars(
        query.where(LeaveRequestModel.student_id.in_(visible_student_ids))
        .order_by(LeaveRequestModel.created_at.desc())
    ).all()

    return [_enrich_leave_out(db, r) for r in rows]


@router.get("/requests/{request_id}", response_model=LeaveRequestOut, summary="Get leave request detail")
async def get_leave_request_detail(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"]) if "sub" in current_user else current_user.get("id")
    user_role = current_user.get("role", "")

    req = db.get(LeaveRequestModel, request_id)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Leave request not found"},
        )

    # Visibility check: student self, assigned mentor, affected course instructor, dean of dept, or admin
    is_owner = (user_id == req.student_id)
    is_mentor = check_is_mentor(db, user_id, req.student_id)
    is_instructor = check_is_course_instructor(db, user_id, req.student_id)
    student_user = db.get(UserModel, req.student_id)
    is_dean = check_is_dean(db, user_id, student_user.department_id) if student_user and student_user.department_id else False

    is_authorized = is_owner or is_mentor or is_instructor or is_dean or (user_role == Role.ADMIN.value)
    verify_access(current_user, Action.VIEW_LEAVE, {"is_authorized_viewer": is_authorized, "student_id": req.student_id})

    # If dean views record, record audit log per requirement
    if is_dean and not is_owner and not is_mentor and user_role != Role.ADMIN.value:
        await audit_logger.log_event(
            actor_id=user_id,
            actor_role=user_role,
            action=AuditAction.DEAN_RECORD_VIEW,
            resource_type="leave_request",
            resource_id=req.id,
            metadata={"student_id": req.student_id, "view": "leave_detail"},
        )

    return _enrich_leave_out(db, req)


@router.post("/requests/{request_id}/decide", response_model=LeaveRequestOut, summary="Approve or reject a leave request")
async def decide_leave_request(
    request_id: int,
    payload: LeaveRequestDecision,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"]) if "sub" in current_user else current_user.get("id")
    user_role = current_user.get("role", "")

    req = db.get(LeaveRequestModel, request_id)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Leave request not found"},
        )

    # Approver check: student's mentor; if student has no mentor, the dean of student's department.
    # Anyone else gets 403!
    is_authorized_approver = check_can_decide_leave(db, user_id, user_role, req.student_id)
    verify_access(
        current_user,
        Action.DECIDE_LEAVE,
        {"is_authorized_approver": is_authorized_approver},
    )

    req.status = payload.status
    req.decided_by = user_id
    req.decided_at = datetime.now(timezone.utc)
    req.decision_note = payload.decision_note.strip() if payload.decision_note else None

    db.commit()
    db.refresh(req)

    # Audit logging for decision
    audit_action = AuditAction.LEAVE_APPROVAL if payload.status == "approved" else AuditAction.LEAVE_REJECTION
    await audit_logger.log_event(
        actor_id=user_id,
        actor_role=user_role,
        action=audit_action,
        resource_type="leave_request",
        resource_id=req.id,
        outcome="SUCCESS",
        metadata={
            "student_id": req.student_id,
            "type": req.type,
            "status": req.status,
            "decision_note": req.decision_note,
        },
    )

    if payload.status == "approved":
        # 1. Trigger worker recompute for each enrolled course of student
        enrolled_courses = db.scalars(
            select(EnrolmentModel.course_id).where(EnrolmentModel.student_id == req.student_id)
        ).all()
        for cid in enrolled_courses:
            try:
                persist_risk_snapshot(db, req.student_id, cid)
            except Exception:
                pass

        # 2. Invalidate dashboard cache
        await _invalidate_dashboard_cache(req.student_id)

        # 3. Notify student
        _upsert_notification(
            db,
            recipient_id=req.student_id,
            title="Leave Request Approved",
            message=f"Your {req.type} leave from {req.date_from} to {req.date_to} has been approved.",
            kind="info",
            dedup_key=f"leave_appr_{req.id}",
        )
    else:
        # Rejected notification
        _upsert_notification(
            db,
            recipient_id=req.student_id,
            title="Leave Request Rejected",
            message=f"Your {req.type} leave was rejected: {req.decision_note or 'No reason provided.'}",
            kind="warning",
            dedup_key=f"leave_rej_{req.id}",
        )
    db.commit()

    return _enrich_leave_out(db, req)
