"""
Assignment API endpoints — AcadFlow.

CRUD operations for assignments with grace windows and publication states.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.core.deps import can_access, get_db
from app.core.errors import NotFoundError
from app.models import AssignmentModel, CourseModel

router = APIRouter()


class AssignmentCreate(BaseModel):
    course_id: int
    title: str = Field(..., min_length=1, max_length=200)
    kind: str = Field(
        default="assignment",
        description="One of: 'assignment', 'lab file', 'review', 'exam'",
    )
    description: Optional[str] = None
    due_at: datetime
    grace_hours: int = Field(default=48, ge=0, le=168)
    is_published: bool = Field(default=False)


class AssignmentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    kind: Optional[str] = None
    description: Optional[str] = None
    due_at: Optional[datetime] = None
    grace_hours: Optional[int] = Field(None, ge=0, le=168)
    is_published: Optional[bool] = None


class AssignmentOut(BaseModel):
    id: int
    course_id: int
    title: str
    kind: str
    description: Optional[str] = None
    due_at: datetime
    grace_hours: int
    is_published: bool

    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=List[AssignmentOut], summary="List assignments")
def list_assignments(
    course_id: Optional[int] = Query(None, description="Filter by course"),
    kind: Optional[str] = Query(None, description="Filter by kind"),
    is_published: Optional[bool] = Query(
        None, description="Filter by published status"
    ),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    can_access(
        user=current_user,
        action="view_course",
        resource={"course_id": course_id} if course_id else None,
    )

    query = select(AssignmentModel)
    if course_id is not None:
        query = query.where(AssignmentModel.course_id == course_id)
    if kind is not None:
        query = query.where(AssignmentModel.kind == kind)
    if is_published is not None:
        query = query.where(AssignmentModel.is_published == is_published)

    query = query.order_by(AssignmentModel.due_at.asc())
    records = db.scalars(query).all()
    return [AssignmentOut.model_validate(r) for r in records]


@router.post(
    "",
    response_model=AssignmentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create assignment",
)
def create_assignment(
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    can_access(
        user=current_user,
        action="create_assignment",
        resource={"course_id": payload.course_id},
    )

    course = db.get(CourseModel, payload.course_id)
    if not course:
        raise NotFoundError(f"Course {payload.course_id} not found")

    asgn = AssignmentModel(**payload.model_dump())
    db.add(asgn)
    db.commit()
    db.refresh(asgn)
    return AssignmentOut.model_validate(asgn)


@router.get(
    "/{assignment_id}", response_model=AssignmentOut, summary="Get assignment details"
)
def get_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    asgn = db.get(AssignmentModel, assignment_id)
    if not asgn:
        raise NotFoundError(f"Assignment {assignment_id} not found")

    can_access(
        user=current_user, action="view_course", resource={"course_id": asgn.course_id}
    )
    return AssignmentOut.model_validate(asgn)


@router.patch(
    "/{assignment_id}", response_model=AssignmentOut, summary="Update assignment"
)
def update_assignment(
    assignment_id: int,
    payload: AssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    asgn = db.get(AssignmentModel, assignment_id)
    if not asgn:
        raise NotFoundError(f"Assignment {assignment_id} not found")

    can_access(
        user=current_user, action="edit_course", resource={"course_id": asgn.course_id}
    )

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(asgn, k, v)

    db.commit()
    db.refresh(asgn)
    return AssignmentOut.model_validate(asgn)


@router.delete(
    "/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete assignment",
)
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    asgn = db.get(AssignmentModel, assignment_id)
    if not asgn:
        raise NotFoundError(f"Assignment {assignment_id} not found")

    can_access(
        user=current_user, action="edit_course", resource={"course_id": asgn.course_id}
    )

    db.delete(asgn)
    db.commit()
    return None


# ── Deadline Collision Warning (Phase 3) ────────────────────────────────────
from datetime import timedelta
from app.schemas.intervention import (
    DeadlineCollisionPreviewRequest,
    DeadlineCollisionPreviewResponse,
)
from app.models.risk import RiskConfigModel

@router.post(
    "/collision-preview",
    response_model=DeadlineCollisionPreviewResponse,
    summary="Preview deadline collisions and suggest lightest nearby dates",
)
def preview_deadline_collision(
    payload: DeadlineCollisionPreviewRequest,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    course = db.get(CourseModel, payload.course_id)
    if not course:
        raise NotFoundError(f"Course {payload.course_id} not found")

    peer_courses = db.scalars(
        select(CourseModel.id).where(
            CourseModel.department_id == course.department_id,
            CourseModel.semester_id == course.semester_id,
        )
    ).all()
    if not peer_courses:
        peer_courses = [course.id]

    cfg = db.scalar(select(RiskConfigModel).order_by(RiskConfigModel.id.desc()).limit(1))
    threshold = (
        int(cfg.collision_warning_threshold)
        if cfg and hasattr(cfg, "collision_warning_threshold") and cfg.collision_warning_threshold
        else 3
    )

    prop_date = payload.proposed_due_at.date() if hasattr(payload.proposed_due_at, "date") else payload.proposed_due_at
    window_start = prop_date - timedelta(days=3)
    window_end = prop_date + timedelta(days=3)

    query = select(AssignmentModel).where(AssignmentModel.course_id.in_(peer_courses))
    if payload.assignment_id:
        query = query.where(AssignmentModel.id != payload.assignment_id)

    all_asgns = db.scalars(query).all()

    daily_counts = {}
    curr_d = window_start
    while curr_d <= window_end:
        daily_counts[curr_d.isoformat()] = 0
        curr_d += timedelta(days=1)

    window_count = 0
    for a in all_asgns:
        if a.due_at:
            a_date = a.due_at.date() if hasattr(a.due_at, "date") else a.due_at
            if a_date.isoformat() in daily_counts:
                daily_counts[a_date.isoformat()] += 1
            if window_start <= a_date <= window_end:
                window_count += 1

    search_start = prop_date - timedelta(days=5)
    search_end = prop_date + timedelta(days=5)
    surrounding_counts = {}
    curr_s = search_start
    while curr_s <= search_end:
        surrounding_counts[curr_s] = 0
        curr_s += timedelta(days=1)

    for a in all_asgns:
        if a.due_at:
            a_date = a.due_at.date() if hasattr(a.due_at, "date") else a.due_at
            if a_date in surrounding_counts:
                surrounding_counts[a_date] += 1

    lightest_date = min(
        surrounding_counts.keys(),
        key=lambda d: (surrounding_counts[d], abs((d - prop_date).days)),
    )

    has_warning = window_count >= threshold
    if has_warning:
        msg = (
            f"Caution: {window_count} deadlines already scheduled within 7 days of this proposed date "
            f"(threshold: {threshold}). Consider {lightest_date.isoformat()} as a lighter date with "
            f"{surrounding_counts[lightest_date]} deadline(s)."
        )
    else:
        msg = "No deadline clustering detected in this 7-day window."

    return DeadlineCollisionPreviewResponse(
        has_collision_warning=has_warning,
        warning_threshold=threshold,
        window_count=window_count,
        daily_counts=daily_counts,
        lightest_nearby_date=lightest_date,
        message=msg,
    )

