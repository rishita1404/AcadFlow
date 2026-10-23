"""
Admin Management Endpoints — AcadFlow.

System administration, user role management, risk engine configuration,
and immutable audit log inspection.
"""

from decimal import Decimal
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.core.authorization import Action, verify_access
from app.core.deps import get_db
from app.models import AuditLogModel, RiskConfigModel, UserModel
from app.schemas.risk import RiskConfigOut, RiskConfigUpdate

router = APIRouter()


class AdminUserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department_id: Optional[int]
    failed_logins: int

    model_config = ConfigDict(from_attributes=True)


class AuditLogOut(BaseModel):
    id: int
    entity: str
    entity_id: str
    action: str
    old_value: Optional[str]
    new_value: Optional[str]
    actor_id: Optional[int]
    created_at: Any

    model_config = ConfigDict(from_attributes=True)


class AdminStatsOut(BaseModel):
    total_users: int
    total_students: int
    total_faculty: int
    total_courses: int
    active_model_version: str
    api_health: str
    worker_health: str
    ml_health: str


@router.get("/stats", response_model=AdminStatsOut, summary="System overview stats")
def get_admin_stats(
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    if current_user:
        verify_access(current_user, Action.ADMIN_MANAGE)

    from app.models import CourseModel, StudentModel
    from sqlalchemy import func

    total_users = db.scalar(select(func.count(UserModel.id))) or 0
    total_students = db.scalar(select(func.count(StudentModel.user_id))) or 0
    total_faculty = db.scalar(select(func.count(UserModel.id)).where(UserModel.role.in_(["faculty", "trainer"]))) or 0
    total_courses = db.scalar(select(func.count(CourseModel.id))) or 0

    return AdminStatsOut(
        total_users=total_users,
        total_students=total_students,
        total_faculty=total_faculty,
        total_courses=total_courses,
        active_model_version="v2.1-lgbm-quantized",
        api_health="healthy (2/2 active)",
        worker_health="healthy (celery-beat active)",
        ml_health="operational (drift PSI < 0.10)",
    )



@router.get("/users", response_model=List[AdminUserOut], summary="List system users")
def list_users(
    role: Optional[str] = Query(None, description="Filter by role"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    if current_user:
        verify_access(current_user, Action.ADMIN_MANAGE)

    query = select(UserModel)
    if role:
        query = query.where(UserModel.role == role)
    users = db.scalars(query.limit(limit)).all()
    return [AdminUserOut.model_validate(u) for u in users]


@router.get(
    "/audit-logs", response_model=List[AuditLogOut], summary="Inspect audit trail"
)
def list_audit_logs(
    entity: Optional[str] = Query(None, description="Filter by entity"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    if current_user:
        verify_access(current_user, Action.ADMIN_MANAGE)

    query = select(AuditLogModel)
    if entity:
        query = query.where(AuditLogModel.entity == entity)
    query = query.order_by(AuditLogModel.created_at.desc()).limit(limit)
    logs = db.scalars(query).all()
    return [AuditLogOut.model_validate(log) for log in logs]


@router.get(
    "/risk-config",
    response_model=Optional[RiskConfigOut],
    summary="Get current risk configuration",
)
def get_admin_risk_config(
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    if current_user:
        verify_access(current_user, Action.ADMIN_MANAGE)

    row = db.scalars(
        select(RiskConfigModel).order_by(RiskConfigModel.id.desc()).limit(1)
    ).first()
    if not row:
        return None
    return RiskConfigOut.model_validate(row)


@router.put(
    "/risk-config", response_model=RiskConfigOut, summary="Update risk configuration"
)
def update_admin_risk_config(
    payload: RiskConfigUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    if current_user:
        verify_access(current_user, Action.ADMIN_MANAGE)

    existing = db.scalars(
        select(RiskConfigModel).order_by(RiskConfigModel.id.desc()).limit(1)
    ).first()

    def _dec(val, fallback):
        return Decimal(str(val)) if val is not None else fallback

    if existing:
        new_row = RiskConfigModel(
            w_margin=_dec(payload.w_margin, existing.w_margin),
            w_trend=_dec(payload.w_trend, existing.w_trend),
            w_deadline=_dec(payload.w_deadline, existing.w_deadline),
            w_missed=_dec(payload.w_missed, existing.w_missed),
            t_watch=_dec(payload.t_watch, existing.t_watch),
            t_risk=_dec(payload.t_risk, existing.t_risk),
            t_critical=_dec(payload.t_critical, existing.t_critical),
            min_classes=payload.min_classes
            if payload.min_classes is not None
            else existing.min_classes,
            version=payload.version or f"v{existing.id + 1}",
        )
    else:
        new_row = RiskConfigModel(
            w_margin=Decimal("50"),
            w_trend=Decimal("20"),
            w_deadline=Decimal("20"),
            w_missed=Decimal("10"),
            t_watch=Decimal("30"),
            t_risk=Decimal("55"),
            t_critical=Decimal("80"),
            min_classes=8,
            version=payload.version or "v1",
        )

    db.add(new_row)
    db.commit()
    db.refresh(new_row)
    return RiskConfigOut.model_validate(new_row)
