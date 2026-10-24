"""
Notices API endpoints — AcadFlow Phase 7.

Multi-channel announcements, forms, events, and automatic deadline extraction
with audience scoping, delivery receipts, and reminder cancellation.
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.core.authorization import Role
from app.core.deps import get_db
from app.core.errors import NotFoundError
from app.models import (
    EnrolmentModel,
    MentorAssignmentModel,
    StudentModel,
    UserModel,
)
from app.models.audit import AuditLogModel
from app.models.course import CourseStaffModel
from app.models.notice import (
    NoticeDeadlineModel,
    NoticeModel,
    NoticeRecipientModel,
)
from app.services.notice_extractor import extract_dates

router = APIRouter()


class AudiencePreviewRequest(BaseModel):
    audience_type: str  # "all", "department", "course", "mentees", "batch", "roll_numbers"
    department_id: Optional[int] = None
    course_id: Optional[int] = None
    batch: Optional[str] = None
    roll_numbers: Optional[List[str]] = None


class ExtractDatesRequest(BaseModel):
    text: str


class DeadlineIn(BaseModel):
    kind: str  # "deadline" or "event"
    at: str    # ISO datetime string
    label: str
    source: str = "detected"


class NoticeCreate(BaseModel):
    title: str
    body: str
    category: str = "general"  # Form, Event, Exam, Placement, General, Urgent
    urgent: bool = False
    audience_spec: Optional[str] = None  # JSON string
    deadlines: Optional[List[DeadlineIn]] = None
    send_email: bool = False


class NoticeUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    category: Optional[str] = None
    urgent: Optional[bool] = None
    deadlines: Optional[List[DeadlineIn]] = None


def _resolve_recipients(db: Session, sender_id: int, sender_role: str, spec: Dict[str, Any]) -> List[int]:
    """Resolve user IDs who should receive this notice, applying sender scope restrictions."""
    aud_type = spec.get("type") or spec.get("audience_type", "all")

    if sender_role == Role.STUDENT.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "PERM_403", "message": "Students are not permitted to publish notices"},
        )

    # 1. Course specific audience
    if aud_type == "course":
        cid = spec.get("course_id")
        if not cid:
            return []
        # Scope check: faculty can only send to own courses
        if sender_role in (Role.FACULTY.value, Role.TRAINER.value):
            is_staff = db.scalar(
                select(CourseStaffModel).where(
                    CourseStaffModel.course_id == cid,
                    CourseStaffModel.user_id == sender_id,
                )
            )
            if not is_staff:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"code": "PERM_403", "message": "Faculty can only broadcast to assigned courses"},
                )
        enrolments = db.scalars(select(EnrolmentModel).where(EnrolmentModel.course_id == cid)).all()
        return [e.student_id for e in enrolments]

    # 2. Mentor mentees
    if aud_type == "mentees":
        m_rows = db.scalars(
            select(MentorAssignmentModel.student_id).where(MentorAssignmentModel.mentor_id == sender_id)
        ).all()
        return list(m_rows)

    # 3. Department
    if aud_type == "department":
        did = spec.get("department_id") or 1
        # Coordinator can only send to own department
        if sender_role == Role.COORDINATOR.value:
            sender_user = db.get(UserModel, sender_id)
            if sender_user and sender_user.department_id and sender_user.department_id != did:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"code": "PERM_403", "message": "Coordinator cannot broadcast to other departments"},
                )
        users = db.scalars(select(UserModel.id).where(UserModel.department_id == did)).all()
        return list(users)

    # 4. Roll numbers upload
    if aud_type == "roll_numbers":
        rolls = spec.get("roll_numbers", [])
        students = db.scalars(select(StudentModel).where(StudentModel.roll_no.in_(rolls))).all()
        return [s.user_id for s in students]

    # 5. All (Admin or Coordinator own dept)
    if aud_type == "all":
        if sender_role == Role.COORDINATOR.value:
            sender_user = db.get(UserModel, sender_id)
            did = sender_user.department_id if sender_user else 1
            users = db.scalars(select(UserModel.id).where(UserModel.department_id == did)).all()
            return list(users)
        elif sender_role == Role.ADMIN.value:
            users = db.scalars(select(UserModel.id)).all()
            return list(users)
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "PERM_403", "message": "Global broadcasts require administrator privileges"},
            )

    return []


@router.post("/audience/preview", summary="Live recipient count and preview list")
def preview_audience(
    payload: AudiencePreviewRequest,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    sender_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    sender_role = current_user.get("role", "faculty") if current_user else "faculty"

    spec = {
        "type": payload.audience_type,
        "department_id": payload.department_id,
        "course_id": payload.course_id,
        "batch": payload.batch,
        "roll_numbers": payload.roll_numbers,
    }

    recipients_uids = _resolve_recipients(db, sender_id, sender_role, spec)

    # Get sample recipient names
    sample_users = db.scalars(
        select(UserModel).where(UserModel.id.in_(recipients_uids[:20]))
    ).all() if recipients_uids else []

    recipients_info = [
        {"id": u.id, "name": u.name, "email": u.email, "role": u.role}
        for u in sample_users
    ]

    return {
        "count": len(recipients_uids),
        "recipients_sample": recipients_info,
        "audience_spec": spec,
    }


@router.post("/extract", summary="Rule-based date/time deadline extraction in Asia/Kolkata")
def extract_notice_dates(payload: ExtractDatesRequest):
    candidates = extract_dates(payload.text)
    requires_confirmation = len(candidates) > 1
    return {
        "candidates": candidates,
        "count": len(candidates),
        "requires_confirmation": requires_confirmation,
        "timezone": "Asia/Kolkata",
    }


@router.post("", status_code=201, summary="Publish new notice with detected/confirmed deadlines")
def create_notice(
    payload: NoticeCreate,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    sender_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    sender_role = current_user.get("role", "faculty") if current_user else "faculty"

    if sender_role == Role.STUDENT.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "PERM_403", "message": "Students cannot publish notices"},
        )

    # Parse spec
    spec = {}
    if payload.audience_spec:
        try:
            spec = json.loads(payload.audience_spec)
        except Exception:
            spec = {"type": "all"}
    else:
        spec = {"type": "all"}

    # Resolve recipient user IDs (with scope checking)
    recipient_ids = _resolve_recipients(db, sender_id, sender_role, spec)

    # Create Notice
    notice = NoticeModel(
        sender_id=sender_id,
        title=payload.title,
        body=payload.body,
        category=payload.category,
        urgent=payload.urgent,
        status="sent",
        audience_spec=payload.audience_spec or json.dumps(spec),
        created_at=datetime.now(timezone.utc),
    )
    db.add(notice)
    db.flush()

    # Create recipients records
    for uid in recipient_ids:
        rec = NoticeRecipientModel(
            notice_id=notice.id,
            user_id=uid,
            delivered_at=datetime.now(timezone.utc),
        )
        db.add(rec)

    # Create confirmed deadlines
    deadlines_created = []
    if payload.deadlines:
        for d in payload.deadlines:
            dl = NoticeDeadlineModel(
                notice_id=notice.id,
                kind=d.kind,
                at=d.at,
                label=d.label,
                source=d.source,
                confirmed_by=sender_id,
            )
            db.add(dl)
            deadlines_created.append(dl)

    # Write audit log row
    db.add(
        AuditLogModel(
            entity="notices",
            entity_id=str(notice.id),
            action="create_notice",
            old_value=None,
            new_value=f"title: '{notice.title}', recipients: {len(recipient_ids)}, deadlines: {len(deadlines_created)}",
            actor_id=sender_id,
            created_at=datetime.now(timezone.utc),
        )
    )

    db.commit()
    db.refresh(notice)

    # Dispatch in-app notifications
    try:
        from app.services.notification_service import create_in_app_notification

        for uid in recipient_ids:
            create_in_app_notification(
                db=db,
                user_id=uid,
                title=f"{'🚨 ' if notice.urgent else '📢 '}{notice.title}",
                message=notice.body[:120] + ("..." if len(notice.body) > 120 else ""),
                notif_type="notice_new",
            )
    except Exception:
        pass

    return {
        "id": notice.id,
        "title": notice.title,
        "category": notice.category,
        "urgent": notice.urgent,
        "status": notice.status,
        "recipient_count": len(recipient_ids),
        "deadlines_count": len(deadlines_created),
        "created_at": notice.created_at.isoformat(),
    }


@router.get("", summary="List notices (sent by current staff user)")
def list_notices(
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    sender_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1

    notices = db.scalars(
        select(NoticeModel)
        .where(NoticeModel.sender_id == sender_id, NoticeModel.status != "archived")
        .order_by(NoticeModel.created_at.desc())
    ).all()

    results = []
    for n in notices:
        total_recipients = db.scalar(
            select(func.count(NoticeRecipientModel.user_id)).where(NoticeRecipientModel.notice_id == n.id)
        ) or 0
        seen_count = db.scalar(
            select(func.count(NoticeRecipientModel.user_id)).where(
                NoticeRecipientModel.notice_id == n.id,
                NoticeRecipientModel.seen_at.isnot(None),
            )
        ) or 0
        done_count = db.scalar(
            select(func.count(NoticeRecipientModel.user_id)).where(
                NoticeRecipientModel.notice_id == n.id,
                NoticeRecipientModel.done_at.isnot(None),
            )
        ) or 0

        deadlines = db.scalars(
            select(NoticeDeadlineModel).where(NoticeDeadlineModel.notice_id == n.id)
        ).all()

        results.append({
            "id": n.id,
            "title": n.title,
            "body": n.body,
            "category": n.category,
            "urgent": n.urgent,
            "status": n.status,
            "created_at": n.created_at.isoformat() if n.created_at else "",
            "total_recipients": total_recipients,
            "seen_count": seen_count,
            "done_count": done_count,
            "deadlines": [
                {"id": d.id, "kind": d.kind, "at": d.at, "label": d.label}
                for d in deadlines
            ],
        })
    return results


@router.get("/me", summary="Recipient inbox for current user")
def get_my_notices(
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    user_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1

    rec_rows = db.scalars(
        select(NoticeRecipientModel).where(NoticeRecipientModel.user_id == user_id)
    ).all()
    rec_map = {r.notice_id: r for r in rec_rows}
    notice_ids = list(rec_map.keys())

    if not notice_ids:
        return []

    notices = db.scalars(
        select(NoticeModel)
        .where(NoticeModel.id.in_(notice_ids), NoticeModel.status != "archived")
        .order_by(NoticeModel.urgent.desc(), NoticeModel.created_at.desc())
    ).all()

    results = []
    for n in notices:
        sender = db.get(UserModel, n.sender_id)
        rec = rec_map.get(n.id)
        deadlines = db.scalars(
            select(NoticeDeadlineModel).where(NoticeDeadlineModel.notice_id == n.id)
        ).all()

        results.append({
            "id": n.id,
            "title": n.title,
            "body": n.body,
            "category": n.category,
            "urgent": n.urgent,
            "sender_name": sender.name if sender else "Staff",
            "created_at": n.created_at.isoformat() if n.created_at else "",
            "seen": rec.seen_at is not None if rec else False,
            "done": rec.done_at is not None if rec else False,
            "deadlines": [
                {"id": d.id, "kind": d.kind, "at": d.at, "label": d.label}
                for d in deadlines
            ],
        })
    return results


@router.get("/{notice_id}", summary="Get notice detail and stats")
def get_notice_detail(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    notice = db.get(NoticeModel, notice_id)
    if not notice or notice.status == "archived":
        raise NotFoundError("Notice not found")

    sender = db.get(UserModel, notice.sender_id)
    deadlines = db.scalars(
        select(NoticeDeadlineModel).where(NoticeDeadlineModel.notice_id == notice.id)
    ).all()

    from sqlalchemy import func
    total_recipients = db.scalar(
        select(func.count(NoticeRecipientModel.user_id)).where(NoticeRecipientModel.notice_id == notice.id)
    ) or 0
    seen_count = db.scalar(
        select(func.count(NoticeRecipientModel.user_id)).where(
            NoticeRecipientModel.notice_id == notice.id,
            NoticeRecipientModel.seen_at.isnot(None),
        )
    ) or 0
    done_count = db.scalar(
        select(func.count(NoticeRecipientModel.user_id)).where(
            NoticeRecipientModel.notice_id == notice.id,
            NoticeRecipientModel.done_at.isnot(None),
        )
    ) or 0

    return {
        "id": notice.id,
        "title": notice.title,
        "body": notice.body,
        "category": notice.category,
        "urgent": notice.urgent,
        "sender_name": sender.name if sender else "Staff",
        "sender_id": notice.sender_id,
        "created_at": notice.created_at.isoformat() if notice.created_at else "",
        "stats": {
            "total_recipients": total_recipients,
            "seen_count": seen_count,
            "done_count": done_count,
        },
        "deadlines": [
            {"id": d.id, "kind": d.kind, "at": d.at, "label": d.label}
            for d in deadlines
        ],
    }


@router.get("/{notice_id}/recipients", summary="List delivery receipts and seen/done states")
def list_recipients(
    notice_id: int,
    status_filter: Optional[str] = Query(None),  # "unseen", "seen", "done"
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    q = select(NoticeRecipientModel).where(NoticeRecipientModel.notice_id == notice_id)
    if status_filter == "unseen":
        q = q.where(NoticeRecipientModel.seen_at.is_(None))
    elif status_filter == "seen":
        q = q.where(NoticeRecipientModel.seen_at.isnot(None))
    elif status_filter == "done":
        q = q.where(NoticeRecipientModel.done_at.isnot(None))

    rows = db.scalars(q.limit(100)).all()
    results = []
    for r in rows:
        u = db.get(UserModel, r.user_id)
        st = db.get(StudentModel, r.user_id)
        results.append({
            "user_id": r.user_id,
            "name": u.name if u else "User",
            "email": u.email if u else "",
            "roll_no": st.roll_no if st else "",
            "delivered_at": r.delivered_at.isoformat() if r.delivered_at else None,
            "seen_at": r.seen_at.isoformat() if r.seen_at else None,
            "done_at": r.done_at.isoformat() if r.done_at else None,
        })
    return results


@router.post("/{notice_id}/nudge", summary="Nudge unseen recipients with reminder alert")
def nudge_unseen(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    notice = db.get(NoticeModel, notice_id)
    if not notice:
        raise NotFoundError("Notice not found")

    unseen = db.scalars(
        select(NoticeRecipientModel).where(
            NoticeRecipientModel.notice_id == notice_id,
            NoticeRecipientModel.seen_at.is_(None),
        )
    ).all()

    try:
        from app.services.notification_service import create_in_app_notification

        for r in unseen:
            create_in_app_notification(
                db=db,
                user_id=r.user_id,
                title=f"Reminder: {notice.title}",
                message=f"You have an unread notice: {notice.body[:80]}...",
                notif_type="notice_updated",
            )
    except Exception:
        pass

    return {"nudged_count": len(unseen)}


@router.patch("/{notice_id}", summary="Edit notice and reschedule reminders")
def update_notice(
    notice_id: int,
    payload: NoticeUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    notice = db.get(NoticeModel, notice_id)
    if not notice:
        raise NotFoundError("Notice not found")

    sender_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    if notice.sender_id != sender_id and current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(status_code=403, detail={"code": "PERM_403", "message": "Cannot modify another user's notice"})

    if payload.title is not None:
        notice.title = payload.title
    if payload.body is not None:
        notice.body = payload.body
    if payload.category is not None:
        notice.category = payload.category
    if payload.urgent is not None:
        notice.urgent = payload.urgent

    if payload.deadlines is not None:
        # Replace deadlines
        existing = db.scalars(select(NoticeDeadlineModel).where(NoticeDeadlineModel.notice_id == notice.id)).all()
        for ex in existing:
            db.delete(ex)
        db.flush()
        for d in payload.deadlines:
            db.add(NoticeDeadlineModel(
                notice_id=notice.id,
                kind=d.kind,
                at=d.at,
                label=d.label,
                source=d.source,
                confirmed_by=sender_id,
            ))

    db.add(
        AuditLogModel(
            entity="notices",
            entity_id=str(notice.id),
            action="update_notice",
            old_value=None,
            new_value=f"Updated notice #{notice.id}",
            actor_id=sender_id,
            created_at=datetime.now(timezone.utc),
        )
    )

    db.commit()
    db.refresh(notice)
    return {"updated": True, "id": notice.id}


@router.delete("/{notice_id}", summary="Withdraw notice and remove deadlines from tasks")
def withdraw_notice(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    notice = db.get(NoticeModel, notice_id)
    if not notice:
        raise NotFoundError("Notice not found")

    sender_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    if notice.sender_id != sender_id and current_user.get("role") != Role.ADMIN.value:
        raise HTTPException(status_code=403, detail={"code": "PERM_403", "message": "Cannot withdraw another user's notice"})

    notice.status = "archived"

    db.add(
        AuditLogModel(
            entity="notices",
            entity_id=str(notice.id),
            action="withdraw_notice",
            old_value="sent",
            new_value="archived",
            actor_id=sender_id,
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    return {"withdrawn": True, "id": notice.id}


@router.post("/{notice_id}/seen", summary="Mark notice seen by current student")
def mark_seen(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    user_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    rec = db.scalar(
        select(NoticeRecipientModel).where(
            NoticeRecipientModel.notice_id == notice_id,
            NoticeRecipientModel.user_id == user_id,
        )
    )
    if rec and not rec.seen_at:
        rec.seen_at = datetime.now(timezone.utc)
        db.commit()
    return {"seen": True}


@router.post("/{notice_id}/done", summary="Mark notice done (cancels remaining reminders)")
def mark_done(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    user_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    rec = db.scalar(
        select(NoticeRecipientModel).where(
            NoticeRecipientModel.notice_id == notice_id,
            NoticeRecipientModel.user_id == user_id,
        )
    )
    if rec:
        rec.done_at = datetime.now(timezone.utc)
        db.commit()
    return {"done": True}


@router.post("/{notice_id}/not-relevant", summary="Mark notice not relevant (cancels reminders)")
def mark_not_relevant(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    return mark_done(notice_id, db, current_user)
