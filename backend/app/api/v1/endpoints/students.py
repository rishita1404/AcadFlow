from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.core.deps import can_access, get_db
from app.core.errors import ConflictError, NotFoundError
from app.core.security import get_password_hash
from app.models import EnrolmentModel, StudentModel, UserModel
from app.schemas.common import PaginatedResponse
from app.schemas.user import StudentCreate, StudentOut
from app.services.attendance_stats import (
    get_student_course_attendance,
    get_student_overall_attendance,
)

router = APIRouter()


@router.get("", response_model=PaginatedResponse[StudentOut])
def list_students(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
    batch: Optional[str] = Query(None, description="Filter by student batch"),
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    course_id: Optional[int] = Query(None, description="Filter by enrolled course ID"),
    sort: Optional[str] = Query(
        None, description="Sort field (e.g. roll_no or -roll_no)"
    ),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    can_access(user=current_user, action="list", resource="students")

    query = select(StudentModel, UserModel).join(
        UserModel, StudentModel.user_id == UserModel.id
    )

    if course_id is not None:
        query = query.join(
            EnrolmentModel, StudentModel.user_id == EnrolmentModel.student_id
        ).where(EnrolmentModel.course_id == course_id)
    if batch:
        query = query.where(StudentModel.batch == batch)
    if department_id is not None:
        query = query.where(UserModel.department_id == department_id)

    # Count
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    # Sorting
    if sort:
        descending = sort.startswith("-")
        field_name = sort[1:] if descending else sort
        col = getattr(StudentModel, field_name, None) or getattr(
            UserModel, field_name, None
        )
        if col is not None:
            query = query.order_by(col.desc() if descending else col.asc())
    else:
        query = query.order_by(StudentModel.user_id.asc())

    # Pagination
    offset = (page - 1) * page_size
    results = db.execute(query.offset(offset).limit(page_size)).all()

    items = []
    for student, user in results:
        if course_id is not None:
            stats = get_student_course_attendance(db, student.user_id, course_id)
            att_pct = stats.get("attendance_pct")
            buf = stats.get("buffer")
            status_msg = stats.get("status_message")
            insufficient = stats.get("insufficient_data")
        else:
            stats = get_student_overall_attendance(db, student.user_id)
            att_pct = stats.get("overall_attendance_pct")
            buf = None
            status_msg = "Not enough data yet" if stats.get("insufficient_data") else ""
            insufficient = stats.get("insufficient_data")

        items.append(
            StudentOut(
                user_id=student.user_id,
                name=user.name,
                email=user.email,
                role=user.role,
                roll_no=student.roll_no,
                batch=student.batch,
                department_id=user.department_id,
                attendance_pct=att_pct,
                buffer=buf,
                status_message=status_msg,
                insufficient_data=insufficient,
            )
        )

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    can_access(user=current_user, action="create", resource="students")

    # Check unique email
    existing_user = db.scalar(select(UserModel).where(UserModel.email == payload.email))
    if existing_user:
        raise ConflictError(f"User with email '{payload.email}' already exists")

    # Check unique roll_no
    existing_student = db.scalar(
        select(StudentModel).where(StudentModel.roll_no == payload.roll_no)
    )
    if existing_student:
        raise ConflictError(
            f"Student with roll number '{payload.roll_no}' already exists"
        )

    # Create user record
    user = UserModel(
        name=payload.name,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role="student",
        department_id=payload.department_id,
    )
    db.add(user)
    db.flush()  # Populates user.id

    # Create student record
    student = StudentModel(
        user_id=user.id,
        roll_no=payload.roll_no,
        batch=payload.batch,
    )
    db.add(student)
    db.commit()

    return StudentOut(
        user_id=student.user_id,
        name=user.name,
        email=user.email,
        role=user.role,
        roll_no=student.roll_no,
        batch=student.batch,
        department_id=user.department_id,
    )


@router.get("/{user_id}", response_model=StudentOut)
def get_student(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    can_access(user=current_user, action="read", resource="students")

    result = db.execute(
        select(StudentModel, UserModel)
        .join(UserModel, StudentModel.user_id == UserModel.id)
        .where(StudentModel.user_id == user_id)
    ).first()

    if not result:
        raise NotFoundError(f"Student with user_id {user_id} not found")

    student, user = result
    return StudentOut(
        user_id=student.user_id,
        name=user.name,
        email=user.email,
        role=user.role,
        roll_no=student.roll_no,
        batch=student.batch,
        department_id=user.department_id,
    )
