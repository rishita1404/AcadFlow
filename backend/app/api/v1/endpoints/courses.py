from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import can_access, get_db
from app.core.errors import ConflictError, NotFoundError
from app.models import CourseModel, EnrolmentModel, StudentModel
from app.schemas.common import PaginatedResponse
from app.schemas.course import CourseCreate, CourseOut, CourseUpdate
from app.schemas.enrollment import EnrolmentBatchCreate, EnrolmentOut

router = APIRouter()


@router.get("", response_model=PaginatedResponse[CourseOut])
def list_courses(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    code: Optional[str] = Query(None, description="Partial match filter by code"),
    sort: Optional[str] = Query(None, description="Sort field (prefix with - for desc, e.g. -total_classes)"),
    db: Session = Depends(get_db),
):
    can_access(user=None, action="list", resource="courses")

    query = select(CourseModel)

    if department_id is not None:
        query = query.where(CourseModel.department_id == department_id)
    if code is not None:
        query = query.where(CourseModel.code.ilike(f"%{code}%"))

    # Total count before pagination
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    # Sorting
    if sort:
        descending = sort.startswith("-")
        field_name = sort[1:] if descending else sort
        col = getattr(CourseModel, field_name, None)
        if col is not None:
            query = query.order_by(col.desc() if descending else col.asc())
    else:
        query = query.order_by(CourseModel.id.asc())

    # Pagination
    offset = (page - 1) * page_size
    items = db.scalars(query.offset(offset).limit(page_size)).all()

    return PaginatedResponse(
        items=[CourseOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
):
    can_access(user=None, action="create", resource="courses")

    # Check unique code
    existing = db.scalar(select(CourseModel).where(CourseModel.code == payload.code))
    if existing:
        raise ConflictError(f"Course with code '{payload.code}' already exists")

    course = CourseModel(**payload.model_dump())
    db.add(course)
    db.commit()
    db.refresh(course)
    return CourseOut.model_validate(course)


@router.get("/{course_id}", response_model=CourseOut)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
):
    can_access(user=None, action="read", resource="courses")

    course = db.get(CourseModel, course_id)
    if not course:
        raise NotFoundError(f"Course with id {course_id} not found")
    return CourseOut.model_validate(course)


@router.patch("/{course_id}", response_model=CourseOut)
def update_course(
    course_id: int,
    payload: CourseUpdate,
    db: Session = Depends(get_db),
):
    can_access(user=None, action="update", resource="courses")

    course = db.get(CourseModel, course_id)
    if not course:
        raise NotFoundError(f"Course with id {course_id} not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"] != course.code:
        existing = db.scalar(select(CourseModel).where(CourseModel.code == update_data["code"]))
        if existing:
            raise ConflictError(f"Course with code '{update_data['code']}' already exists")

    for key, value in update_data.items():
        setattr(course, key, value)

    db.commit()
    db.refresh(course)
    return CourseOut.model_validate(course)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
):
    can_access(user=None, action="delete", resource="courses")

    course = db.get(CourseModel, course_id)
    if not course:
        raise NotFoundError(f"Course with id {course_id} not found")

    db.delete(course)
    db.commit()
    return None


@router.post("/{course_id}/enrolments", response_model=List[EnrolmentOut], status_code=status.HTTP_201_CREATED)
def enrol_students(
    course_id: int,
    payload: EnrolmentBatchCreate,
    db: Session = Depends(get_db),
):
    can_access(user=None, action="enrol", resource="courses")

    course = db.get(CourseModel, course_id)
    if not course:
        raise NotFoundError(f"Course with id {course_id} not found")

    student_ids = [item.student_id for item in payload.students]

    # Verify all students exist
    existing_students = db.scalars(
        select(StudentModel.user_id).where(StudentModel.user_id.in_(student_ids))
    ).all()
    missing_students = set(student_ids) - set(existing_students)
    if missing_students:
        raise NotFoundError(f"Students not found: {sorted(list(missing_students))}")

    # Check for duplicate enrolments
    existing_enrolments = db.scalars(
        select(EnrolmentModel.student_id).where(
            EnrolmentModel.course_id == course_id,
            EnrolmentModel.student_id.in_(student_ids),
        )
    ).all()
    if existing_enrolments:
        raise ConflictError(
            f"Students already enrolled in course {course_id}: {sorted(list(existing_enrolments))}"
        )

    # Insert enrolments
    created_records = []
    today = date.today()
    for item in payload.students:
        enrolment = EnrolmentModel(
            student_id=item.student_id,
            course_id=course_id,
            enrolled_on=item.enrolled_on or today,
        )
        db.add(enrolment)
        created_records.append(enrolment)

    db.commit()
    return [EnrolmentOut.model_validate(rec) for rec in created_records]
