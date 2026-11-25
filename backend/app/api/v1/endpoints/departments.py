"""
Department Trends, Hotspots, Intervention Funnel, and Mentor Load Endpoints.
AcadFlow Phase 4.
"""

from __future__ import annotations

import io
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Set

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.audit import AuditAction, audit_logger
from app.core.authorization import (
    Action,
    check_is_dean,
    verify_access,
)
from app.core.deps import get_db
from app.models.course import CourseModel
from app.models.enrollment import EnrolmentModel
from app.models.intervention import InterventionModel
from app.models.risk import RiskSnapshotModel
from app.models.user import (
    DepartmentModel,
    MentorAssignmentModel,
    StudentModel,
    UserModel,
)
from app.schemas.department import (
    DepartmentTrendsResponse,
    HotspotCourseSection,
    InterventionFunnel,
    MentorLoadItem,
    MentorLoadResponse,
    WeeklyRiskTrend,
)

router = APIRouter()


def _verify_dean_department_scope(
    db: Session,
    current_user: dict,
    department_id: int,
    action: Action = Action.VIEW_DEPARTMENT_TRENDS,
) -> int:
    """Central permission & scope verification for department dean access."""
    user_id = int(current_user["sub"]) if "sub" in current_user else current_user.get("id")
    is_dean = check_is_dean(db, user_id, department_id)
    verify_access(
        current_user,
        action,
        {"is_authorized_dean": is_dean, "department_id": department_id},
    )
    return user_id


def _compute_department_trends(
    db: Session,
    department: DepartmentModel,
    weeks: int,
) -> DepartmentTrendsResponse:
    dept_id = department.id
    now = datetime.now(timezone.utc)

    # 1. Department Students
    dept_student_records = db.execute(
        select(StudentModel.user_id)
        .join(UserModel, UserModel.id == StudentModel.user_id)
        .where(UserModel.department_id == dept_id)
    ).all()
    dept_student_ids: List[int] = [r[0] for r in dept_student_records]

    # 2. Weekly Risk Trends
    weekly_trends: List[WeeklyRiskTrend] = []
    high_risk_students_ever: Set[int] = set()

    for w in range(weeks - 1, -1, -1):
        w_end_dt = now - timedelta(days=w * 7)
        w_start_dt = w_end_dt - timedelta(days=7)
        week_num = weeks - w
        week_label = f"Week {week_num}"

        safe_cnt = 0
        watch_cnt = 0
        at_risk_cnt = 0
        needs_support_cnt = 0

        if dept_student_ids:
            # Query snapshots within this 7-day window
            snapshots = db.scalars(
                select(RiskSnapshotModel)
                .where(
                    RiskSnapshotModel.student_id.in_(dept_student_ids),
                    RiskSnapshotModel.computed_at >= w_start_dt,
                    RiskSnapshotModel.computed_at <= w_end_dt,
                )
                .order_by(RiskSnapshotModel.computed_at.desc())
            ).all()

            # Deduplicate per student to latest snapshot in week
            seen_students: Set[int] = set()
            for snap in snapshots:
                if snap.student_id in seen_students:
                    continue
                seen_students.add(snap.student_id)

                band_clean = (snap.band or "").strip()
                if band_clean == "Safe":
                    safe_cnt += 1
                elif band_clean == "Watch":
                    watch_cnt += 1
                elif band_clean == "At risk":
                    at_risk_cnt += 1
                    high_risk_students_ever.add(snap.student_id)
                elif band_clean in ("Critical", "Needs support"):
                    needs_support_cnt += 1
                    high_risk_students_ever.add(snap.student_id)

        weekly_trends.append(
            WeeklyRiskTrend(
                week_number=week_num,
                week_label=week_label,
                week_start=w_start_dt.date(),
                week_end=w_end_dt.date(),
                safe=safe_cnt,
                watch=watch_cnt,
                at_risk=at_risk_cnt,
                needs_support=needs_support_cnt,
                total_snapshots=safe_cnt + watch_cnt + at_risk_cnt + needs_support_cnt,
            )
        )

    # 3. Top Hotspots (Courses & Sections with high support share)
    dept_courses = db.scalars(
        select(CourseModel).where(CourseModel.department_id == dept_id)
    ).all()

    # Pre-fetch latest risk band for all students in department
    latest_bands: Dict[int, str] = {}
    if dept_student_ids:
        latest_snaps = db.scalars(
            select(RiskSnapshotModel)
            .where(RiskSnapshotModel.student_id.in_(dept_student_ids))
            .order_by(RiskSnapshotModel.computed_at.desc())
        ).all()
        for snap in latest_snaps:
            if snap.student_id not in latest_bands:
                latest_bands[snap.student_id] = snap.band
                if snap.band in ("Critical", "Needs support", "At risk"):
                    high_risk_students_ever.add(snap.student_id)

    hotspots: List[HotspotCourseSection] = []

    for course in dept_courses:
        enrolments = db.scalars(
            select(EnrolmentModel).where(EnrolmentModel.course_id == course.id)
        ).all()

        sections_map: Dict[str, List[int]] = {}
        for enr in enrolments:
            sec = getattr(enr, "section", None) or "A"
            sections_map.setdefault(sec, []).append(enr.student_id)

        for sec_name, s_ids in sections_map.items():
            tot = len(s_ids)
            support_needed = 0
            for sid in s_ids:
                b = latest_bands.get(sid, "Safe")
                if b in ("Critical", "Needs support", "At risk"):
                    support_needed += 1

            share_pct = round((support_needed / tot) * 100.0, 1) if tot > 0 else 0.0
            hotspots.append(
                HotspotCourseSection(
                    course_id=course.id,
                    course_code=course.code,
                    course_name=course.name,
                    section=sec_name,
                    total_students=tot,
                    students_needing_support=support_needed,
                    support_share_pct=share_pct,
                )
            )

    hotspots.sort(key=lambda h: (h.support_share_pct, h.students_needing_support), reverse=True)

    # 4. Intervention Funnel (flagged -> contacted -> recovered)
    flagged_ids = high_risk_students_ever
    if not flagged_ids and dept_student_ids:
        # Fallback to any students with latest band needing support
        flagged_ids = {sid for sid, b in latest_bands.items() if b in ("Critical", "Needs support", "At risk")}

    contacted_ids: Set[int] = set()
    recovered_ids: Set[int] = set()

    if flagged_ids:
        interventions = db.scalars(
            select(InterventionModel).where(InterventionModel.student_id.in_(list(flagged_ids)))
        ).all()
        for itv in interventions:
            contacted_ids.add(itv.student_id)
            if itv.outcome == "recovered":
                recovered_ids.add(itv.student_id)

    flagged_count = len(flagged_ids)
    contacted_count = len(contacted_ids)
    recovered_count = len(recovered_ids)

    contact_rate = round((contacted_count / flagged_count) * 100.0, 1) if flagged_count > 0 else 0.0
    recovery_rate = round((recovered_count / contacted_count) * 100.0, 1) if contacted_count > 0 else 0.0

    funnel = InterventionFunnel(
        flagged=flagged_count,
        contacted=contacted_count,
        recovered=recovered_count,
        contact_rate_pct=contact_rate,
        recovery_rate_pct=recovery_rate,
    )

    return DepartmentTrendsResponse(
        department_id=department.id,
        department_name=department.name,
        department_code=department.code,
        weeks_analyzed=weeks,
        weekly_risk_trends=weekly_trends,
        top_hotspots=hotspots,
        intervention_funnel=funnel,
    )


def _compute_mentor_load(
    db: Session,
    department: DepartmentModel,
) -> MentorLoadResponse:
    dept_id = department.id

    # 1. Fetch mentor assignments for department students
    assignments = db.execute(
        select(MentorAssignmentModel.mentor_id, MentorAssignmentModel.student_id)
        .join(UserModel, UserModel.id == MentorAssignmentModel.student_id)
        .where(UserModel.department_id == dept_id)
    ).all()

    mentor_map: Dict[int, List[int]] = {}
    for m_id, s_id in assignments:
        mentor_map.setdefault(m_id, []).append(s_id)

    # Pre-fetch latest risk band for all students in department
    dept_student_records = db.execute(
        select(StudentModel.user_id)
        .join(UserModel, UserModel.id == StudentModel.user_id)
        .where(UserModel.department_id == dept_id)
    ).all()
    dept_student_ids = [r[0] for r in dept_student_records]

    latest_bands: Dict[int, str] = {}
    if dept_student_ids:
        latest_snaps = db.scalars(
            select(RiskSnapshotModel)
            .where(RiskSnapshotModel.student_id.in_(dept_student_ids))
            .order_by(RiskSnapshotModel.computed_at.desc())
        ).all()
        for snap in latest_snaps:
            if snap.student_id not in latest_bands:
                latest_bands[snap.student_id] = snap.band

    items: List[MentorLoadItem] = []
    total_mentees_set: Set[int] = set()

    for mentor_id, mentee_ids in mentor_map.items():
        mentor_user = db.get(UserModel, mentor_id)
        if not mentor_user:
            continue

        total_mentees_set.update(mentee_ids)
        mentee_count = len(mentee_ids)
        high_risk_count = 0
        for sid in mentee_ids:
            b = latest_bands.get(sid, "Safe")
            if b in ("Critical", "Needs support", "At risk"):
                high_risk_count += 1

        high_risk_pct = round((high_risk_count / mentee_count) * 100.0, 1) if mentee_count > 0 else 0.0

        open_itvs = db.scalar(
            select(func.count(InterventionModel.id)).where(
                InterventionModel.student_id.in_(mentee_ids),
                InterventionModel.outcome == "open",
            )
        ) or 0

        items.append(
            MentorLoadItem(
                mentor_id=mentor_user.id,
                mentor_name=mentor_user.name,
                mentor_email=mentor_user.email,
                mentee_count=mentee_count,
                high_risk_mentee_count=high_risk_count,
                high_risk_share_pct=high_risk_pct,
                open_interventions_count=open_itvs,
            )
        )

    items.sort(key=lambda m: (m.high_risk_share_pct, m.mentee_count), reverse=True)

    return MentorLoadResponse(
        department_id=department.id,
        department_name=department.name,
        total_mentors=len(items),
        total_mentees=len(total_mentees_set),
        mentors=items,
    )


@router.get("/{id}/trends", response_model=DepartmentTrendsResponse)
async def get_department_trends(
    id: int,
    weeks: int = Query(8, ge=1, le=52),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Weekly counts per risk band from risk_snapshots, top courses and sections
    by share needing support, and an intervention funnel.
    Scoped to the dean's own department; cross-department access returns 403.
    """
    user_id = _verify_dean_department_scope(db, current_user, id, Action.VIEW_DEPARTMENT_TRENDS)
    user_role = current_user.get("role", "")

    department = db.get(DepartmentModel, id)
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID {id} not found.",
        )

    # Audited record view
    await audit_logger.log_event(
        actor_id=user_id,
        actor_role=user_role,
        action=AuditAction.DEAN_RECORD_VIEW,
        resource_type="department_trends",
        resource_id=id,
        metadata={"department_id": id, "weeks": weeks},
    )

    return _compute_department_trends(db, department, weeks)


@router.get("/{id}/mentor-load", response_model=MentorLoadResponse)
async def get_mentor_load(
    id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Mentor load view for the dean: mentees per mentor and the share of high-risk mentees.
    Scoped to the dean's department; cross-department access returns 403.
    """
    user_id = _verify_dean_department_scope(db, current_user, id, Action.VIEW_MENTOR_LOAD)
    user_role = current_user.get("role", "")

    department = db.get(DepartmentModel, id)
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID {id} not found.",
        )

    await audit_logger.log_event(
        actor_id=user_id,
        actor_role=user_role,
        action=AuditAction.DEAN_RECORD_VIEW,
        resource_type="mentor_load",
        resource_id=id,
        metadata={"department_id": id},
    )

    return _compute_mentor_load(db, department)


@router.get("/{id}/trends/export")
async def export_department_trends(
    id: int,
    weeks: int = Query(8, ge=1, le=52),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Export department trends, hotspots, intervention funnel, and mentor load as an Excel (.xlsx) file.
    Scoped to the dean's department; cross-department access returns 403.
    """
    user_id = _verify_dean_department_scope(db, current_user, id, Action.EXPORT_DEPARTMENT_TRENDS)
    user_role = current_user.get("role", "")

    department = db.get(DepartmentModel, id)
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID {id} not found.",
        )

    await audit_logger.log_event(
        actor_id=user_id,
        actor_role=user_role,
        action=AuditAction.DEAN_RECORD_VIEW,
        resource_type="department_trends_export",
        resource_id=id,
        metadata={"department_id": id, "weeks": weeks},
    )

    trends_data = _compute_department_trends(db, department, weeks)
    mentor_data = _compute_mentor_load(db, department)

    # Build Excel workbook with openpyxl
    import openpyxl
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()

    # Style definitions - Holst navy & sand palette
    header_font = Font(name="Calibri", size=11, bold=True, color="0D1B2A")
    header_fill = PatternFill(start_color="D4C4A8", end_color="D4C4A8", fill_type="solid")
    regular_font = Font(name="Calibri", size=10, color="1B263B")
    thin_border = Border(
        left=Side(style="thin", color="D4C4A8"),
        right=Side(style="thin", color="D4C4A8"),
        top=Side(style="thin", color="D4C4A8"),
        bottom=Side(style="thin", color="D4C4A8"),
    )

    def style_sheet(ws, title, headers, rows):
        ws.title = title
        ws.append(headers)
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = thin_border

        for r_idx, row_data in enumerate(rows, start=2):
            ws.append(row_data)
            for col_idx in range(1, len(row_data) + 1):
                cell = ws.cell(row=r_idx, column=col_idx)
                cell.font = regular_font
                cell.border = thin_border
                if isinstance(cell.value, (int, float)):
                    cell.alignment = Alignment(horizontal="right", vertical="center")
                else:
                    cell.alignment = Alignment(horizontal="left", vertical="center")

        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    # 1. Weekly Trends Sheet
    ws1 = wb.active
    ws1_headers = ["Week Label", "Start Date", "End Date", "Safe", "Watch", "At Risk", "Needs Support", "Total Snapshots"]
    ws1_rows = [
        [
            w.week_label,
            str(w.week_start),
            str(w.week_end),
            w.safe,
            w.watch,
            w.at_risk,
            w.needs_support,
            w.total_snapshots,
        ]
        for w in trends_data.weekly_risk_trends
    ]
    style_sheet(ws1, "Weekly Trends", ws1_headers, ws1_rows)

    # 2. Course Hotspots Sheet
    ws2 = wb.create_sheet(title="Course Hotspots")
    ws2_headers = ["Course Code", "Course Name", "Section", "Total Students", "Students Needing Support", "Support Share (%)"]
    ws2_rows = [
        [
            h.course_code,
            h.course_name,
            h.section,
            h.total_students,
            h.students_needing_support,
            h.support_share_pct,
        ]
        for h in trends_data.top_hotspots
    ]
    style_sheet(ws2, "Course Hotspots", ws2_headers, ws2_rows)

    # 3. Intervention Funnel Sheet
    ws3 = wb.create_sheet(title="Intervention Funnel")
    ws3_headers = ["Funnel Stage", "Student Count", "Conversion Metric", "Rate (%)"]
    fn = trends_data.intervention_funnel
    ws3_rows = [
        ["1. Flagged Needing Support", fn.flagged, "Baseline Cohort", 100.0],
        ["2. Support Contacted", fn.contacted, "Outreach Rate", fn.contact_rate_pct],
        ["3. Recovered to Good Standing", fn.recovered, "Recovery Rate", fn.recovery_rate_pct],
    ]
    style_sheet(ws3, "Intervention Funnel", ws3_headers, ws3_rows)

    # 4. Mentor Load Sheet
    ws4 = wb.create_sheet(title="Mentor Load")
    ws4_headers = ["Mentor Name", "Email", "Total Mentees", "High-Risk Mentees", "High-Risk Share (%)", "Open Interventions"]
    ws4_rows = [
        [
            m.mentor_name,
            m.mentor_email,
            m.mentee_count,
            m.high_risk_mentee_count,
            m.high_risk_share_pct,
            m.open_interventions_count,
        ]
        for m in mentor_data.mentors
    ]
    style_sheet(ws4, "Mentor Load", ws4_headers, ws4_rows)

    # Export buffer
    out_buf = io.BytesIO()
    wb.save(out_buf)
    out_buf.seek(0)

    filename = f"department_{id}_academic_trends_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return Response(
        content=out_buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
