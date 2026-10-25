"""
AcadFlow Semester 5 Realistic Academic Scenario Seeder
Implements PRD and user scenario requirements:
1. Current Semester: Semester 5 (2026) running from 1 July 2026 to 15 December 2026.
2. Institutional Holidays across July-Dec 2026 (past + future holidays like Diwali).
3. Student Planned Leaves for student Riya Sharma (26AIML001) in November 2026.
4. 6 Core AIML Courses (total_classes=48).
5. 100 students across 5 sections (A through E).
6. Held class sessions from 1 July 2026 to 24 October 2026 (~34 held sessions per course).
7. Diverse realistic attendance distributions:
   - Safe students (~90% attendance, positive buffers)
   - Watch students (~80% attendance, borderline buffers)
   - At-risk students (~70% attendance, negative buffers)
   - Critical students (~50-60% attendance, severe buffer deficit)
   - Specific realistic mixed profile for Riya Sharma (26AIML001)
8. Published weekly timetable for all sections.
9. Risk snapshots recomputed for all students.
"""

from __future__ import annotations

import os
import random
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from sqlalchemy import create_engine, select, delete
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://acadflow_user:acadflow_password@localhost:5432/acadflow_db",
)


def get_engine():
    sync_url = DATABASE_URL
    if sync_url.startswith("postgresql+asyncpg://"):
        sync_url = sync_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
    elif sync_url.startswith("postgresql://"):
        sync_url = sync_url.replace("postgresql://", "postgresql+psycopg://")
    try:
        engine = create_engine(sync_url, echo=False, connect_args={"connect_timeout": 3})
        engine.connect().close()
        return engine
    except Exception:
        sqlite_path = str(BACKEND_DIR / "acadflow.db")
        print(f"[INFO] Using SQLite database at: {sqlite_path}")
        return create_engine(f"sqlite:///{sqlite_path}", echo=False)


def _get_or_create(session, model, filter_kwargs, create_kwargs=None):
    obj = session.scalar(select(model).filter_by(**filter_kwargs))
    if obj is None:
        kwargs = {**filter_kwargs, **(create_kwargs or {})}
        obj = model(**kwargs)
        session.add(obj)
        session.flush()
    return obj


FIXED_SEED = 42


def seed_semester5(session=None, engine=None) -> dict:
    random.seed(FIXED_SEED)

    from app.core.security import get_password_hash
    from app.models import (
        AssignmentModel,
        AttendanceRecordModel,
        ClassSessionModel,
        CourseModel,
        CourseStaffModel,
        DeanAssignmentModel,
        DepartmentModel,
        EnrolmentModel,
        HolidayModel,
        MentorAssignmentModel,
        NoticeDeadlineModel,
        NoticeModel,
        NoticeRecipientModel,
        NotificationModel,
        OrganizationModel,
        PeriodConfigModel,
        RiskConfigModel,
        RiskSnapshotModel,
        RoomModel,
        SemesterModel,
        StudentHolidayModel,
        StudentModel,
        SubmissionModel,
        TimetableSlotModel,
        TimetableVersionModel,
        UserModel,
    )
    from app.services.risk_data import persist_risk_snapshot

    _engine = engine or get_engine()
    SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)
    _session: Session = session or SessionLocal()

    counts = {
        "holidays": 0,
        "student_holidays": 0,
        "sessions": 0,
        "attendance": 0,
        "risk_snapshots": 0,
        "timetable_slots": 0,
    }

    try:
        shared_password_hash = get_password_hash("password123")

        # ── 1. Organization & Department ──────────────────────────────────────
        org = _get_or_create(
            _session,
            OrganizationModel,
            {"name": "Apex Institute of Technology"},
        )

        aiml_dept = _session.scalar(
            select(DepartmentModel).where(DepartmentModel.code == "CSE-AI")
        )
        if not aiml_dept:
            aiml_dept = _session.scalar(
                select(DepartmentModel).where(DepartmentModel.code == "AIML")
            )
        if not aiml_dept:
            aiml_dept = DepartmentModel(
                name="Computer Science & Engineering (Artificial Intelligence)",
                code="CSE-AI",
                organization_id=org.id,
            )
            _session.add(aiml_dept)
            _session.flush()

        # ── 2. Semester 5 (2026) ──────────────────────────────────────────────
        sem_start = date(2026, 7, 1)
        sem_end = date(2026, 12, 15)
        reference_today = date(2026, 10, 24)

        sem = _session.scalar(
            select(SemesterModel).where(SemesterModel.name == "Semester 5 (2026)")
        )
        if sem:
            sem.start_date = sem_start
            sem.end_date = sem_end
        else:
            sem = SemesterModel(
                name="Semester 5 (2026)",
                start_date=sem_start,
                end_date=sem_end,
            )
            _session.add(sem)
            _session.flush()

        # ── 3. Institutional Holidays ─────────────────────────────────────────
        institutional_holidays = [
            (date(2026, 7, 17), "Muharram"),
            (date(2026, 8, 15), "Independence Day"),
            (date(2026, 8, 27), "Janmashtami"),
            (date(2026, 10, 2), "Mahatma Gandhi Jayanti"),
            (date(2026, 10, 20), "Maha Ashtami"),
            (date(2026, 10, 21), "Maha Navami"),
            (date(2026, 10, 22), "Vijaya Dashami (Dussehra)"),
            (date(2026, 11, 9), "Dhanteras"),
            (date(2026, 11, 10), "Diwali / Deepavali"),
            (date(2026, 11, 11), "Goverdhan Puja"),
            (date(2026, 11, 12), "Bhai Dooj"),
            (date(2026, 11, 25), "Guru Nanak Jayanti"),
            (date(2026, 12, 25), "Christmas Day"),
        ]

        hol_date_set = set()
        for hol_date, hol_label in institutional_holidays:
            hol_date_set.add(hol_date)
            existing_hol = _session.scalar(
                select(HolidayModel).where(
                    HolidayModel.semester_id == sem.id,
                    HolidayModel.holiday_date == hol_date,
                )
            )
            if existing_hol:
                existing_hol.label = hol_label
            else:
                h = HolidayModel(
                    semester_id=sem.id,
                    holiday_date=hol_date,
                    label=hol_label,
                )
                _session.add(h)
                counts["holidays"] += 1
        _session.flush()

        # ── 4. Faculty & Staff ────────────────────────────────────────────────
        faculty_roster = [
            {"name": "Dr. Rajesh Kumar", "email": "rajesh.faculty@acadflow.edu", "role": "faculty"},
            {"name": "Dr. Sneha Sharma", "email": "sneha.faculty@acadflow.edu", "role": "faculty"},
            {"name": "Prof. Vikram Verma", "email": "vikram.faculty@acadflow.edu", "role": "faculty"},
            {"name": "Dr. Ananya Iyer", "email": "ananya.faculty@acadflow.edu", "role": "faculty"},
            {"name": "Prof. Arjun Mehta", "email": "arjun.faculty@acadflow.edu", "role": "faculty"},
            {"name": "Dr. Meera Nambiar", "email": "meera.coord@acadflow.edu", "role": "coordinator"},
            {"name": "Prof. Siddharth Joshi", "email": "siddharth.mentor@acadflow.edu", "role": "faculty"},
            {"name": "Dr. Priya Nair", "email": "faculty@acadflow.edu", "role": "faculty"},
            {"name": "Coord Vijay", "email": "coordinator@acadflow.edu", "role": "coordinator"},
            {"name": "Meera Mentor", "email": "mentor@acadflow.edu", "role": "faculty"},
            {"name": "Admin Sunita", "email": "admin@acadflow.edu", "role": "admin"},
        ]

        faculty_users: dict[str, UserModel] = {}
        for f_data in faculty_roster:
            u = _get_or_create(
                _session,
                UserModel,
                {"email": f_data["email"]},
                {
                    "name": f_data["name"],
                    "password_hash": shared_password_hash,
                    "role": f_data["role"],
                    "department_id": aiml_dept.id,
                    "organization_id": org.id,
                },
            )
            u.department_id = aiml_dept.id
            faculty_users[f_data["email"]] = u

        # ── 5. 6 Core AIML Courses ───────────────────────────────────────────
        courses_def = [
            ("AIML501", "Introduction to Artificial Intelligence", 48, "rajesh.faculty@acadflow.edu", "faculty@acadflow.edu"),
            ("AIML502", "Data Structures & Algorithms", 48, "sneha.faculty@acadflow.edu", "faculty@acadflow.edu"),
            ("AIML503", "Computer Networks & Data Communication", 48, "vikram.faculty@acadflow.edu", "siddharth.mentor@acadflow.edu"),
            ("AIML504", "System Design & Distributed Systems", 48, "ananya.faculty@acadflow.edu", "arjun.faculty@acadflow.edu"),
            ("AIML505", "Agentic AI & Multi-Agent Systems", 48, "rajesh.faculty@acadflow.edu", "ananya.faculty@acadflow.edu"),
            ("AIML506", "Backend Engineering & API Architecture", 48, "arjun.faculty@acadflow.edu", "vikram.faculty@acadflow.edu"),
        ]

        course_models: dict[str, CourseModel] = {}
        for code, name, tot_classes, instr_email, asst_email in courses_def:
            c = _get_or_create(
                _session,
                CourseModel,
                {"code": code},
                {
                    "name": name,
                    "semester_id": sem.id,
                    "department_id": aiml_dept.id,
                    "total_classes": tot_classes,
                },
            )
            c.total_classes = tot_classes
            c.semester_id = sem.id
            course_models[code] = c

            _get_or_create(_session, CourseStaffModel, {"course_id": c.id, "user_id": faculty_users[instr_email].id, "role": "instructor"})
            _get_or_create(_session, CourseStaffModel, {"course_id": c.id, "user_id": faculty_users[asst_email].id, "role": "trainer"})
            _get_or_create(_session, CourseStaffModel, {"course_id": c.id, "user_id": faculty_users["meera.coord@acadflow.edu"].id, "role": "course_coordinator"})

        # ── 6. Students across 5 sections (A to E) ────────────────────────────
        sections = ["A", "B", "C", "D", "E"]
        student_roster: list[tuple[UserModel, StudentModel, str, str]] = []

        all_students_q = _session.scalars(
            select(StudentModel).join(UserModel).where(UserModel.department_id == aiml_dept.id).order_by(StudentModel.roll_no)
        ).all()

        student_user_map: dict[str, UserModel] = {}
        for st in all_students_q:
            u = _session.get(UserModel, st.user_id)
            if u:
                student_user_map[st.roll_no] = u

        # Classify profiles deterministically
        for st in all_students_q:
            u = student_user_map[st.roll_no]
            digits = "".join(filter(str.isdigit, st.roll_no))
            num = int(digits) if digits else 1

            if num <= 20:
                sec = "A"
            elif num <= 40:
                sec = "B"
            elif num <= 60:
                sec = "C"
            elif num <= 80:
                sec = "D"
            else:
                sec = "E"

            # Assign profile tier
            # Student 26AIML001 is Riya Sharma (custom profile)
            if st.roll_no == "26AIML001":
                profile = "riya"
            elif num % 7 == 0 or num in (6, 16, 25, 26, 45, 68, 85):
                profile = "critical"  # ~50-60%
            elif num % 4 == 0 or num in (5, 12, 19, 32, 54, 76):
                profile = "at_risk"   # ~70-74%
            elif num % 3 == 0 or num in (8, 14, 23, 38, 59):
                profile = "watch"     # ~78-83%
            else:
                profile = "safe"      # ~88-95%

            student_roster.append((u, st, sec, profile))

        # ── 7. Student Planned Holidays (for Riya Sharma 26AIML001) ───────────
        riya_student = next((s for u, s, sec, p in student_roster if s.roll_no == "26AIML001"), None)
        if riya_student:
            riya_leaves = [
                (date(2026, 11, 16), "Family Wedding"),
                (date(2026, 11, 17), "Family Wedding (Travel)"),
                (date(2026, 11, 20), "Tech Symposium & Hackathon"),
            ]
            for l_date, l_reason in riya_leaves:
                existing_leave = _session.scalar(
                    select(StudentHolidayModel).where(
                        StudentHolidayModel.student_id == riya_student.user_id,
                        StudentHolidayModel.holiday_date == l_date,
                    )
                )
                if not existing_leave:
                    sh = StudentHolidayModel(
                        student_id=riya_student.user_id,
                        holiday_date=l_date,
                        reason=l_reason,
                        is_future_plan=True,
                        created_at=datetime.now(timezone.utc),
                    )
                    _session.add(sh)
                    counts["student_holidays"] += 1
            _session.flush()

        # ── 8. Generate Held Class Sessions ───────────────────────────────────
        # Monday to Friday between 2026-07-01 and 2026-10-24, skipping institutional holidays
        held_dates: list[date] = []
        curr = sem_start
        while curr <= reference_today:
            # Weekdays Mon-Fri (0..4) and not an institutional holiday
            if curr.weekday() < 5 and curr not in hol_date_set:
                held_dates.append(curr)
            curr += timedelta(days=1)

        # Clean old attendance and sessions for these courses to guarantee clean scenario
        all_c_ids = [c.id for c in course_models.values()]
        _session.execute(
            delete(AttendanceRecordModel).where(
                AttendanceRecordModel.session_id.in_(
                    select(ClassSessionModel.id).where(ClassSessionModel.course_id.in_(all_c_ids))
                )
            )
        )
        _session.execute(
            delete(ClassSessionModel).where(ClassSessionModel.course_id.in_(all_c_ids))
        )
        _session.flush()

        # Distribute sessions across courses: 2-3 sessions per week per course
        # Total held dates is ~80 days. For each course, choose exactly 34 held dates evenly.
        course_sessions: dict[int, list[ClassSessionModel]] = {}
        for c_idx, c in enumerate(course_models.values()):
            c_dates = [d for idx, d in enumerate(held_dates) if (idx + c_idx) % 2 == 0 or (idx % 5 == c_idx % 5)][:34]
            session_list = []
            for d in c_dates:
                cs = ClassSessionModel(course_id=c.id, held_on=d, is_cancelled=False)
                _session.add(cs)
                session_list.append(cs)
                counts["sessions"] += 1
            course_sessions[c.id] = session_list
        _session.flush()

        # ── 9. Populate Realistic Diverse Attendance Records ─────────────────
        now_dt = datetime.now(timezone.utc)
        instructor_id = faculty_users["rajesh.faculty@acadflow.edu"].id

        for u, st, sec, profile in student_roster:
            for c_code, c in course_models.items():
                sessions = course_sessions[c.id]
                total_s = len(sessions)

                # Determine target attended count
                if profile == "riya":
                    targets = {
                        "AIML501": 23,
                        "AIML502": 28,
                        "AIML503": 31,
                        "AIML504": 26,
                        "AIML505": 21,
                        "AIML506": 32,
                    }
                    target_att = targets.get(c_code, 28)
                elif profile == "safe":
                    # 88% - 95% (30 to 32 out of 34)
                    target_att = random.randint(30, min(33, total_s))
                elif profile == "watch":
                    # 78% - 83% (26 to 28 out of 34)
                    target_att = random.randint(26, 28)
                elif profile == "at_risk":
                    # 68% - 74% (23 to 25 out of 34)
                    target_att = random.randint(23, 25)
                else:  # critical
                    # 48% - 58% (16 to 20 out of 34)
                    target_att = random.randint(16, 20)

                # Randomize which sessions were missed, with slight negative trend for at_risk/critical
                miss_count = max(0, total_s - target_att)
                miss_indices = set()
                if profile in ("at_risk", "critical"):
                    # Missed recent sessions
                    miss_indices.update(range(total_s - min(3, miss_count), total_s))
                
                # Fill remaining misses randomly across earlier sessions
                remaining_candidates = [i for i in range(total_s) if i not in miss_indices]
                if len(miss_indices) < miss_count and remaining_candidates:
                    miss_indices.update(random.sample(remaining_candidates, min(miss_count - len(miss_indices), len(remaining_candidates))))

                for idx, cs in enumerate(sessions):
                    if idx in miss_indices:
                        st_val = "absent"
                    else:
                        st_val = "present"

                    rec = AttendanceRecordModel(
                        session_id=cs.id,
                        student_id=st.user_id,
                        status=st_val,
                        marked_by=instructor_id,
                        marked_at=now_dt,
                    )
                    _session.add(rec)
                    counts["attendance"] += 1
        _session.flush()

        # ── 10. Rooms & Timetable Setup ───────────────────────────────────────
        room_101 = _get_or_create(_session, RoomModel, {"name": "Room 101"}, {"capacity": 60})
        room_102 = _get_or_create(_session, RoomModel, {"name": "Room 102"}, {"capacity": 60})
        lab_201 = _get_or_create(_session, RoomModel, {"name": "AI Lab 101"}, {"capacity": 40})
        lab_202 = _get_or_create(_session, RoomModel, {"name": "System Design Lab 301"}, {"capacity": 40})

        tv = _session.scalar(
            select(TimetableVersionModel).where(
                TimetableVersionModel.department_id == aiml_dept.id,
                TimetableVersionModel.status == "published",
            )
        )
        if not tv:
            tv = TimetableVersionModel(
                department_id=aiml_dept.id,
                semester_id=sem.id,
                status="published",
                created_by=faculty_users["meera.coord@acadflow.edu"].id,
                effective_from="2026-07-01",
            )
            _session.add(tv)
            _session.flush()

        # Clear existing slots for clean rebuild
        _session.execute(delete(TimetableSlotModel).where(TimetableSlotModel.version_id == tv.id))
        _session.flush()

        # Build full schedule grid for all 5 sections (A, B, C, D, E)
        # Period mapping: P1 (09:00-10:00), P2 (10:00-11:00), P3 (11:15-12:15), P4 (12:15-13:15), P5 (14:00-15:00), P6 (15:00-16:00)
        # Days: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat
        slot_definitions = []
        for sec in sections:
            # Section A detailed schedule:
            if sec == "A":
                sec_slots = [
                    (0, "P1", "AIML501", "rajesh.faculty@acadflow.edu", room_101.id, "lecture"),
                    (0, "P2", "AIML502", "sneha.faculty@acadflow.edu", room_101.id, "lecture"),
                    (0, "P3", "AIML503", "vikram.faculty@acadflow.edu", room_101.id, "lecture"),
                    (0, "P5", "AIML504", "ananya.faculty@acadflow.edu", room_102.id, "tutorial"),
                    (1, "P1", "AIML505", "rajesh.faculty@acadflow.edu", lab_201.id, "lecture"),
                    (1, "P2", "AIML506", "arjun.faculty@acadflow.edu", room_101.id, "lecture"),
                    (1, "P3", "AIML501", "rajesh.faculty@acadflow.edu", lab_201.id, "lab"),
                    (1, "P4", "AIML501", "rajesh.faculty@acadflow.edu", lab_201.id, "lab"),
                    (2, "P1", "AIML502", "sneha.faculty@acadflow.edu", room_101.id, "lecture"),
                    (2, "P2", "AIML503", "vikram.faculty@acadflow.edu", room_101.id, "lecture"),
                    (2, "P3", "AIML504", "ananya.faculty@acadflow.edu", room_101.id, "lecture"),
                    (2, "P5", "AIML505", "rajesh.faculty@acadflow.edu", lab_201.id, "lab"),
                    (3, "P1", "AIML504", "ananya.faculty@acadflow.edu", room_101.id, "lecture"),
                    (3, "P2", "AIML505", "rajesh.faculty@acadflow.edu", room_101.id, "lecture"),
                    (3, "P3", "AIML506", "arjun.faculty@acadflow.edu", room_101.id, "lecture"),
                    (3, "P5", "AIML502", "sneha.faculty@acadflow.edu", room_102.id, "tutorial"),
                    (4, "P1", "AIML501", "rajesh.faculty@acadflow.edu", room_101.id, "lecture"),
                    (4, "P2", "AIML503", "vikram.faculty@acadflow.edu", lab_202.id, "lab"),
                    (4, "P3", "AIML503", "vikram.faculty@acadflow.edu", lab_202.id, "lab"),
                    (4, "P4", "AIML506", "arjun.faculty@acadflow.edu", room_101.id, "lecture"),
                    (5, "P1", "AIML502", "sneha.faculty@acadflow.edu", room_101.id, "lecture"),
                    (5, "P2", "AIML504", "ananya.faculty@acadflow.edu", room_102.id, "tutorial"),
                ]
            else:
                sec_slots = [
                    (0, "P1", "AIML502", "sneha.faculty@acadflow.edu", room_102.id, "lecture"),
                    (0, "P2", "AIML503", "vikram.faculty@acadflow.edu", room_102.id, "lecture"),
                    (0, "P3", "AIML501", "rajesh.faculty@acadflow.edu", room_102.id, "lecture"),
                    (1, "P1", "AIML504", "ananya.faculty@acadflow.edu", room_102.id, "lecture"),
                    (1, "P2", "AIML505", "rajesh.faculty@acadflow.edu", lab_201.id, "lecture"),
                    (2, "P1", "AIML506", "arjun.faculty@acadflow.edu", room_102.id, "lecture"),
                    (2, "P2", "AIML501", "rajesh.faculty@acadflow.edu", room_102.id, "lecture"),
                    (3, "P1", "AIML503", "vikram.faculty@acadflow.edu", lab_202.id, "lab"),
                    (4, "P1", "AIML505", "rajesh.faculty@acadflow.edu", lab_201.id, "lab"),
                ]

            for day, period, c_code, t_email, rid, kind in sec_slots:
                cid = course_models[c_code].id
                tid = faculty_users[t_email].id
                slot = TimetableSlotModel(
                    version_id=tv.id,
                    course_id=cid,
                    section=sec,
                    teacher_id=tid,
                    room_id=rid,
                    day=day,
                    period_label=period,
                    kind=kind,
                )
                _session.add(slot)
                counts["timetable_slots"] += 1
        _session.flush()

        # ── 11. Recompute and Persist Risk Snapshots for All 100 Students ────
        print("[INFO] Computing risk snapshots for all 100 students across 6 courses...")
        for u, st, sec, profile in student_roster:
            for c in course_models.values():
                persist_risk_snapshot(_session, st.user_id, c.id)
                counts["risk_snapshots"] += 1

        _session.commit()
        print(f"[SUCCESS] Seeded Semester 5 Scenario successfully: {counts}")
        return counts

    except Exception as e:
        _session.rollback()
        print(f"[ERROR] Seeding failed: {e}")
        raise
    finally:
        if not session:
            _session.close()


if __name__ == "__main__":
    seed_semester5()
