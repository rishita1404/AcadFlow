"""Admin-only user creation endpoint.

POST /admin/users — creates a user of any role (student, faculty, coordinator, admin).
Requires a valid admin JWT. This is the only public endpoint that can create non-student roles.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.deps import get_db
from app.core.security import get_password_hash
from app.models import DepartmentModel, StudentModel, UserModel

router = APIRouter()

VALID_ROLES = {"student", "faculty", "coordinator", "admin"}


class AdminUserCreateRequest(BaseModel):
    name: str
    email: str
    role: str  # any role allowed here
    password: Optional[str] = "AcadFlow@123"
    department_id: Optional[int] = None
    roll_no: Optional[str] = None
    batch: Optional[str] = "2023-2027"


class AdminUserCreateResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department_id: Optional[int] = None


@router.post(
    "/users",
    response_model=AdminUserCreateResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Admin"],
    summary="Create a user of any role (admin only)",
)
def admin_create_user(
    payload: AdminUserCreateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("admin")),
):
    """Create a user with any role. Only admins may call this endpoint."""
    if payload.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role '{payload.role}'. Must be one of: {sorted(VALID_ROLES)}",
        )

    existing = db.scalar(select(UserModel).where(UserModel.email == payload.email.lower()))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email '{payload.email}' already exists.",
        )

    roll_no = payload.roll_no
    if payload.role == "student":
        if not roll_no:
            max_id = db.scalar(select(func.max(UserModel.id))) or 0
            roll_no = f"24CS{max_id + 1:03d}"
        existing_roll = db.scalar(select(StudentModel).where(StudentModel.roll_no == roll_no))
        if existing_roll:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Student with roll number '{roll_no}' already exists.",
            )

    user = UserModel(
        name=payload.name.strip(),
        email=payload.email.lower(),
        password_hash=get_password_hash(payload.password or "AcadFlow@123"),
        role=payload.role,
        department_id=payload.department_id,
    )
    db.add(user)
    db.flush()

    if payload.role == "student":
        student_profile = StudentModel(
            user_id=user.id,
            roll_no=roll_no,
            batch=payload.batch or "2023-2027",
        )
        db.add(student_profile)

    db.commit()
    db.refresh(user)

    return AdminUserCreateResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        department_id=user.department_id,
    )
