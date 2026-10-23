"""
Submission API endpoints — AcadFlow.

Implements assignment submissions with:
- On-time vs late calculation based on assignment due_at and grace_hours
- Rejection after hard deadline (due_at + grace_hours)
- Deduplication key per assignment, student, and version
- Version tracking on resubmission
- Synchronous risk recalculation trigger
"""

import hashlib
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.core.deps import can_access, get_db
from app.core.errors import ConflictError, NotFoundError
from app.models import AssignmentModel, StudentModel, SubmissionModel
from app.services.risk_data import persist_risk_snapshot

router = APIRouter()


class SubmissionCreate(BaseModel):
    assignment_id: int
    student_id: Optional[int] = Field(
        None, description="Student ID (inferred from token if omitted)"
    )
    file_key: Optional[str] = Field(None, description="S3/Storage key of uploaded file")
    file_content: Optional[str] = Field(None, description="Text or content payload")


class SubmissionOut(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    version: int
    status: str
    submitted_at: Optional[datetime]
    file_key: Optional[str]
    file_hash: Optional[str]
    dedupe_key: str

    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=List[SubmissionOut], summary="List submissions")
def list_submissions(
    assignment_id: Optional[int] = Query(None, description="Filter by assignment"),
    student_id: Optional[int] = Query(None, description="Filter by student"),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    query = select(SubmissionModel)
    if assignment_id is not None:
        query = query.where(SubmissionModel.assignment_id == assignment_id)
    if student_id is not None:
        query = query.where(SubmissionModel.student_id == student_id)

    query = query.order_by(SubmissionModel.submitted_at.desc())
    records = db.scalars(query).all()
    return [SubmissionOut.model_validate(r) for r in records]


@router.post(
    "",
    response_model=SubmissionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit work for an assignment",
)
def create_submission(
    payload: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    student_id = payload.student_id
    if student_id is None and current_user and "sub" in current_user:
        student_id = int(current_user["sub"])
    elif student_id is None:
        student_id = 1  # Default for testing

    can_access(
        user=current_user,
        action="submit_work",
        resource={"student_id": student_id, "assignment_id": payload.assignment_id},
    )

    assignment = db.get(AssignmentModel, payload.assignment_id)
    if not assignment:
        raise NotFoundError(f"Assignment {payload.assignment_id} not found")

    if not db.get(StudentModel, student_id):
        raise NotFoundError(f"Student {student_id} not found")

    now = datetime.now(timezone.utc)
    due = assignment.due_at
    if due.tzinfo is None:
        due = due.replace(tzinfo=timezone.utc)

    hard_deadline = due + timedelta(hours=assignment.grace_hours)

    if now > hard_deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Hard deadline has passed. Grace window ended at {hard_deadline.isoformat()}.",
        )

    sub_status = "on_time" if now <= due else "late"

    # Compute next version
    existing_submissions = db.scalars(
        select(SubmissionModel).where(
            SubmissionModel.assignment_id == payload.assignment_id,
            SubmissionModel.student_id == student_id,
        )
    ).all()
    next_version = len(existing_submissions) + 1

    file_hash = None
    if payload.file_content:
        file_hash = hashlib.sha256(payload.file_content.encode()).hexdigest()

    dedupe_key = f"{payload.assignment_id}:{student_id}:{next_version}"

    # Guard unique dedupe_key
    if db.scalar(
        select(SubmissionModel).where(SubmissionModel.dedupe_key == dedupe_key)
    ):
        raise ConflictError(f"Duplicate submission detected for key {dedupe_key}")

    sub = SubmissionModel(
        assignment_id=payload.assignment_id,
        student_id=student_id,
        version=next_version,
        status=sub_status,
        submitted_at=now,
        file_key=payload.file_key,
        file_hash=file_hash,
        dedupe_key=dedupe_key,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    # Recalculate risk snapshot synchronously
    try:
        persist_risk_snapshot(db, student_id, assignment.course_id)
    except Exception:
        pass

    return SubmissionOut.model_validate(sub)


@router.get(
    "/{submission_id}",
    response_model=SubmissionOut,
    summary="Get submission by ID",
)
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    sub = db.get(SubmissionModel, submission_id)
    if not sub:
        raise NotFoundError(f"Submission {submission_id} not found")

    can_access(
        user=current_user,
        action="view_student_record",
        resource={"student_id": sub.student_id},
    )
    return SubmissionOut.model_validate(sub)


class ExcuseSubmissionRequest(BaseModel):
    reason: str


@router.post(
    "/{submission_id}/excuse",
    response_model=SubmissionOut,
    summary="Excuse an existing submission with audited reason",
)
def excuse_submission(
    submission_id: int,
    payload: ExcuseSubmissionRequest,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    if not payload.reason or not payload.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": "Excuse reason is required"},
        )
    sub = db.get(SubmissionModel, submission_id)
    if not sub:
        raise NotFoundError(f"Submission {submission_id} not found")

    old_status = sub.status
    sub.status = "excused"

    from app.models.audit import AuditLogModel

    actor_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    audit = AuditLogModel(
        entity="submissions",
        entity_id=str(sub.id),
        action="excuse_submission",
        old_value=old_status,
        new_value=f"excused: {payload.reason.strip()}",
        actor_id=actor_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit)
    db.commit()
    db.refresh(sub)

    assignment = db.get(AssignmentModel, sub.assignment_id)
    if assignment:
        try:
            persist_risk_snapshot(db, sub.student_id, assignment.course_id)
        except Exception:
            pass

    return SubmissionOut.model_validate(sub)


@router.post(
    "/assignments/{assignment_id}/students/{student_id}/excuse",
    response_model=SubmissionOut,
    summary="Excuse an assignment for a student with audited reason",
)
def excuse_assignment_for_student(
    assignment_id: int,
    student_id: int,
    payload: ExcuseSubmissionRequest,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    if not payload.reason or not payload.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": "Excuse reason is required"},
        )
    assignment = db.get(AssignmentModel, assignment_id)
    if not assignment:
        raise NotFoundError(f"Assignment {assignment_id} not found")

    student = db.get(StudentModel, student_id)
    if not student:
        raise NotFoundError(f"Student {student_id} not found")

    sub = db.scalar(
        select(SubmissionModel)
        .where(
            SubmissionModel.assignment_id == assignment_id,
            SubmissionModel.student_id == student_id,
        )
        .order_by(SubmissionModel.version.desc())
    )

    from app.models.audit import AuditLogModel

    actor_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1

    if sub:
        old_status = sub.status
        sub.status = "excused"
        db.add(
            AuditLogModel(
                entity="submissions",
                entity_id=str(sub.id),
                action="excuse_submission",
                old_value=old_status,
                new_value=f"excused: {payload.reason.strip()}",
                actor_id=actor_id,
                created_at=datetime.now(timezone.utc),
            )
        )
    else:
        dedupe = f"{assignment_id}:{student_id}:1"
        sub = SubmissionModel(
            assignment_id=assignment_id,
            student_id=student_id,
            version=1,
            status="excused",
            submitted_at=datetime.now(timezone.utc),
            dedupe_key=dedupe,
        )
        db.add(sub)
        db.flush()
        db.add(
            AuditLogModel(
                entity="submissions",
                entity_id=str(sub.id),
                action="excuse_submission",
                old_value="none",
                new_value=f"excused: {payload.reason.strip()}",
                actor_id=actor_id,
                created_at=datetime.now(timezone.utc),
            )
        )

    db.commit()
    db.refresh(sub)

    try:
        persist_risk_snapshot(db, student_id, assignment.course_id)
    except Exception:
        pass

    return SubmissionOut.model_validate(sub)

