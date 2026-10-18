"""
Attendance API endpoints — AcadFlow (Member 3: Raghav)

Implements:
  POST /attendance/sessions          — create a class session (faculty)
  POST /attendance/sessions/{id}/mark — mark attendance for a session (faculty)
  PATCH /attendance/records/{id}     — correct an attendance record + audit (faculty)
  GET  /attendance/students/{sid}/courses/{cid}/buffer — student buffer view

After any attendance change the risk snapshot is recalculated synchronously
(PRD Phase G requirement for Evaluation 1).
"""

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import can_access, get_db
from app.core.errors import ConflictError, NotFoundError
from app.models import (
    AttendanceRecordModel,
    ClassSessionModel,
    CourseModel,
    EnrolmentModel,
    StudentModel,
)
from app.schemas.risk import (
    AttendanceBufferOut,
    AttendanceBulkMarkRequest,
    AttendanceMarkRequest,
    AttendanceRecordOut,
    ClassSessionCreate,
    ClassSessionOut,
)
from app.services.buffer import compute_attendance_buffer
from app.services.risk_data import (
    get_attendance_inputs,
    load_risk_config,
    persist_risk_snapshot,
)

router = APIRouter()


# ──────────────────────────────────────────────────────────────────────────────
# Helper
# ──────────────────────────────────────────────────────────────────────────────

def _assert_student_exists(db: Session, student_id: int) -> None:
    if not db.get(StudentModel, student_id):
        raise NotFoundError(f"Student {student_id} not found.")


def _assert_session_exists(db: Session, session_id: int) -> ClassSessionModel:
    s = db.get(ClassSessionModel, session_id)
    if not s:
        raise NotFoundError(f"Class session {session_id} not found.")
    return s


# ──────────────────────────────────────────────────────────────────────────────
# Health / index
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/")
async def get_attendance_index():
    return {"endpoint": "attendance", "status": "active"}


# ──────────────────────────────────────────────────────────────────────────────
# Class sessions
# ──────────────────────────────────────────────────────────────────────────────

@router.post(
    "/sessions",
    response_model=ClassSessionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a class session",
)
def create_session(
    payload: ClassSessionCreate,
    db: Session = Depends(get_db),
):
    """Faculty create a class session for a course."""
    can_access(user=None, action="create", resource="sessions")

    course = db.get(CourseModel, payload.course_id)
    if not course:
        raise NotFoundError(f"Course {payload.course_id} not found.")

    # Duplicate guard
    existing = db.scalar(
        select(ClassSessionModel).where(
            ClassSessionModel.course_id == payload.course_id,
            ClassSessionModel.held_on == payload.held_on,
        )
    )
    if existing:
        raise ConflictError(
            f"Session for course {payload.course_id} on {payload.held_on} already exists."
        )

    session = ClassSessionModel(
        course_id=payload.course_id,
        held_on=payload.held_on,
        is_cancelled=payload.is_cancelled,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return ClassSessionOut.model_validate(session)


@router.get("/sessions/{session_id}", response_model=ClassSessionOut)
def get_session(session_id: int, db: Session = Depends(get_db)):
    return ClassSessionOut.model_validate(_assert_session_exists(db, session_id))


# ──────────────────────────────────────────────────────────────────────────────
# Mark attendance — bulk per session (Phase G trigger point)
# ──────────────────────────────────────────────────────────────────────────────

@router.post(
    "/sessions/{session_id}/mark",
    response_model=List[AttendanceRecordOut],
    status_code=status.HTTP_201_CREATED,
    summary="Mark attendance for a session (triggers risk recalculation)",
)
def mark_session_attendance(
    session_id: int,
    payload: AttendanceBulkMarkRequest,
    db: Session = Depends(get_db),
):
    """
    Mark or overwrite attendance for multiple students in one session.

    PRD Phase G: after all records are persisted, risk snapshots are
    recalculated for every affected student.
    """
    can_access(user=None, action="mark", resource="attendance")

    if payload.session_id != session_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="session_id in URL and body must match.",
        )

    class_session = _assert_session_exists(db, session_id)
    now = datetime.now(timezone.utc)
    results: list[AttendanceRecordModel] = []

    for rec in payload.records:
        # Upsert: update existing or create new
        existing = db.scalar(
            select(AttendanceRecordModel).where(
                AttendanceRecordModel.session_id == session_id,
                AttendanceRecordModel.student_id == rec.student_id,
            )
        )
        if existing:
            existing.status = rec.status
            existing.marked_at = now
            results.append(existing)
        else:
            _assert_student_exists(db, rec.student_id)
            new_rec = AttendanceRecordModel(
                session_id=session_id,
                student_id=rec.student_id,
                status=rec.status,
                marked_by=1,      # placeholder — replace with get_current_user.id
                marked_at=now,
            )
            db.add(new_rec)
            results.append(new_rec)

    db.commit()

    # ── Phase G: trigger risk recalculation for all affected students ────────
    for rec in payload.records:
        try:
            persist_risk_snapshot(db, rec.student_id, class_session.course_id)
        except Exception:
            pass  # log failure; do not roll back the attendance write

    return [AttendanceRecordOut.model_validate(r) for r in results]


# ──────────────────────────────────────────────────────────────────────────────
# Correct a single attendance record (PATCH) + audit
# ──────────────────────────────────────────────────────────────────────────────

@router.patch(
    "/records/{record_id}",
    response_model=AttendanceRecordOut,
    summary="Correct an attendance record (faculty) — triggers risk recalculation",
)
def patch_attendance_record(
    record_id: int,
    payload: AttendanceMarkRequest,
    db: Session = Depends(get_db),
):
    """
    Faculty may correct a previously marked attendance record.
    An audit entry is written and risk is recalculated for the student.
    """
    can_access(user=None, action="edit", resource="attendance")

    record = db.get(AttendanceRecordModel, record_id)
    if not record:
        raise NotFoundError(f"Attendance record {record_id} not found.")

    old_status = record.status
    record.status = payload.status
    record.marked_at = datetime.now(timezone.utc)

    # Audit log entry
    from app.models.audit import AuditLogModel
    audit = AuditLogModel(
        entity="attendance_records",
        entity_id=str(record_id),
        action="update",
        old_value=old_status,
        new_value=payload.status,
        actor_id=1,   # placeholder — replace with get_current_user.id
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit)
    db.commit()
    db.refresh(record)

    # Recalculate risk
    session = db.get(ClassSessionModel, record.session_id)
    if session:
        try:
            persist_risk_snapshot(db, record.student_id, session.course_id)
        except Exception:
            pass

    return AttendanceRecordOut.model_validate(record)


# ──────────────────────────────────────────────────────────────────────────────
# Student attendance buffer view
# ──────────────────────────────────────────────────────────────────────────────

@router.get(
    "/students/{student_id}/courses/{course_id}/buffer",
    response_model=AttendanceBufferOut,
    summary="Get attendance buffer for one student in one course",
)
def get_student_buffer(
    student_id: int,
    course_id: int,
    db: Session = Depends(get_db),
):
    """
    Return the PRD attendance buffer calculation for a student in a course.
    Handles insufficient data gracefully.
    """
    can_access(user=None, action="read", resource="attendance")

    _assert_student_exists(db, student_id)

    config, _ = load_risk_config(db)
    att = get_attendance_inputs(db, student_id, course_id)

    buf = compute_attendance_buffer(
        attended=att["attended"],
        held=att["held"],
        total_classes=att["total_classes"],
        min_classes=config.min_classes,
        holiday_count=att["holiday_count"],
    )

    return AttendanceBufferOut(
        student_id=student_id,
        course_id=course_id,
        total_classes=att["total_classes"],
        held=att["held"],
        attended=att["attended"],
        required=buf["required"],
        still_need=buf["still_need"],
        remaining=buf["remaining"],
        buffer=buf["buffer"],
        attendance_pct=buf["attendance_pct"],
        holiday_count=att["holiday_count"],
        insufficient_data=buf["insufficient_data"],
        status_message=buf["status_message"],
    )
