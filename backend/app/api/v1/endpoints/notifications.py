"""
Notification API endpoints — AcadFlow

Provides real DB-backed attendance warnings, risk alerts, and deadline reminders.

Endpoints:
  GET    /notifications          — list user's notifications (paginated)
  GET    /notifications/unread-count — count of unread notifications
  POST   /notifications/{id}/read   — mark one notification as read
  POST   /notifications/read-all    — mark all as read
  DELETE /notifications/{id}        — delete a notification
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.deps import get_db
from app.core.errors import NotFoundError
from app.models import NotificationModel

router = APIRouter()


# ──────────────────────────────────────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────────────────────────────────────


class NotificationOut(BaseModel):
    id: int
    recipient_id: int
    title: str
    message: str
    kind: str
    course_id: Optional[int] = None
    assignment_id: Optional[int] = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UnreadCountOut(BaseModel):
    unread_count: int


# ──────────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────────


@router.get(
    "",
    response_model=List[NotificationOut],
    summary="List notifications for the current user",
)
def list_notifications(
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    unread_only: bool = Query(False, description="Return only unread notifications"),
    kind: Optional[str] = Query(None, description="Filter by kind: warning|reminder|alert|info|critical"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the current user's notifications, newest first.
    Supports filtering by read status and notification kind.
    """
    user_id = int(current_user.get("sub", 0))

    query = select(NotificationModel).where(
        NotificationModel.recipient_id == user_id
    )
    if unread_only:
        query = query.where(NotificationModel.is_read == False)  # noqa: E712
    if kind:
        query = query.where(NotificationModel.kind == kind)

    query = (
        query.order_by(NotificationModel.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    records = db.scalars(query).all()
    return [NotificationOut.model_validate(r) for r in records]


@router.get(
    "/unread-count",
    response_model=UnreadCountOut,
    summary="Count of unread notifications",
)
def get_unread_count(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user.get("sub", 0))
    count = db.scalar(
        select(func.count()).where(
            NotificationModel.recipient_id == user_id,
            NotificationModel.is_read == False,  # noqa: E712
        )
    ) or 0
    return UnreadCountOut(unread_count=count)


@router.post(
    "/{notification_id}/read",
    status_code=status.HTTP_200_OK,
    summary="Mark a notification as read",
)
def mark_notification_read(
    notification_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user.get("sub", 0))
    notif = db.get(NotificationModel, notification_id)
    if not notif or notif.recipient_id != user_id:
        raise NotFoundError(f"Notification {notification_id} not found.")

    notif.is_read = True
    db.commit()
    return {"status": "success", "notification_id": notification_id, "is_read": True}


@router.post(
    "/read-all",
    status_code=status.HTTP_200_OK,
    summary="Mark all notifications as read",
)
def mark_all_read(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user.get("sub", 0))
    db.execute(
        update(NotificationModel)
        .where(
            NotificationModel.recipient_id == user_id,
            NotificationModel.is_read == False,  # noqa: E712
        )
        .values(is_read=True)
    )
    db.commit()
    return {"status": "success", "message": "All notifications marked as read."}


@router.delete(
    "/{notification_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a notification",
)
def delete_notification(
    notification_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user.get("sub", 0))
    notif = db.get(NotificationModel, notification_id)
    if not notif or notif.recipient_id != user_id:
        raise NotFoundError(f"Notification {notification_id} not found.")

    db.delete(notif)
    db.commit()
    return None
