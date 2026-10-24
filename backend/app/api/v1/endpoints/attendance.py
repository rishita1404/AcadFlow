"""
Attendance API endpoints — AcadFlow (Member 3: Raghav)

Implements:
  GET  /attendance/                                          — index
  POST /attendance/sessions                                  — create a class session (faculty)
  GET  /attendance/sessions/{id}                             — get session details
  POST /attendance/sessions/{id}/mark                        — bulk mark attendance (faculty)
  PATCH /attendance/records/{id}                             — correct attendance + audit (faculty)
  GET  /attendance/students/{sid}/courses/{cid}/buffer       — student buffer view
  POST /attendance/upload                                    — Excel/CSV bulk upload (faculty)
  GET  /attendance/upload/template                           — download attendance CSV template
  GET  /attendance/students/{sid}/courses/{cid}/history      — per-student attendance history

After any attendance change the risk snapshot is recalculated synchronously
and buffer-warning notifications are auto-dispatched.
"""

from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.core.deps import can_access, get_db
from app.core.errors import ConflictError, NotFoundError
from app.models import (
    AttendanceRecordModel,
    ClassSessionModel,
    CourseModel,
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
from app.services.csv_ingest import generate_attendance_template_csv, ingest_attendance_file
from app.services.notification_service import notify_attendance_buffer
from app.services.risk_data import (
    get_attendance_inputs,
    load_risk_config,
    persist_risk_snapshot,
)

router = APIRouter()


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────


def _assert_student_exists(db: Session, student_id: int) -> None:
    if not db.get(StudentModel, student_id):
        raise NotFoundError(f"Student {student_id} not found.")


def _assert_session_exists(db: Session, session_id: int) -> ClassSessionModel:
    s = db.get(ClassSessionModel, session_id)
    if not s:
        raise NotFoundError(f"Class session {session_id} not found.")
    return s


def _trigger_risk_and_notify(
    db: Session, student_id: int, course_id: int, course_code: str
) -> None:
    """
    Recalculate risk snapshot and dispatch buffer notifications.
    Wrapped in try/except so attendance writes never roll back on notification failure.
    """
    try:
        data = persist_risk_snapshot(db, student_id, course_id)
        notify_attendance_buffer(
            db=db,
            student_id=student_id,
            course_id=course_id,
            course_code=course_code,
            buffer=data.get("buffer"),
            attendance_pct=data.get("attendance_pct"),
        )
    except Exception:
        pass  # Non-critical — log in production


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
    summary="Create a class session (faculty)",
)
def create_session(
    payload: ClassSessionCreate,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Faculty create a class session for a course."""
    can_access(user=current_user, action="create", resource="sessions")

    course = db.get(CourseModel, payload.course_id)
    if not course:
        raise NotFoundError(f"Course {payload.course_id} not found.")

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
    summary="Mark attendance for a session (triggers risk recalculation + notifications)",
)
def mark_session_attendance(
    session_id: int,
    payload: AttendanceBulkMarkRequest,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Mark or overwrite attendance for multiple students in one session.

    PRD Phase G: after all records are persisted, risk snapshots are
    recalculated and buffer-warning notifications dispatched for every
    affected student.
    """
    can_access(user=current_user, action="mark", resource="attendance")

    if payload.session_id != session_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="session_id in URL and body must match.",
        )

    class_session = _assert_session_exists(db, session_id)
    course = db.get(CourseModel, class_session.course_id)
    course_code = course.code if course else f"course_{class_session.course_id}"

    now = datetime.now(timezone.utc)
    results: list[AttendanceRecordModel] = []
    actor_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1

    for rec in payload.records:
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
                marked_by=actor_id,
                marked_at=now,
            )
            db.add(new_rec)
            results.append(new_rec)

    db.commit()

    # Phase G: trigger risk recalculation + notifications for all affected students
    for rec in payload.records:
        _trigger_risk_and_notify(db, rec.student_id, class_session.course_id, course_code)

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
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Faculty may correct a previously marked attendance record.
    An audit entry is written and risk is recalculated for the student.
    """
    can_access(user=current_user, action="edit", resource="attendance")

    record = db.get(AttendanceRecordModel, record_id)
    if not record:
        raise NotFoundError(f"Attendance record {record_id} not found.")

    old_status = record.status
    record.status = payload.status
    record.marked_at = datetime.now(timezone.utc)
    actor_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1

    from app.models.audit import AuditLogModel

    audit = AuditLogModel(
        entity="attendance_records",
        entity_id=str(record_id),
        action="update",
        old_value=old_status,
        new_value=payload.status,
        actor_id=actor_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit)
    db.commit()
    db.refresh(record)

    class_session = db.get(ClassSessionModel, record.session_id)
    if class_session:
        course = db.get(CourseModel, class_session.course_id)
        course_code = course.code if course else f"course_{class_session.course_id}"
        _trigger_risk_and_notify(db, record.student_id, class_session.course_id, course_code)

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
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Return the PRD attendance buffer calculation for a student in a course.
    Handles insufficient data gracefully.
    """
    can_access(user=current_user, action="read", resource="attendance")

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


# ──────────────────────────────────────────────────────────────────────────────
# Student attendance history (per-course)
# ──────────────────────────────────────────────────────────────────────────────


@router.get(
    "/students/{student_id}/courses/{course_id}/history",
    summary="Get attendance history for one student in one course",
)
def get_student_attendance_history(
    student_id: int,
    course_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Return chronological attendance records for a student in a course,
    with session dates and statuses.
    """
    can_access(user=current_user, action="read", resource="attendance")
    _assert_student_exists(db, student_id)

    sessions = db.scalars(
        select(ClassSessionModel)
        .where(
            ClassSessionModel.course_id == course_id,
            ClassSessionModel.is_cancelled == False,  # noqa: E712
        )
        .order_by(ClassSessionModel.held_on.asc())
    ).all()

    session_ids = [s.id for s in sessions]
    records = db.scalars(
        select(AttendanceRecordModel).where(
            AttendanceRecordModel.student_id == student_id,
            AttendanceRecordModel.session_id.in_(session_ids),
        )
    ).all()
    record_map = {r.session_id: r.status for r in records}

    history = []
    for s in sessions:
        att_status = record_map.get(s.id, "absent")
        history.append({
            "session_id": s.id,
            "date": s.held_on.isoformat(),
            "status": att_status,
        })

    return {
        "student_id": student_id,
        "course_id": course_id,
        "total_sessions": len(sessions),
        "history": history,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Excel/CSV Bulk Upload (Faculty)
# ──────────────────────────────────────────────────────────────────────────────


@router.post(
    "/upload",
    summary="Bulk upload attendance via CSV or Excel file (faculty)",
    response_description="Upload result with processed/skipped/error counts",
)
def upload_attendance_file(
    course_id: int = Query(..., description="Course ID to upload attendance for"),
    file: UploadFile = File(..., description="CSV or XLSX attendance sheet"),
    change_reason: Optional[str] = Form(None, description="Mandatory audit reason if altering existing attendance"),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Faculty upload a CSV or Excel attendance sheet for a course.

    **Required columns**: `roll_no`, `date`, `status`

    **Accepted status values**: present (P), absent (A), late (L)

    **Accepted date formats**: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY

    Returns a detailed result with count of processed rows, duplicates
    (which are updated), and any row-level errors.

    After upload, risk snapshots are recalculated for all affected students.
    """
    can_access(user=current_user, action="mark", resource="attendance")

    actor_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1

    # Validate file type before reading
    filename = file.filename or "upload.csv"
    if not filename.lower().endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .csv and .xlsx files are accepted.",
        )

    # Check file size (limit: 5 MB)
    file_bytes = file.file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 5 MB.",
        )

    try:
        result = ingest_attendance_file(
            db=db,
            file_bytes=file_bytes,
            filename=filename,
            course_id=course_id,
            marked_by_user_id=actor_id,
            change_reason=change_reason,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(exc),
        )

    # Trigger risk recalculation for all affected students (background-friendly)
    course = db.get(CourseModel, course_id)
    course_code = course.code if course else f"course_{course_id}"

    # Collect unique student_ids that were processed
    from app.models import StudentModel

    affected_roll_nos = {
        err.roll_no for err in result.errors  # exclude errored rows
    }
    all_students = db.scalars(select(StudentModel)).all()
    roll_map = {s.roll_no: s.user_id for s in all_students}

    for err_row in result.errors:
        pass  # errors were already excluded from processing

    # For processed rows, trigger risk update
    # (we can't easily get student_ids back from result without re-querying,
    #  so we trigger for all enrolled students in the course)
    from app.models import EnrolmentModel

    enrolled_ids = list(
        db.scalars(
            select(EnrolmentModel.student_id).where(
                EnrolmentModel.course_id == course_id
            )
        ).all()
    )
    for sid in enrolled_ids:
        try:
            data = persist_risk_snapshot(db, sid, course_id)
            notify_attendance_buffer(
                db=db,
                student_id=sid,
                course_id=course_id,
                course_code=course_code,
                buffer=data.get("buffer"),
                attendance_pct=data.get("attendance_pct"),
            )
        except Exception:
            pass

    return {
        "course_id": result.course_id,
        "filename": filename,
        "total_rows": result.total_rows,
        "processed": result.processed,
        "skipped_duplicates": result.skipped_duplicates,
        "sessions_created": result.sessions_created,
        "error_count": len(result.errors),
        "errors": [
            {
                "row": e.row_number,
                "roll_no": e.roll_no,
                "date": e.date_str,
                "status": e.status_str,
                "reason": e.reason,
            }
            for e in result.errors
        ],
    }


@router.get(
    "/upload/template",
    summary="Download attendance CSV template for a course (faculty)",
    response_description="Pre-populated CSV with enrolled students",
)
def download_attendance_template(
    course_id: int = Query(..., description="Course ID"),
    session_date: Optional[date] = Query(
        None, description="Pre-fill date (YYYY-MM-DD). Defaults to today."
    ),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Download a CSV template pre-populated with all enrolled students' roll numbers.
    Fill in the 'status' column (P/A/L) and upload via POST /attendance/upload.
    """
    can_access(user=current_user, action="view_course", resource={"course_id": course_id})

    course = db.get(CourseModel, course_id)
    if not course:
        raise NotFoundError(f"Course {course_id} not found.")

    csv_bytes = generate_attendance_template_csv(
        db=db, course_id=course_id, session_date=session_date
    )

    filename = f"attendance_template_{course.code}_{(session_date or date.today()).isoformat()}.csv"
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
