"""
Notices API endpoints — AcadFlow Phase 7 / Part A.

Multi-channel announcements, targeted audience builder, delivery receipts,
debounced deadline extraction with opt-in, unread tracking, and correction notices.
"""

import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.core.authorization import Action, Role, can_access, verify_access
from app.core.deps import get_db
from app.core.errors import NotFoundError
from app.models import (
    AssignmentModel,
    CourseModel,
    CourseStaffModel,
    DepartmentModel,
    EnrolmentModel,
    MentorAssignmentModel,
    RiskConfigModel,
    RiskSnapshotModel,
    StudentModel,
    SubmissionModel,
    UserModel,
)
from app.models.audit import AuditLogModel
from app.models.notice import (
    AudiencePresetModel,
    NoticeDeadlineModel,
    NoticeModel,
    NoticeRecipientModel,
)
from app.services.notice_extractor import extract_dates

router = APIRouter()


class AudiencePreviewRequest(BaseModel):
    recipient_type: Optional[str] = "students"
    preset: Optional[str] = None
    department_id: Optional[int] = None
    batch: Optional[str] = None
    programme: Optional[str] = None
    semester_id: Optional[int] = None
    section: Optional[str] = None
    course_id: Optional[int] = None
    my_mentees: Optional[bool] = False
    my_courses_only: Optional[bool] = False
    pending_assignment_id: Optional[int] = None
    attendance_band: Optional[str] = None
    duty: Optional[str] = None
    roll_numbers: Optional[List[str]] = None
    everyone: Optional[bool] = False
    audience_type: Optional[str] = None


class ExtractDatesRequest(BaseModel):
    text: str


class DeadlineIn(BaseModel):
    kind: str = "deadline"
    at: str
    label: str
    source: str = "detected"


class NoticeCreate(BaseModel):
    title: str
    body: str
    category: str = "other"
    priority: str = "normal"
    urgent: bool = False
    link: Optional[str] = None
    audience_spec: Optional[str] = None
    deadlines: Optional[List[DeadlineIn]] = None
    add_to_deadlines: bool = False
    send_email: bool = False


class NoticeCorrection(BaseModel):
    title: str
    body: str
    category: Optional[str] = "other"
    priority: Optional[str] = "important"
    urgent: bool = False
    link: Optional[str] = None


class PresetCreate(BaseModel):
    name: str
    spec: Dict[str, Any]


class NoticeUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    urgent: Optional[bool] = None
    link: Optional[str] = None
    deadlines: Optional[List[DeadlineIn]] = None

def _resolve_targeted_audience(
    db: Session,
    sender_id: int,
    sender_role: str,
    spec: Dict[str, Any],
) -> Tuple[Dict[int, str], List[Dict[str, str]], str]:
    if sender_role == Role.STUDENT.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "PERM_403", "message": "Students are not permitted to publish notices"},
        )

    sender_user = db.get(UserModel, sender_id)
    sender_dept_id = sender_user.department_id if sender_user else None

    staff_course_ids = set(
        db.scalars(
            select(CourseStaffModel.course_id).where(CourseStaffModel.user_id == sender_id)
        ).all()
    )
    mentee_student_ids = set(
        db.scalars(
            select(MentorAssignmentModel.student_id).where(MentorAssignmentModel.mentor_id == sender_id)
        ).all()
    )

    preset = spec.get("preset")
    if preset:
        if preset == "Whole department":
            if sender_role not in (Role.COORDINATOR.value, Role.ADMIN.value):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"code": "PERM_403", "message": "Only department coordinators and administrators can broadcast to the whole department"},
                )
            spec["recipient_type"] = spec.get("recipient_type", "both")
            spec["department_id"] = sender_dept_id
        elif preset == "My course sections":
            spec["recipient_type"] = "students"
            spec["my_courses_only"] = True
        elif preset == "My mentees":
            spec["recipient_type"] = "students"
            spec["my_mentees"] = True
        elif preset == "My course, needs support":
            spec["recipient_type"] = "students"
            spec["my_courses_only"] = True
            spec["attendance_band"] = "Needs support"

    aud_type = spec.get("type") or spec.get("audience_type")
    if aud_type == "all" or spec.get("everyone") is True:
        if sender_role not in (Role.COORDINATOR.value, Role.ADMIN.value):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "PERM_403", "message": "Global broadcasts require coordinator or administrator privileges"},
            )
        if sender_role == Role.COORDINATOR.value:
            spec["department_id"] = sender_dept_id
        spec["recipient_type"] = "both"
        spec["is_all"] = True
    elif aud_type == "course":
        spec["recipient_type"] = "students"
    elif aud_type == "mentees":
        spec["recipient_type"] = "students"
        spec["my_mentees"] = True
    elif aud_type == "department":
        did = spec.get("department_id") or sender_dept_id or 1
        if sender_role in (Role.COORDINATOR.value, Role.FACULTY.value, Role.TRAINER.value) and sender_dept_id and did != sender_dept_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "PERM_403", "message": "Cannot target outside your assigned department"},
            )
        if sender_role in (Role.FACULTY.value, Role.TRAINER.value):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "PERM_403", "message": "Faculty cannot broadcast to whole department"},
            )
        spec["department_id"] = did
        spec["recipient_type"] = spec.get("recipient_type", "both")

    target_dept_id = spec.get("department_id")
    if target_dept_id:
        target_dept_id = int(target_dept_id)
        if sender_role in (Role.FACULTY.value, Role.TRAINER.value, Role.COORDINATOR.value):
            if sender_dept_id and target_dept_id != sender_dept_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"code": "PERM_403", "message": "Cannot target outside your assigned department"},
                )
    elif sender_role in (Role.FACULTY.value, Role.TRAINER.value, Role.COORDINATOR.value):
        target_dept_id = sender_dept_id

    target_course_id = spec.get("course_id")
    if target_course_id:
        target_course_id = int(target_course_id)
        if sender_role in (Role.FACULTY.value, Role.TRAINER.value):
            if target_course_id not in staff_course_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"code": "PERM_403", "message": "Faculty can only target assigned courses"},
                )

    band = spec.get("attendance_band")
    if band:
        is_mentees = bool(spec.get("my_mentees"))
        is_own_course = bool(spec.get("my_courses_only") or (target_course_id and target_course_id in staff_course_ids))
        if sender_role in (Role.FACULTY.value, Role.TRAINER.value):
            if not (is_mentees or is_own_course):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"code": "PERM_403", "message": "Attendance band filtering is restricted to your own course sections or assigned mentees"},
                )

    rec_type = spec.get("recipient_type", "students")
    recipients: Dict[int, str] = {}
    excluded: List[Dict[str, str]] = []

    if rec_type in ("students", "both"):
        q = (
            select(StudentModel, UserModel)
            .join(UserModel, StudentModel.user_id == UserModel.id)
            .where(UserModel.role == Role.STUDENT.value)
        )

        if target_dept_id:
            q = q.where(UserModel.department_id == target_dept_id)

        batch_val = spec.get("batch") or spec.get("programme")
        if batch_val:
            q = q.where(StudentModel.batch == str(batch_val))

        sec_val = spec.get("section")
        if sec_val:
            q = q.where(StudentModel.section == str(sec_val))

        if target_course_id:
            q = q.where(
                StudentModel.user_id.in_(
                    select(EnrolmentModel.student_id).where(EnrolmentModel.course_id == target_course_id)
                )
            )

        if spec.get("my_courses_only") and staff_course_ids:
            q = q.where(
                StudentModel.user_id.in_(
                    select(EnrolmentModel.student_id).where(EnrolmentModel.course_id.in_(staff_course_ids))
                )
            )

        if spec.get("my_mentees"):
            q = q.where(StudentModel.user_id.in_(mentee_student_ids))

        if spec.get("semester_id"):
            sem_id = int(spec["semester_id"])
            q = q.where(
                StudentModel.user_id.in_(
                    select(EnrolmentModel.student_id)
                    .join(CourseModel, EnrolmentModel.course_id == CourseModel.id)
                    .where(CourseModel.semester_id == sem_id)
                )
            )

        if spec.get("pending_assignment_id"):
            asgn_id = int(spec["pending_assignment_id"])
            asgn = db.get(AssignmentModel, asgn_id)
            if asgn:
                enrolled_uids = select(EnrolmentModel.student_id).where(EnrolmentModel.course_id == asgn.course_id)
                submitted_uids = select(SubmissionModel.student_id).where(
                    SubmissionModel.assignment_id == asgn.id,
                    SubmissionModel.status.in_(["submitted", "graded"]),
                )
                q = q.where(StudentModel.user_id.in_(enrolled_uids), StudentModel.user_id.notin_(submitted_uids))

        if band:
            b_norm = band.lower().strip()
            if "need" in b_norm or "crit" in b_norm:
                target_bands = ["critical", "risk"]
            elif b_norm in ("watch", "safe", "risk", "critical"):
                target_bands = [b_norm]
            else:
                target_bands = ["critical"]

            latest_subq = (
                select(RiskSnapshotModel.student_id, func.max(RiskSnapshotModel.computed_at).label("max_time"))
                .group_by(RiskSnapshotModel.student_id)
                .subquery()
            )
            matching_student_ids = select(RiskSnapshotModel.student_id).join(
                latest_subq,
                (RiskSnapshotModel.student_id == latest_subq.c.student_id)
                & (RiskSnapshotModel.computed_at == latest_subq.c.max_time),
            ).where(func.lower(RiskSnapshotModel.computed_band).in_(target_bands))
            q = q.where(StudentModel.user_id.in_(matching_student_ids))

        student_rows = db.execute(q).all()
        course_obj = db.get(CourseModel, target_course_id) if target_course_id else None

        for st, u in student_rows:
            if spec.get("my_mentees") and u.id in mentee_student_ids:
                reason = "Assigned Mentee"
            elif course_obj:
                reason = f"Enrolled in {course_obj.code} ({course_obj.name})"
            elif sec_val:
                reason = f"Student in Section {sec_val}"
            elif batch_val:
                reason = f"Student in Batch {batch_val}"
            elif target_dept_id:
                reason = "Student in Department"
            else:
                reason = "Targeted Student Audience"
            recipients[u.id] = reason

    if rec_type in ("teachers", "both"):
        t_q = select(UserModel).where(
            UserModel.role.in_([Role.FACULTY.value, Role.TRAINER.value, Role.COORDINATOR.value])
        )

        if target_dept_id:
            t_q = t_q.where(UserModel.department_id == target_dept_id)

        if target_course_id:
            t_q = t_q.where(
                UserModel.id.in_(
                    select(CourseStaffModel.user_id).where(CourseStaffModel.course_id == target_course_id)
                )
            )

        duty = spec.get("duty")
        if duty:
            if duty == "instructor":
                t_q = t_q.where(
                    UserModel.id.in_(
                        select(CourseStaffModel.user_id).where(CourseStaffModel.role == "instructor")
                    )
                )
            elif duty == "mentor":
                t_q = t_q.where(UserModel.id.in_(select(MentorAssignmentModel.mentor_id)))
            elif duty == "course_coordinator":
                t_q = t_q.where(
                    or_(
                        UserModel.role == Role.COORDINATOR.value,
                        UserModel.id.in_(
                            select(CourseStaffModel.user_id).where(CourseStaffModel.role == "coordinator")
                        ),
                    )
                )
            elif duty == "trainer":
                t_q = t_q.where(
                    or_(
                        UserModel.role == Role.TRAINER.value,
                        UserModel.id.in_(
                            select(CourseStaffModel.user_id).where(CourseStaffModel.role == "trainer")
                        ),
                    )
                )

        teacher_users = db.scalars(t_q).all()
        for tu in teacher_users:
            if target_course_id:
                reason = "Course Instructor / Staff"
            elif duty:
                reason = f"Staff Duty: {duty.capitalize()}"
            elif target_dept_id:
                reason = "Department Faculty / Staff"
            else:
                reason = "Faculty & Academic Staff"
            recipients[tu.id] = reason

    roll_numbers = spec.get("roll_numbers") or []
    if roll_numbers:
        for r in roll_numbers:
            r_str = str(r).strip()
            if not r_str:
                continue
            st = db.scalar(select(StudentModel).where(StudentModel.roll_no == r_str))
            if not st:
                excluded.append({"roll_no": r_str, "reason": "Student roll number not found"})
                continue

            st_user = db.get(UserModel, st.user_id)
            if sender_role in (Role.FACULTY.value, Role.TRAINER.value):
                in_courses = db.scalar(
                    select(EnrolmentModel.student_id).where(
                        EnrolmentModel.student_id == st.user_id,
                        EnrolmentModel.course_id.in_(staff_course_ids),
                    )
                )
                is_mentee = st.user_id in mentee_student_ids
                if not (in_courses or is_mentee):
                    excluded.append({"roll_no": r_str, "reason": "Out of sender scope (not in your courses or mentees)"})
                    continue
            elif sender_role == Role.COORDINATOR.value:
                if sender_dept_id and st_user and st_user.department_id != sender_dept_id:
                    excluded.append({"roll_no": r_str, "reason": "Out of department scope"})
                    continue

            recipients[st.user_id] = "Individually selected student"

    summary_parts = []
    if preset:
        summary_parts.append(preset)
    elif spec.get("is_all"):
        summary_parts.append("Everyone (Institution-wide)" if sender_role == Role.ADMIN.value else "Whole Department")
    else:
        if target_course_id:
            c = db.get(CourseModel, target_course_id)
            summary_parts.append(f"{c.code}" if c else f"Course #{target_course_id}")
        if spec.get("section"):
            summary_parts.append(f"Section {spec['section']}")
        if spec.get("my_mentees"):
            summary_parts.append("Assigned Mentees")
        if spec.get("attendance_band"):
            summary_parts.append(f"Attendance Band: {spec['attendance_band']}")
        if spec.get("pending_assignment_id"):
            summary_parts.append(f"Pending Assignment #{spec['pending_assignment_id']}")
        if spec.get("duty"):
            summary_parts.append(f"Duty: {spec['duty'].capitalize()}")
        if spec.get("batch") or spec.get("programme"):
            summary_parts.append(f"Batch {spec.get('batch') or spec.get('programme')}")
        if roll_numbers:
            summary_parts.append(f"{len(recipients)} individual students")

    if not summary_parts:
        if rec_type == "students":
            summary = "All Department Students"
        elif rec_type == "teachers":
            summary = "Department Faculty & Staff"
        else:
            summary = "Whole Department Audience"
    else:
        summary = ", ".join(summary_parts)

    return recipients, excluded, summary

@router.post("/audience/preview", summary="Live recipient count and preview list")
def preview_audience(
    payload: AudiencePreviewRequest,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    sender_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    sender_role = current_user.get("role", "faculty") if current_user else "faculty"

    spec = payload.model_dump(exclude_unset=True)
    recipients, excluded, audience_summary = _resolve_targeted_audience(db, sender_id, sender_role, spec)

    student_count = 0
    teacher_count = 0
    if recipients:
        u_roles = db.execute(
            select(UserModel.id, UserModel.role).where(UserModel.id.in_(list(recipients.keys())))
        ).all()
        for uid, urole in u_roles:
            if urole == Role.STUDENT.value:
                student_count += 1
            else:
                teacher_count += 1

    sample_ids = list(recipients.keys())[:20]
    sample_users = (
        db.scalars(select(UserModel).where(UserModel.id.in_(sample_ids))).all()
        if sample_ids
        else []
    )
    sample_students = {
        s.user_id: s.roll_no
        for s in db.scalars(select(StudentModel).where(StudentModel.user_id.in_(sample_ids))).all()
    }

    recipients_info = [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "roll_no": sample_students.get(u.id),
            "reason": recipients.get(u.id, "Recipient"),
        }
        for u in sample_users
    ]

    risk_cfg = db.scalar(select(RiskConfigModel))
    threshold = (
        risk_cfg.notice_reach_threshold
        if (risk_cfg and risk_cfg.notice_reach_threshold)
        else 100
    )

    warning = None
    if len(recipients) > threshold:
        warning = f"This reaches {len(recipients)} people. Narrow it?"

    return {
        "count": len(recipients),
        "student_count": student_count,
        "teacher_count": teacher_count,
        "recipients_sample": recipients_info,
        "excluded": excluded,
        "warning": warning,
        "audience_summary": audience_summary,
        "audience_spec": spec,
    }


@router.post("/extract", summary="Rule-based date/time deadline extraction in Asia/Kolkata")
def extract_notice_dates(payload: ExtractDatesRequest):
    candidates = extract_dates(payload.text)
    return {
        "count": len(candidates),
        "timezone": "Asia/Kolkata",
        "candidates": candidates,
    }


@router.post("", status_code=201, summary="Publish new notice with targeted audience")
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

    today_start_tz = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_naive = today_start_tz.replace(tzinfo=None)
    sent_today = (
        db.scalar(
            select(func.count(NoticeModel.id)).where(
                NoticeModel.sender_id == sender_id,
                or_(
                    NoticeModel.created_at >= today_start_tz,
                    NoticeModel.created_at >= today_start_naive,
                ),
            )
        )
        or 0
    )
    risk_cfg = db.scalar(select(RiskConfigModel))
    rate_limit = (
        risk_cfg.notice_daily_rate_limit
        if (risk_cfg and risk_cfg.notice_daily_rate_limit)
        else 20
    )
    if sent_today >= rate_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "RATE_LIMIT_EXCEEDED",
                "message": f"Daily notice send limit of {rate_limit} reached. Please try again tomorrow.",
            },
        )

    spec = {}
    if payload.audience_spec:
        try:
            spec = json.loads(payload.audience_spec)
        except Exception:
            spec = {"recipient_type": "both"}
    else:
        spec = {"recipient_type": "both"}

    recipients, excluded, audience_summary = _resolve_targeted_audience(db, sender_id, sender_role, spec)

    if not recipients:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "EMPTY_AUDIENCE",
                "message": "Notice audience cannot be empty. Please adjust your filters or recipient list.",
            },
        )

    notice = NoticeModel(
        sender_id=sender_id,
        title=payload.title,
        body=payload.body,
        category=payload.category,
        priority=payload.priority,
        urgent=payload.urgent,
        link=payload.link,
        status="sent",
        audience_spec=payload.audience_spec or json.dumps(spec),
        audience_summary=audience_summary,
        created_at=datetime.now(timezone.utc),
    )
    db.add(notice)
    db.flush()

    for uid, reason in recipients.items():
        rec = NoticeRecipientModel(
            notice_id=notice.id,
            user_id=uid,
            reason=reason,
            delivered_at=datetime.now(timezone.utc),
        )
        db.add(rec)

    deadlines_created = []
    if payload.add_to_deadlines and payload.deadlines:
        for d in payload.deadlines:
            dl = NoticeDeadlineModel(
                notice_id=notice.id,
                kind=d.kind,
                at=d.at,
                label=d.label,
                source=d.source or f"Notice: {notice.title}",
                confirmed_by=sender_id,
            )
            db.add(dl)
            deadlines_created.append(dl)

    db.add(
        AuditLogModel(
            entity="notices",
            entity_id=str(notice.id),
            action="notice_send",
            old_value=None,
            new_value=f"title: '{notice.title[:40]}', summary: '{notice.audience_summary}', recipients: {len(recipients)}, deadlines: {len(deadlines_created)}",
            actor_id=sender_id,
            created_at=datetime.now(timezone.utc),
        )
    )

    db.commit()
    db.refresh(notice)

    try:
        from app.services.notification_service import create_in_app_notification

        badge = "🚨 [Urgent] " if notice.urgent else ("⭐ [Important] " if notice.priority == "important" else "📢 ")
        for uid in recipients.keys():
            create_in_app_notification(
                db=db,
                user_id=uid,
                title=f"{badge}{notice.title}",
                message=f"{notice.body[:100]}...\nSent to: {notice.audience_summary}",
                notif_type="notice_new",
            )
    except Exception:
        pass

    return {
        "id": notice.id,
        "title": notice.title,
        "category": notice.category,
        "priority": notice.priority,
        "urgent": notice.urgent,
        "status": notice.status,
        "link": notice.link,
        "audience_summary": notice.audience_summary,
        "recipient_count": len(recipients),
        "deadlines_count": len(deadlines_created),
        "created_at": notice.created_at.isoformat(),
    }

@router.get("", summary="List notices (sent by current staff user or all for admin)")
def list_notices(
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    sender_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    role = current_user.get("role", "faculty") if current_user else "faculty"

    q = select(NoticeModel).where(NoticeModel.status != "archived")
    if role != Role.ADMIN.value:
        q = q.where(NoticeModel.sender_id == sender_id)
    q = q.order_by(NoticeModel.created_at.desc())

    notices = db.scalars(q).all()
    results = []
    for n in notices:
        total_recipients = (
            db.scalar(
                select(func.count(NoticeRecipientModel.user_id)).where(NoticeRecipientModel.notice_id == n.id)
            )
            or 0
        )
        read_count = (
            db.scalar(
                select(func.count(NoticeRecipientModel.user_id)).where(
                    NoticeRecipientModel.notice_id == n.id,
                    or_(NoticeRecipientModel.read_at.isnot(None), NoticeRecipientModel.seen_at.isnot(None)),
                )
            )
            or 0
        )
        seen_count = (
            db.scalar(
                select(func.count(NoticeRecipientModel.user_id)).where(
                    NoticeRecipientModel.notice_id == n.id,
                    NoticeRecipientModel.seen_at.isnot(None),
                )
            )
            or 0
        )
        done_count = (
            db.scalar(
                select(func.count(NoticeRecipientModel.user_id)).where(
                    NoticeRecipientModel.notice_id == n.id,
                    NoticeRecipientModel.done_at.isnot(None),
                )
            )
            or 0
        )
        deadlines = db.scalars(select(NoticeDeadlineModel).where(NoticeDeadlineModel.notice_id == n.id)).all()

        results.append({
            "id": n.id,
            "title": n.title,
            "body": n.body,
            "category": n.category,
            "priority": n.priority,
            "urgent": n.urgent,
            "link": n.link,
            "status": n.status,
            "audience_summary": n.audience_summary,
            "is_correction_for_id": n.is_correction_for_id,
            "created_at": n.created_at.isoformat() if n.created_at else "",
            "total_recipients": total_recipients,
            "read_count": read_count,
            "seen_count": seen_count,
            "done_count": done_count,
            "deadlines": [
                {"id": d.id, "kind": d.kind, "at": d.at, "label": d.label, "source": d.source}
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
        deadlines = db.scalars(select(NoticeDeadlineModel).where(NoticeDeadlineModel.notice_id == n.id)).all()

        results.append({
            "id": n.id,
            "title": n.title,
            "body": n.body,
            "category": n.category,
            "priority": n.priority,
            "urgent": n.urgent,
            "link": n.link,
            "audience_summary": n.audience_summary,
            "reason": rec.reason if rec else "Recipient",
            "is_correction": n.is_correction_for_id is not None,
            "is_correction_for_id": n.is_correction_for_id,
            "sender_name": sender.name if sender else "Academic Staff",
            "created_at": n.created_at.isoformat() if n.created_at else "",
            "seen": (rec.seen_at is not None or rec.read_at is not None) if rec else False,
            "read": (rec.read_at is not None or rec.seen_at is not None) if rec else False,
            "done": rec.done_at is not None if rec else False,
            "deadlines": [
                {"id": d.id, "kind": d.kind, "at": d.at, "label": d.label, "source": d.source}
                for d in deadlines
            ],
        })
    return results


@router.get("/presets", summary="List available audience presets for current user")
def get_presets(
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    user_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    role = current_user.get("role", "faculty") if current_user else "faculty"

    system_presets = [
        {"id": "my_courses", "name": "My course sections", "is_system": True},
        {"id": "my_mentees", "name": "My mentees", "is_system": True},
        {"id": "my_support", "name": "My course, needs support", "is_system": True},
    ]
    if role in (Role.COORDINATOR.value, Role.ADMIN.value):
        system_presets.append({"id": "whole_dept", "name": "Whole department", "is_system": True})

    custom_presets = db.scalars(
        select(AudiencePresetModel).where(AudiencePresetModel.user_id == user_id).order_by(AudiencePresetModel.created_at.desc())
    ).all()

    return {
        "system_presets": system_presets,
        "custom_presets": [
            {
                "id": cp.id,
                "name": cp.name,
                "spec": json.loads(cp.spec) if cp.spec else {},
                "created_at": cp.created_at.isoformat() if cp.created_at else "",
            }
            for cp in custom_presets
        ],
    }


@router.post("/presets", status_code=201, summary="Save custom audience preset")
def save_preset(
    payload: PresetCreate,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    user_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    preset = AudiencePresetModel(
        user_id=user_id,
        name=payload.name,
        spec=json.dumps(payload.spec),
        created_at=datetime.now(timezone.utc),
    )
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return {"id": preset.id, "name": preset.name, "saved": True}


@router.get("/recent-audiences", summary="Recently targeted audience configurations")
def get_recent_audiences(
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    user_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    notices = db.scalars(
        select(NoticeModel)
        .where(NoticeModel.sender_id == user_id, NoticeModel.audience_spec.isnot(None))
        .order_by(NoticeModel.created_at.desc())
        .limit(10)
    ).all()

    seen_specs = []
    results = []
    for n in notices:
        try:
            parsed = json.loads(n.audience_spec)
            spec_str = json.dumps(parsed, sort_keys=True)
            if spec_str not in seen_specs:
                seen_specs.append(spec_str)
                results.append({
                    "summary": n.audience_summary or "Audience",
                    "spec": parsed,
                    "used_at": n.created_at.isoformat() if n.created_at else "",
                })
        except Exception:
            continue
        if len(results) >= 5:
            break

    return results


@router.get("/{notice_id}/unread", summary="List unread recipients for a notice")
def get_unread_recipients(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    user_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    role = current_user.get("role", "faculty") if current_user else "faculty"

    notice = db.get(NoticeModel, notice_id)
    if not notice:
        raise NotFoundError("Notice not found")

    if notice.sender_id != user_id and role not in (Role.COORDINATOR.value, Role.ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "PERM_403", "message": "Cannot view unread recipients for another user's notice"},
        )

    unread_recipients = db.execute(
        select(UserModel, StudentModel, NoticeRecipientModel.reason)
        .join(NoticeRecipientModel, UserModel.id == NoticeRecipientModel.user_id)
        .outerjoin(StudentModel, UserModel.id == StudentModel.user_id)
        .where(
            NoticeRecipientModel.notice_id == notice_id,
            NoticeRecipientModel.read_at.is_(None),
            NoticeRecipientModel.seen_at.is_(None),
        )
    ).all()

    sender_user = db.get(UserModel, user_id)
    sender_dept_id = sender_user.department_id if sender_user else None

    results = []
    for u, st, reason in unread_recipients:
        if role == Role.COORDINATOR.value and sender_dept_id and u.department_id != sender_dept_id:
            continue
        results.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "roll_no": st.roll_no if st else None,
            "reason": reason or "Recipient",
        })

    return {
        "notice_id": notice.id,
        "total_unread": len(results),
        "unread_recipients": results,
    }


@router.post("/{notice_id}/correction", status_code=201, summary="Send correction notice to original recipient snapshot")
def send_correction(
    notice_id: int,
    payload: NoticeCorrection,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    sender_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    role = current_user.get("role", "faculty") if current_user else "faculty"

    original = db.get(NoticeModel, notice_id)
    if not original:
        raise NotFoundError("Original notice not found")

    if original.sender_id != sender_id and role not in (Role.COORDINATOR.value, Role.ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "PERM_403", "message": "Cannot send correction for another user's notice"},
        )

    original_recipients = db.scalars(
        select(NoticeRecipientModel).where(NoticeRecipientModel.notice_id == original.id)
    ).all()

    if not original_recipients:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "NO_RECIPIENTS", "message": "Original notice has no recipients to notify"},
        )

    correction_summary = f"Correction for #{original.id}: {original.audience_summary or 'Notice'}"
    correction = NoticeModel(
        sender_id=sender_id,
        title=payload.title,
        body=payload.body,
        category=payload.category or original.category,
        priority=payload.priority or "important",
        urgent=payload.urgent,
        link=payload.link or original.link,
        status="sent",
        audience_spec=original.audience_spec,
        audience_summary=correction_summary,
        is_correction_for_id=original.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(correction)
    db.flush()

    for orig_rec in original_recipients:
        db.add(
            NoticeRecipientModel(
                notice_id=correction.id,
                user_id=orig_rec.user_id,
                reason=f"Correction for Notice #{original.id}",
                delivered_at=datetime.now(timezone.utc),
            )
        )

    db.add(
        AuditLogModel(
            entity="notices",
            entity_id=str(correction.id),
            action="notice_correction",
            old_value=str(original.id),
            new_value=f"Sent correction for notice #{original.id} to {len(original_recipients)} recipients",
            actor_id=sender_id,
            created_at=datetime.now(timezone.utc),
        )
    )

    db.commit()
    db.refresh(correction)

    try:
        from app.services.notification_service import create_in_app_notification
        for orig_rec in original_recipients:
            create_in_app_notification(
                db=db,
                user_id=orig_rec.user_id,
                title=f"📝 [Correction] {correction.title}",
                message=f"{correction.body[:100]}...\nOriginal: Notice #{original.id}",
                notif_type="notice_updated",
            )
    except Exception:
        pass

    return {
        "id": correction.id,
        "title": correction.title,
        "is_correction_for_id": original.id,
        "recipient_count": len(original_recipients),
        "audience_summary": correction.audience_summary,
        "created_at": correction.created_at.isoformat(),
    }


@router.get("/{notice_id}", summary="Get notice detail and stats")
def get_notice_detail(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    notice = db.get(NoticeModel, notice_id)
    if not notice:
        raise NotFoundError("Notice not found")

    deadlines = db.scalars(select(NoticeDeadlineModel).where(NoticeDeadlineModel.notice_id == notice.id)).all()
    sender = db.get(UserModel, notice.sender_id)

    total_recipients = (
        db.scalar(select(func.count(NoticeRecipientModel.user_id)).where(NoticeRecipientModel.notice_id == notice.id))
        or 0
    )
    read_count = (
        db.scalar(
            select(func.count(NoticeRecipientModel.user_id)).where(
                NoticeRecipientModel.notice_id == notice.id,
                or_(NoticeRecipientModel.read_at.isnot(None), NoticeRecipientModel.seen_at.isnot(None)),
            )
        )
        or 0
    )

    user_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    user_rec = db.scalar(
        select(NoticeRecipientModel).where(
            NoticeRecipientModel.notice_id == notice.id,
            NoticeRecipientModel.user_id == user_id,
        )
    )

    return {
        "id": notice.id,
        "title": notice.title,
        "body": notice.body,
        "category": notice.category,
        "priority": notice.priority,
        "urgent": notice.urgent,
        "link": notice.link,
        "status": notice.status,
        "audience_summary": notice.audience_summary,
        "audience_spec": json.loads(notice.audience_spec) if notice.audience_spec else {},
        "is_correction_for_id": notice.is_correction_for_id,
        "sender_id": notice.sender_id,
        "sender_name": sender.name if sender else "Academic Staff",
        "created_at": notice.created_at.isoformat() if notice.created_at else "",
        "total_recipients": total_recipients,
        "read_count": read_count,
        "my_reason": user_rec.reason if user_rec else None,
        "my_read": (user_rec.read_at is not None or user_rec.seen_at is not None) if user_rec else False,
        "deadlines": [
            {"id": d.id, "kind": d.kind, "at": d.at, "label": d.label, "source": d.source}
            for d in deadlines
        ],
    }


@router.post("/{notice_id}/read", summary="Mark notice read by current user")
@router.post("/{notice_id}/seen", summary="Mark notice seen by current user")
def mark_read_or_seen(
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
    now = datetime.now(timezone.utc)
    if rec:
        if not rec.read_at:
            rec.read_at = now
        if not rec.seen_at:
            rec.seen_at = now
        db.commit()
    return {"read": True, "seen": True}


@router.post("/{notice_id}/done", summary="Mark notice done")
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


@router.delete("/{notice_id}", summary="Withdraw notice")
def withdraw_notice(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    notice = db.get(NoticeModel, notice_id)
    if not notice:
        raise NotFoundError("Notice not found")

    sender_id = int(current_user["sub"]) if current_user and "sub" in current_user else 1
    role = current_user.get("role", "faculty") if current_user else "faculty"
    if notice.sender_id != sender_id and role != Role.ADMIN.value:
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
