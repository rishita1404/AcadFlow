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
