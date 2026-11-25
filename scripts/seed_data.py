"""
AcadFlow Deterministic Seed Data — Member 3 (Raghav) & Team.

Generates complete fictional academic records for local development, testing,
and Evaluation 1 submission.

Features:
- Fixed random seed: 42 (documented, reproducible).
- Safe to rerun: uses get-or-create patterns; never duplicates existing records.
- 500 total synthetic students across 3 departments (CSE, ECE, AIDS) and batches (2024, 2025, 2026).
- 6 core role accounts (student, faculty, trainer, mentor, coordinator, admin).
- 6 courses with varying total_classes.
- Full Appendix A reference fixtures (Riya, Aman, Meera, Karan, Dev).
- Mentor and Dean assignments.
- Course staff roles (instructor, trainer, course_coordinator).
- Academic calendar holidays.
"""

from __future__ import annotations

import json
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

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://acadflow_user:acadflow_password@localhost:5432/acadflow_db",
)


def get_engine():
    use_postgres = os.environ.get("USE_POSTGRES", "").lower() in ("true", "1", "yes")
    if use_postgres:
        sync_url = DATABASE_URL
        if sync_url.startswith("postgresql+asyncpg://"):
            sync_url = sync_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
        elif sync_url.startswith("postgresql://"):
            sync_url = sync_url.replace("postgresql://", "postgresql+psycopg://")
        try:
            engine = create_engine(sync_url, echo=False, connect_args={"connect_timeout": 5})
            engine.connect().close()
            print(f"[INFO] Seeding into PostgreSQL: {sync_url.split('@')[-1]}")
            return engine
        except Exception as exc:
            print(f"[WARN] PostgreSQL unavailable ({exc}); falling back to SQLite.")

    sqlite_path = os.environ.get("ACADFLOW_DB_PATH", str(BACKEND_DIR / "acadflow.db"))
    print(f"[INFO] Seeding into SQLite: {sqlite_path}")
    return create_engine(
        f"sqlite:///{sqlite_path}",
        connect_args={"check_same_thread": False, "timeout": 30},
        echo=False,
    )


def reset_database(engine=None):
    """Drop and recreate all tables before seeding."""
    import app.models  # noqa: F401
    from app.db.base import Base

    if engine is None:
        engine = get_engine()
    print("[RESET] Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("[RESET] Recreating schema...")
    Base.metadata.create_all(bind=engine)
    return engine


def _get_or_create(session, model, filter_kwargs, create_kwargs=None):
    obj = session.scalar(select(model).filter_by(**filter_kwargs))
    if obj is None:
        kwargs = {**filter_kwargs, **(create_kwargs or {})}
        obj = model(**kwargs)
        session.add(obj)
        session.flush()
    return obj


FIXED_SEED = 42


def seed_all(session=None, engine=None) -> dict:
    random.seed(FIXED_SEED)

    from app.core.security import get_password_hash
    from app.db.base import Base
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
        OrganizationModel,
        RiskConfigModel,
        SemesterModel,
        StudentModel,
        SubmissionModel,
        UserModel,
    )

    if session is None:
        if engine is None:
            engine = get_engine()
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        _session = Session()
        owns_session = True
    else:
        _session = session
        owns_session = False

    counts: dict[str, int] = {
        "organizations": 0,
        "departments": 0,
        "semesters": 0,
        "holidays": 0,
        "users": 0,
        "students": 0,
        "courses": 0,
        "course_staff": 0,
        "mentor_assignments": 0,
        "dean_assignments": 0,
        "sessions": 0,
        "attendance": 0,
        "assignments": 0,
        "submissions": 0,
        "risk_config": 0,
    }

    try:
        # Precompute password hash once for all seed accounts (huge performance win)
        shared_password_hash = get_password_hash("AcadFlow@123")

        # ── Organization ─────────────────────────────────────────────────────
        org = _get_or_create(
            _session, OrganizationModel,
            {"name": "AcadFlow Institute of Technology"}
        )
        counts["organizations"] += 1

        # ── Departments ──────────────────────────────────────────────────────
        depts_data = [
            ("CSE", "Computer Science & Engineering"),
            ("ECE", "Electronics & Communication Engineering"),
            ("AIDS", "Artificial Intelligence & Data Science"),
        ]
        dept_map: dict[str, DepartmentModel] = {}
        for code, name in depts_data:
            d = _get_or_create(_session, DepartmentModel, {"code": code}, {"name": name})
            dept_map[code] = d
            counts["departments"] += 1

        primary_dept = dept_map["CSE"]

        # ── Semester ─────────────────────────────────────────────────────────
        sem = _get_or_create(
            _session, SemesterModel,
            {"name": "Semester 5 (2026)"},
            {"start_date": date(2026, 7, 15), "end_date": date(2026, 12, 20)},
        )
        counts["semesters"] += 1

        # ── Holidays ─────────────────────────────────────────────────────────
        holidays_data = [
            (date(2026, 8, 15), "Independence Day"),
            (date(2026, 10, 2), "Gandhi Jayanti"),
            (date(2026, 10, 20), "Dussehra"),
            (date(2026, 11, 10), "Diwali Break"),
        ]
        for h_date, label in holidays_data:
            _get_or_create(
                _session, HolidayModel,
                {"semester_id": sem.id, "holiday_date": h_date},
                {"label": label},
            )
            counts["holidays"] += 1

        # ── Risk Config ──────────────────────────────────────────────────────
        existing_config = _session.scalar(select(RiskConfigModel))
        if existing_config is None:
            config = RiskConfigModel(
                w_margin=Decimal("50"), w_trend=Decimal("20"),
                w_deadline=Decimal("20"), w_missed=Decimal("10"),
                t_watch=Decimal("30"), t_risk=Decimal("55"),
                t_critical=Decimal("80"), min_classes=8, version="v1",
            )
            _session.add(config)
            _session.flush()
            counts["risk_config"] += 1

        # ── 6 Core Role Accounts ─────────────────────────────────────────────
        core_accounts = [
            {"name": "Amara Osei",     "email": "student@acadflow.edu",     "role": "student"},
            {"name": "Dr. Priya Nair", "email": "faculty@acadflow.edu",     "role": "faculty"},
            {"name": "Raj Trainer",    "email": "trainer@acadflow.edu",     "role": "faculty"},
            {"name": "Meera Mentor",   "email": "mentor@acadflow.edu",      "role": "faculty"},
            {"name": "Coord Vijay",    "email": "coordinator@acadflow.edu", "role": "coordinator"},
            {"name": "Admin Sunita",   "email": "admin@acadflow.edu",       "role": "admin"},
        ]
        core_users: dict[str, UserModel] = {}
        for acc in core_accounts:
            u = _get_or_create(
                _session, UserModel,
                {"email": acc["email"]},
                {
                    "name": acc["name"],
                    "password_hash": shared_password_hash,
                    "role": acc["role"],
                    "department_id": primary_dept.id,
                    "organization_id": org.id,
                },
            )
            core_users[acc["email"]] = u
            counts["users"] += 1

        # Student model for core student (Section A, Batch 2024, CSE)
        core_student = _get_or_create(
            _session, StudentModel,
            {"user_id": core_users["student@acadflow.edu"].id},
            {"roll_no": "24CSE000", "batch": "2024", "section": "A"},
        )
        core_student.batch = "2024"
        core_student.section = "A"
        counts["students"] += 1

        # Classmate in Section A, Student in Section B, and Scope-Proof ECE Dept accounts
        extra_accounts = [
            ("Ananya Verma",   "classmate@acadflow.edu",    "student",     primary_dept.id, "24CSE002", "2024", "A"),
            ("Kabir Malhotra", "student_secb@acadflow.edu", "student",     primary_dept.id, "24CSE099", "2024", "B"),
            ("Prof. ECE Dean", "dean_ece@acadflow.edu",     "coordinator", dept_map["ECE"].id, None, None, None),
            ("Dr. ECE Faculty","faculty_ece@acadflow.edu",  "faculty",     dept_map["ECE"].id, None, None, None),
            ("Esha ECE",       "student_ece@acadflow.edu",  "student",     dept_map["ECE"].id, "24ECE001", "2024", "A"),
        ]
        extra_users: dict[str, UserModel] = {}
        for name, email, role, dept_id, roll, batch, sec in extra_accounts:
            eu = _get_or_create(
                _session, UserModel,
                {"email": email},
                {
                    "name": name,
                    "password_hash": shared_password_hash,
                    "role": role,
                    "department_id": dept_id,
                    "organization_id": org.id,
                },
            )
            extra_users[email] = eu
            counts["users"] += 1
            if roll:
                st = _get_or_create(
                    _session, StudentModel,
                    {"user_id": eu.id},
                    {"roll_no": roll, "batch": batch, "section": sec},
                )
                st.batch = batch
                st.section = sec
                counts["students"] += 1

        # Dean assignment (CSE + ECE)
        _get_or_create(
            _session, DeanAssignmentModel,
            {"user_id": core_users["coordinator@acadflow.edu"].id, "department_id": primary_dept.id}
        )
        _get_or_create(
            _session, DeanAssignmentModel,
            {"user_id": extra_users["dean_ece@acadflow.edu"].id, "department_id": dept_map["ECE"].id}
        )
        counts["dean_assignments"] += 2

        # ── 8 Courses (5 CSE + 2 AIDS + 1 ECE) ───────────────────────────────
        courses_def = [
            ("CS501", "Data Structures & Algorithms", primary_dept.id, 60),
            ("CS502", "Operating Systems", primary_dept.id, 45),
            ("AI501", "Machine Learning Systems", dept_map["AIDS"].id, 45),
            ("EC501", "Digital Signal Processing", dept_map["ECE"].id, 45),
            ("CS503", "Database Management Systems", primary_dept.id, 50),
            ("CS504", "Computer Networks", primary_dept.id, 45),
            ("CS505", "Software Engineering", primary_dept.id, 40),
            ("AI502", "Cloud Architecture & DevOps", dept_map["AIDS"].id, 40),
        ]
        courses_map: dict[str, CourseModel] = {}
        for code, name, dept_id, total_classes in courses_def:
            c = _get_or_create(
                _session, CourseModel,
                {"code": code},
                {"name": name, "semester_id": sem.id, "department_id": dept_id, "total_classes": total_classes},
            )
            courses_map[code] = c
            counts["courses"] += 1

        cs501 = courses_map["CS501"]

        # ── Course Staff Roles ───────────────────────────────────────────────
        _get_or_create(
            _session, CourseStaffModel,
            {"course_id": cs501.id, "user_id": core_users["faculty@acadflow.edu"].id, "role": "instructor"}
        )
        _get_or_create(
            _session, CourseStaffModel,
            {"course_id": courses_map["CS502"].id, "user_id": core_users["faculty@acadflow.edu"].id, "role": "instructor"}
        )
        _get_or_create(
            _session, CourseStaffModel,
            {"course_id": cs501.id, "user_id": core_users["trainer@acadflow.edu"].id, "role": "trainer"}
        )
        _get_or_create(
            _session, CourseStaffModel,
            {"course_id": courses_map["CS503"].id, "user_id": core_users["mentor@acadflow.edu"].id},
            {"role": "course_coordinator"},
        )
        _get_or_create(
            _session, CourseStaffModel,
            {"course_id": courses_map["CS504"].id, "user_id": core_users["faculty@acadflow.edu"].id, "role": "instructor"},
        )
        _get_or_create(
            _session, CourseStaffModel,
            {"course_id": courses_map["CS505"].id, "user_id": core_users["faculty@acadflow.edu"].id, "role": "instructor"},
        )
        _get_or_create(
            _session, CourseStaffModel,
            {"course_id": courses_map["EC501"].id, "user_id": extra_users["faculty_ece@acadflow.edu"].id},
            {"role": "instructor"},
        )
        counts["course_staff"] += 7

        # Enrol core student, classmate, secB student, and ECE student
        core_stu_id = core_users["student@acadflow.edu"].id
        classmate_id = extra_users["classmate@acadflow.edu"].id
        secb_id = extra_users["student_secb@acadflow.edu"].id
        ece_stu_id = extra_users["student_ece@acadflow.edu"].id

        for sid in (core_stu_id, classmate_id):
            for ccode in ("CS501", "CS502", "CS503", "CS504", "CS505"):
                _get_or_create(
                    _session, EnrolmentModel,
                    {"student_id": sid, "course_id": courses_map[ccode].id},
                    {"enrolled_on": date(2026, 7, 15)},
                )
            for mid in (core_users["mentor@acadflow.edu"].id, core_users["faculty@acadflow.edu"].id):
                _get_or_create(
                    _session, MentorAssignmentModel,
                    {"mentor_id": mid, "student_id": sid},
                )
        _get_or_create(
            _session, EnrolmentModel,
            {"student_id": secb_id, "course_id": cs501.id},
            {"enrolled_on": date(2026, 7, 15)},
        )
        _get_or_create(
            _session, EnrolmentModel,
            {"student_id": ece_stu_id, "course_id": courses_map["EC501"].id},
            {"enrolled_on": date(2026, 7, 15)},
        )

        # ── Appendix A Reference Students ────────────────────────────────────
        appendix_a = [
            ("Riya Sharma",   "riya@acadflow.edu",   "26CSE001", 40, 30),
            ("Aman Khanna",   "aman@acadflow.edu",   "26CSE002", 40, 36),
            ("Meera Pillai",  "meera2@acadflow.edu", "26CSE003", 40, 40),
            ("Karan Singh",   "karan@acadflow.edu",  "26CSE004", 50, 30),
            ("Dev Gupta",     "dev@acadflow.edu",    "26CSE005",  5,  5),
        ]

        semester_start = date(2026, 7, 15)
        today = date(2026, 10, 17)

        # Pre-create class sessions for CS501 up to 50 sessions
        session_dates = [
            semester_start + timedelta(days=i * 2)
            for i in range(50)
        ]
        created_sessions: list[ClassSessionModel] = []
        for sd in session_dates:
            cs = _get_or_create(
                _session, ClassSessionModel,
                {"course_id": cs501.id, "held_on": sd},
                {"is_cancelled": False},
            )
            created_sessions.append(cs)
            counts["sessions"] += 1

        app_a_students: list[StudentModel] = []
        for name, email, roll, held, attended in appendix_a:
            user = _get_or_create(
                _session, UserModel,
                {"email": email},
                {
                    "name": name,
                    "password_hash": shared_password_hash,
                    "role": "student",
                    "department_id": primary_dept.id,
                    "organization_id": org.id,
                },
            )
            counts["users"] += 1

            student = _get_or_create(
                _session, StudentModel,
                {"user_id": user.id},
                {"roll_no": roll, "batch": "2026"},
            )
            app_a_students.append(student)
            counts["students"] += 1

            _get_or_create(
                _session, EnrolmentModel,
                {"student_id": student.user_id, "course_id": cs501.id},
                {"enrolled_on": semester_start},
            )

            # Assign to mentor and faculty/mentor
            for mid in (core_users["mentor@acadflow.edu"].id, core_users["faculty@acadflow.edu"].id):
                _get_or_create(
                    _session, MentorAssignmentModel,
                    {"mentor_id": mid, "student_id": student.user_id}
                )
            counts["mentor_assignments"] += 1

            # Mark attendance records
            relevant_sessions = created_sessions[:held]
            for idx, cs in enumerate(relevant_sessions):
                att_status = "present" if idx < attended else "absent"
                existing_att = _session.scalar(
                    select(AttendanceRecordModel).where(
                        AttendanceRecordModel.session_id == cs.id,
                        AttendanceRecordModel.student_id == student.user_id,
                    )
                )
                if existing_att is None:
                    att_rec = AttendanceRecordModel(
                        session_id=cs.id,
                        student_id=student.user_id,
                        status=att_status,
                        marked_by=core_users["faculty@acadflow.edu"].id,
                        marked_at=datetime.now(timezone.utc),
                    )
                    _session.add(att_rec)
                    counts["attendance"] += 1

        # ── Assignments for CS501 ────────────────────────────────────────────
        assignments_data = [
            ("Assignment 1: Arrays",    "assignment", date(2026, 9, 1),  True),
            ("Lab File 1: Sorting",     "lab file",   date(2026, 9, 15), True),
            ("Review 1: Complexity",    "review",     date(2026, 10, 5), True),
            ("Assignment 2: Trees",     "assignment", date(2026, 11, 1), True),
            ("Lab File 2: Graphs",      "lab file",   date(2026, 11, 20), True),
        ]
        created_assignments: list[AssignmentModel] = []
        for title, kind, due_date, published in assignments_data:
            due_dt = datetime(due_date.year, due_date.month, due_date.day, 17, 0, 0, tzinfo=timezone.utc)
            asgn = _get_or_create(
                _session, AssignmentModel,
                {"course_id": cs501.id, "title": title},
                {"kind": kind, "due_at": due_dt, "grace_hours": 48, "is_published": published},
            )
            created_assignments.append(asgn)
            counts["assignments"] += 1

        # Submissions for Riya, Aman, Karan
        past_assignments = [a for a in created_assignments if a.due_at.date() < today]
        for sid in [app_a_students[0].user_id, app_a_students[1].user_id]:
            for asgn in past_assignments[:2]:
                dedupe = f"{asgn.id}:{sid}:1"
                if not _session.scalar(select(SubmissionModel).where(SubmissionModel.dedupe_key == dedupe)):
                    sub = SubmissionModel(
                        assignment_id=asgn.id,
                        student_id=sid,
                        version=1,
                        status="on_time",
                        submitted_at=asgn.due_at - timedelta(hours=1),
                        dedupe_key=dedupe,
                    )
                    _session.add(sub)
                    counts["submissions"] += 1

        # Karan missed submission
        karan_sid = app_a_students[3].user_id
        if past_assignments:
            dedupe_karan = f"{past_assignments[0].id}:{karan_sid}:1"
            if not _session.scalar(select(SubmissionModel).where(SubmissionModel.dedupe_key == dedupe_karan)):
                sub = SubmissionModel(
                    assignment_id=past_assignments[0].id,
                    student_id=karan_sid,
                    version=1,
                    status="missed",
                    submitted_at=None,
                    dedupe_key=dedupe_karan,
                )
                _session.add(sub)
                counts["submissions"] += 1

        # ── 20 Total Students: Seed additional synthetic students ────────
        # Batches: 2026 (first year / 5th sem), 2025, 2024
        # Departments: CSE, ECE, AIDS
        first_names = [
            "Aarav", "Aditi", "Akash", "Ananya", "Arjun", "Bhavna", "Chirag", "Deepika",
            "Eshaan", "Gauri", "Harsh", "Ishita", "Jay", "Kavya", "Manish", "Neha",
            "Nikhil", "Pooja", "Pranav", "Radhika", "Rohit", "Sneha", "Tarun", "Varun"
        ]
        last_names = [
            "Agarwal", "Bose", "Chawla", "Deshmukh", "Goyal", "Iyer", "Joshi", "Kapoor",
            "Malhotra", "Mehta", "Patel", "Rao", "Reddy", "Saxena", "Sen", "Verma"
        ]

        existing_students_count = _session.scalar(select(func.count(StudentModel.user_id))) or 0
        students_needed = max(0, 20 - existing_students_count)

        if students_needed > 0:
            dept_keys = ["CSE", "ECE", "AIDS"]
            batches = ["2026", "2025", "2024"]

            new_users = []
            new_students = []
            new_enrolments = []

            for i in range(1, students_needed + 1):
                idx = existing_students_count + i
                d_key = dept_keys[i % len(dept_keys)]
                dept_obj = dept_map[d_key]
                batch_val = batches[i % len(batches)]
                fn = first_names[i % len(first_names)]
                ln = last_names[(i * 3) % len(last_names)]
                s_name = f"{fn} {ln}"
                s_email = f"student_{idx:03d}@acadflow.edu"
                s_roll = f"{batch_val[-2:]}{d_key}{idx:04d}"

                u = UserModel(
                    name=s_name,
                    email=s_email,
                    password_hash=shared_password_hash,
                    role="student",
                    department_id=dept_obj.id,
                    organization_id=org.id,
                )
                _session.add(u)
                _session.flush()

                st = StudentModel(
                    user_id=u.id,
                    roll_no=s_roll,
                    batch=batch_val,
                )
                _session.add(st)
                _session.flush()

                # Enrol in CS501 and another departmental course
                _session.add(EnrolmentModel(student_id=u.id, course_id=cs501.id, enrolled_on=semester_start))
                dept_course = courses_map["AI501"] if d_key == "AIDS" else (courses_map["EC501"] if d_key == "ECE" else courses_map["CS502"])
                _session.add(EnrolmentModel(student_id=u.id, course_id=dept_course.id, enrolled_on=semester_start))

                counts["users"] += 1
                counts["students"] += 1

        # ── Phase 8: Rooms, Timetable, Notices, Planned Absences ─────────────
        try:
            from app.models.timetable import (
                RoomModel, TimetableVersionModel, PeriodConfigModel, TimetableSlotModel
            )
            from app.models.notice import NoticeModel, NoticeRecipientModel, NoticeDeadlineModel
            from app.models.student_holiday import StudentHolidayModel

            # Rooms
            rooms_def = [
                ("Room 101", 60, "classroom"),
                ("Lab 201",  30, "lab"),
                ("Seminar 301", 40, "seminar"),
                ("Room 102", 60, "classroom"),
                ("Lab 202",  30, "lab"),
            ]
            room_map: dict[str, RoomModel] = {}
            for rname, cap, rtype in rooms_def:
                rm = _get_or_create(
                    _session, RoomModel,
                    {"name": rname},
                    {"capacity": cap, "room_type": rtype, "department_id": primary_dept.id},
                )
                if rm.department_id is None:
                    rm.department_id = primary_dept.id
                room_map[rname] = rm

            counts.setdefault("rooms", 0)
            counts["rooms"] += len(rooms_def)

            # Timetable version (published) for CSE dept, sem 5
            tv = _session.scalar(
                select(TimetableVersionModel).where(
                    TimetableVersionModel.department_id == primary_dept.id,
                    TimetableVersionModel.semester_id == sem.id,
                    TimetableVersionModel.status == "published",
                )
            )
            if tv is None:
                tv = TimetableVersionModel(
                    department_id=primary_dept.id,
                    semester_id=sem.id,
                    name="Autumn 2026 Production",
                    status="published",
                    effective_from=str(semester_start),
                    created_by=core_users["coordinator@acadflow.edu"].id,
                    published_at=str(datetime.now(timezone.utc)),
                    is_published_with_conflicts=False,
                    conflicts_json="[]",
                )
                _session.add(tv)
                _session.flush()
            else:
                if not tv.name:
                    tv.name = "Autumn 2026 Production"
                tv.is_published_with_conflicts = False
                tv.conflicts_json = "[]"
            counts.setdefault("timetable_versions", 0)
            counts["timetable_versions"] += 1

            # Draft Timetable version for testing editing and non-blocking clashes
            draft_tv = _session.scalar(
                select(TimetableVersionModel).where(
                    TimetableVersionModel.department_id == primary_dept.id,
                    TimetableVersionModel.semester_id == sem.id,
                    TimetableVersionModel.status == "draft",
                )
            )
            if draft_tv is None:
                draft_tv = TimetableVersionModel(
                    department_id=primary_dept.id,
                    semester_id=sem.id,
                    name="Spring 2027 Draft",
                    status="draft",
                    effective_from=str(date(2027, 1, 15)),
                    created_by=core_users["coordinator@acadflow.edu"].id,
                    is_published_with_conflicts=False,
                    conflicts_json="[]",
                )
                _session.add(draft_tv)
                _session.flush()
                counts["timetable_versions"] += 1

            # Period configs: Mon-Sat (days 0-5)
            PERIODS = [
                (0, "09:00", "10:00", "P1", False),
                (0, "10:00", "11:00", "P2", False),
                (0, "11:00", "11:15", "Break", True),
                (0, "11:15", "12:15", "P3", False),
                (0, "12:15", "13:15", "P4", False),
                (0, "13:15", "14:00", "Lunch", True),
                (0, "14:00", "15:00", "P5", False),
                (0, "15:00", "16:00", "P6", False),
            ]
            for day_offset in range(6):  # Mon-Sat
                for _, start, end, label, is_brk in PERIODS:
                    existing_pc = _session.scalar(
                        select(PeriodConfigModel).where(
                            PeriodConfigModel.version_id == tv.id,
                            PeriodConfigModel.day == day_offset,
                            PeriodConfigModel.label == label,
                        )
                    )
                    if existing_pc is None:
                        _session.add(PeriodConfigModel(
                            version_id=tv.id,
                            day=day_offset,
                            start_time=start,
                            end_time=end,
                            label=label,
                            is_break=is_brk,
                        ))
                    if draft_tv:
                        draft_pc = _session.scalar(
                            select(PeriodConfigModel).where(
                                PeriodConfigModel.version_id == draft_tv.id,
                                PeriodConfigModel.day == day_offset,
                                PeriodConfigModel.label == label,
                            )
                        )
                        if draft_pc is None:
                            _session.add(PeriodConfigModel(
                                version_id=draft_tv.id,
                                day=day_offset,
                                start_time=start,
                                end_time=end,
                                label=label,
                                is_break=is_brk,
                            ))
            _session.flush()
            counts.setdefault("period_configs", 0)
            counts["period_configs"] += 48  # 6 days × 8 periods

            # Timetable slots — zero overlaps across Mon-Sat (days 0-5) for all 5 CSE subjects
            slots_def = [
                # Monday (0)
                (courses_map["CS501"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 101"].id, 0, "P1", "A", "lecture", "09:00", "10:00"),
                (courses_map["CS502"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 101"].id, 0, "P2", "A", "lecture", "10:00", "11:00"),
                (courses_map["CS503"].id, core_users["mentor@acadflow.edu"].id, room_map["Lab 201"].id, 0, "P3", "A", "lab", "11:15", "12:15"),
                (courses_map["CS504"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 102"].id, 0, "P4", "A", "lecture", "12:15", "13:15"),
                (courses_map["CS501"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 102"].id, 0, "P5", "B", "lecture", "14:00", "15:00"),
                # Tuesday (1)
                (courses_map["CS505"].id, core_users["faculty@acadflow.edu"].id, room_map["Seminar 301"].id, 1, "P1", "A", "lecture", "09:00", "10:00"),
                (courses_map["CS502"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 101"].id, 1, "P2", "A", "lecture", "10:00", "11:00"),
                (courses_map["CS504"].id, core_users["faculty@acadflow.edu"].id, room_map["Lab 201"].id, 1, "P3", "A", "lab", "11:15", "12:15"),
                (courses_map["CS503"].id, core_users["mentor@acadflow.edu"].id, room_map["Room 101"].id, 1, "P5", "A", "lecture", "14:00", "15:00"),
                # Wednesday (2)
                (courses_map["CS501"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 101"].id, 2, "P1", "A", "lecture", "09:00", "10:00"),
                (courses_map["CS504"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 102"].id, 2, "P2", "A", "lecture", "10:00", "11:00"),
                (courses_map["CS505"].id, core_users["faculty@acadflow.edu"].id, room_map["Seminar 301"].id, 2, "P4", "A", "lecture", "12:15", "13:15"),
                (courses_map["CS502"].id, core_users["faculty@acadflow.edu"].id, room_map["Lab 201"].id, 2, "P5", "A", "lab", "14:00", "15:00"),
                # Thursday (3)
                (courses_map["CS505"].id, core_users["faculty@acadflow.edu"].id, room_map["Seminar 301"].id, 3, "P1", "A", "lecture", "09:00", "10:00"),
                (courses_map["CS502"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 101"].id, 3, "P2", "A", "lecture", "10:00", "11:00"),
                (courses_map["CS503"].id, core_users["mentor@acadflow.edu"].id, room_map["Room 101"].id, 3, "P3", "A", "lecture", "11:15", "12:15"),
                (courses_map["CS501"].id, core_users["faculty@acadflow.edu"].id, room_map["Lab 201"].id, 3, "P5", "A", "lab", "14:00", "15:00"),
                # Friday (4)
                (courses_map["CS501"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 101"].id, 4, "P1", "A", "lecture", "09:00", "10:00"),
                (courses_map["CS503"].id, core_users["mentor@acadflow.edu"].id, room_map["Room 101"].id, 4, "P2", "A", "lecture", "10:00", "11:00"),
                (courses_map["CS504"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 102"].id, 4, "P3", "A", "lecture", "11:15", "12:15"),
                (courses_map["CS505"].id, core_users["faculty@acadflow.edu"].id, room_map["Seminar 301"].id, 4, "P4", "A", "lecture", "12:15", "13:15"),
                # Saturday (5)
                (courses_map["CS502"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 101"].id, 5, "P1", "A", "tutorial", "09:00", "10:00"),
                (courses_map["CS504"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 102"].id, 5, "P2", "A", "tutorial", "10:00", "11:00"),
                (courses_map["CS505"].id, core_users["faculty@acadflow.edu"].id, room_map["Seminar 301"].id, 5, "P3", "A", "tutorial", "11:15", "12:15"),
            ]
            for course_id, teacher_id, room_id, day, period, section, kind, s_time, e_time in slots_def:
                existing_slot = _session.scalar(
                    select(TimetableSlotModel).where(
                        TimetableSlotModel.version_id == tv.id,
                        TimetableSlotModel.course_id == course_id,
                        TimetableSlotModel.day == day,
                        TimetableSlotModel.period_label == period,
                        TimetableSlotModel.section == section,
                    )
                )
                if existing_slot is None:
                    _session.add(TimetableSlotModel(
                        version_id=tv.id,
                        course_id=course_id,
                        section=section,
                        teacher_id=teacher_id,
                        room_id=room_id,
                        day=day,
                        period_label=period,
                        kind=kind,
                        start_time=s_time,
                        end_time=e_time,
                    ))
                else:
                    if not existing_slot.start_time:
                        existing_slot.start_time = s_time
                    if not existing_slot.end_time:
                        existing_slot.end_time = e_time

            # Slots for draft version
            if draft_tv:
                draft_slots_def = [
                    (courses_map["CS501"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 101"].id, 0, "P1", "A", "lecture", "09:00", "10:00"),
                    (courses_map["CS502"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 102"].id, 1, "P2", "A", "lecture", "10:00", "11:00"),
                    (courses_map["CS503"].id, core_users["mentor@acadflow.edu"].id, room_map["Lab 201"].id, 2, "P3", "B", "lab", "11:15", "12:15"),
                ]
                for course_id, teacher_id, room_id, day, period, section, kind, s_time, e_time in draft_slots_def:
                    existing_dslot = _session.scalar(
                        select(TimetableSlotModel).where(
                            TimetableSlotModel.version_id == draft_tv.id,
                            TimetableSlotModel.course_id == course_id,
                            TimetableSlotModel.day == day,
                            TimetableSlotModel.period_label == period,
                            TimetableSlotModel.section == section,
                        )
                    )
                    if existing_dslot is None:
                        _session.add(TimetableSlotModel(
                            version_id=draft_tv.id,
                            course_id=course_id,
                            section=section,
                            teacher_id=teacher_id,
                            room_id=room_id,
                            day=day,
                            period_label=period,
                            kind=kind,
                            start_time=s_time,
                            end_time=e_time,
                        ))
            _session.flush()
            counts.setdefault("timetable_slots", 0)
            counts["timetable_slots"] += len(slots_def)

            # Notices — 2 sample notices
            faculty_user = core_users["faculty@acadflow.edu"]
            coord_user   = core_users["coordinator@acadflow.edu"]
            riya_student = app_a_students[0]  # Riya Sharma

            # 1) General announcement
            general_notice = _session.scalar(
                select(NoticeModel).where(
                    NoticeModel.sender_id == coord_user.id,
                    NoticeModel.title == "Welcome to Semester 5",
                )
            )
            if general_notice is None:
                general_notice = NoticeModel(
                    sender_id=coord_user.id,
                    title="Welcome to Semester 5",
                    body=(
                        "Dear students, welcome to Semester 5 (July–December 2026). "
                        "Please ensure you have enrolled in all your courses via the portal. "
                        "Attendance regularization requests must be submitted within 48 hours "
                        "of the missed class. Minimum attendance requirement remains 75%."
                    ),
                    category="circular",
                    priority="normal",
                    urgent=False,
                    status="sent",
                    audience_spec='{"type":"department","department_id":1}',
                    audience_summary="Whole Department (CSE)",
                    created_at=datetime(2026, 7, 15, 8, 0, 0, tzinfo=timezone.utc),
                )
                _session.add(general_notice)
                _session.flush()
                # Deliver to all app_a_students
                for st in app_a_students:
                    _session.add(NoticeRecipientModel(
                        notice_id=general_notice.id,
                        user_id=st.user_id,
                        reason="Student in Department (CSE)",
                        delivered_at=datetime(2026, 7, 15, 8, 0, 0, tzinfo=timezone.utc),
                        seen_at=datetime(2026, 7, 15, 10, 0, 0, tzinfo=timezone.utc),
                        read_at=datetime(2026, 7, 15, 10, 0, 0, tzinfo=timezone.utc),
                    ))

            # 2) Hackathon / exam notice WITH confirmed deadline
            from datetime import datetime as dt2
            exam_notice = _session.scalar(
                select(NoticeModel).where(
                    NoticeModel.sender_id == faculty_user.id,
                    NoticeModel.title == "Mid-Semester Exam Notice & DSA Lab Project",
                )
            )
            if exam_notice is None:
                exam_notice = NoticeModel(
                    sender_id=faculty_user.id,
                    title="Mid-Semester Exam Notice & DSA Lab Project",
                    body=(
                        "The mid-semester examination for CS501 (Data Structures & Algorithms) "
                        "is scheduled for 15 November 2026. Additionally, the DSA Lab Project "
                        "submission deadline is 10 November 2026 before 5 PM. "
                        "Students must submit via the portal. Late submissions attract a 10% "
                        "penalty per day. Please plan accordingly and attend all remaining classes."
                    ),
                    category="exam",
                    urgent=True,
                    status="sent",
                    audience_spec=f'{{"type":"course","course_id":{courses_map["CS501"].id}}}',
                    created_at=datetime(2026, 10, 20, 9, 30, 0, tzinfo=timezone.utc),
                )
                _session.add(exam_notice)
                _session.flush()

                # Confirmed deadlines from this notice
                _session.add(NoticeDeadlineModel(
                    notice_id=exam_notice.id,
                    kind="exam",
                    at="2026-11-15T09:00:00+05:30",
                    label="CS501 Mid-Semester Exam",
                    source="extracted",
                    confirmed_by=faculty_user.id,
                ))
                _session.add(NoticeDeadlineModel(
                    notice_id=exam_notice.id,
                    kind="submission",
                    at="2026-11-10T17:00:00+05:30",
                    label="DSA Lab Project Submission Deadline",
                    source="extracted",
                    confirmed_by=faculty_user.id,
                ))

                # Deliver to all CS501-enrolled app_a_students (Riya, Aman, Meera, Karan, Dev)
                for st in app_a_students:
                    _session.add(NoticeRecipientModel(
                        notice_id=exam_notice.id,
                        user_id=st.user_id,
                        delivered_at=datetime(2026, 10, 20, 9, 30, 0, tzinfo=timezone.utc),
                    ))
                # Riya has seen it
                riya_rec = _session.scalar(
                    select(NoticeRecipientModel).where(
                        NoticeRecipientModel.notice_id == exam_notice.id,
                        NoticeRecipientModel.user_id == riya_student.user_id,
                    )
                )
                if riya_rec:
                    riya_rec.seen_at = datetime(2026, 10, 20, 11, 0, 0, tzinfo=timezone.utc)
            _session.flush()
            counts.setdefault("notices", 0)
            counts["notices"] += 2

            # Planned absences for Riya (2 upcoming dates)
            riya_user_id = riya_student.user_id
            upcoming_1 = date(2026, 11, 3)
            upcoming_2 = date(2026, 11, 5)
            for plan_date, reason in [
                (upcoming_1, "Family function"),
                (upcoming_2, "Medical appointment"),
            ]:
                existing_h = _session.scalar(
                    select(StudentHolidayModel).where(
                        StudentHolidayModel.student_id == riya_user_id,
                        StudentHolidayModel.holiday_date == plan_date,
                    )
                )
                if existing_h is None:
                    _session.add(StudentHolidayModel(
                        student_id=riya_user_id,
                        holiday_date=plan_date,
                        reason=reason,
                        is_future_plan=True,
                        created_at=datetime.now(timezone.utc),
                    ))
            _session.flush()
            counts.setdefault("planned_absences", 0)
            counts["planned_absences"] += 2

        except Exception as ph8_err:
            print(f"[WARN] Phase 8 seed skipped: {ph8_err}")

        # ── Phase 9: AI-ML Department, Faculty, Subjects & Sections ──────────
        try:
            from scripts.seed_aiml_department import seed_aiml
            aiml_counts = seed_aiml(session=_session, engine=engine)
            counts.update({f"aiml_{k}": v for k, v in aiml_counts.items()})
        except Exception as aiml_err:
            print(f"[WARN] AIML seed notice: {aiml_err}")

        # ── Phase 2: Synthetic Leave Requests & Condonation Requests ─────────
        try:
            from app.models.leave import LeaveRequestModel, CondonationRequestModel

            today = date.today()
            riya_id = app_a_students[0].user_id
            aman_id = app_a_students[1].user_id
            meera_id = app_a_students[2].user_id
            karan_id = app_a_students[3].user_id
            dev_id = app_a_students[4].user_id if len(app_a_students) > 4 else app_a_students[0].user_id
            mentor_user_id = core_users.get("mentor@acadflow.edu", core_users.get("faculty@acadflow.edu")).id
            dean_user_id = core_users.get("coordinator@acadflow.edu", core_users.get("admin@acadflow.edu")).id
            sem_id = sem.id if sem else 1

            # 1. Riya: Approved medical leave (historical, 10-8 days ago)
            if not _session.scalar(select(LeaveRequestModel).where(LeaveRequestModel.student_id == riya_id)):
                _session.add(LeaveRequestModel(
                    student_id=riya_id,
                    type="medical",
                    date_from=today - timedelta(days=12),
                    date_to=today - timedelta(days=10),
                    reason="Viral fever recovery and medical rest",
                    status="approved",
                    decided_by=mentor_user_id,
                    decided_at=datetime.now(timezone.utc) - timedelta(days=9),
                    decision_note="Approved. Medical prescription submitted to clinic.",
                    created_at=datetime.now(timezone.utc) - timedelta(days=13),
                ))
                counts.setdefault("leave_requests", 0)
                counts["leave_requests"] += 1

            # 2. Aman: Pending duty leave
            if not _session.scalar(select(LeaveRequestModel).where(LeaveRequestModel.student_id == aman_id)):
                _session.add(LeaveRequestModel(
                    student_id=aman_id,
                    type="duty",
                    date_from=today + timedelta(days=2),
                    date_to=today + timedelta(days=4),
                    reason="Representing university at Smart India Hackathon finals",
                    status="pending",
                    created_at=datetime.now(timezone.utc),
                ))
                counts.setdefault("leave_requests", 0)
                counts["leave_requests"] += 1

            # 3. Karan: Recommended condonation request
            if not _session.scalar(select(CondonationRequestModel).where(CondonationRequestModel.student_id == karan_id)):
                _session.add(CondonationRequestModel(
                    student_id=karan_id,
                    semester_id=sem_id,
                    attendance_pct_at_request=Decimal("68.50"),
                    reason="Hospitalized for knee fracture surgery during midterms.",
                    status="recommended",
                    recommended_by=mentor_user_id,
                    created_at=datetime.now(timezone.utc) - timedelta(days=3),
                ))
                counts.setdefault("condonation_requests", 0)
                counts["condonation_requests"] += 1

            # 4. Dev: Approved condonation request by Dean
            if not _session.scalar(select(CondonationRequestModel).where(CondonationRequestModel.student_id == dev_id)):
                _session.add(CondonationRequestModel(
                    student_id=dev_id,
                    semester_id=sem_id,
                    attendance_pct_at_request=Decimal("71.00"),
                    reason="Inter-university sports tournament duty leaves accumulation.",
                    status="approved",
                    recommended_by=mentor_user_id,
                    decided_by=dean_user_id,
                    decided_at=datetime.now(timezone.utc) - timedelta(days=1),
                    decision_note="Approved based on official sports department recommendation letter.",
                    created_at=datetime.now(timezone.utc) - timedelta(days=5),
                ))
                counts.setdefault("condonation_requests", 0)
                counts["condonation_requests"] += 1

            # ── Phase 3: Synthetic Interventions ─────────────────────────────
            from app.models.intervention import InterventionModel

            if not _session.scalar(select(InterventionModel).where(InterventionModel.student_id == karan_id)):
                _session.add(InterventionModel(
                    student_id=karan_id,
                    created_by=mentor_user_id,
                    kind="talk",
                    note="Discussed catch-up study plan after midterm missed classes. Student agreed to attend office hours.",
                    follow_up_on=today + timedelta(days=3),
                    outcome="open",
                    score_at_creation=Decimal("72.00"),
                    band_at_creation="Critical",
                    created_at=datetime.now(timezone.utc) - timedelta(days=4),
                ))
                counts.setdefault("interventions", 0)
                counts["interventions"] += 1

            if not _session.scalar(select(InterventionModel).where(InterventionModel.student_id == dev_id)):
                _session.add(InterventionModel(
                    student_id=dev_id,
                    created_by=mentor_user_id,
                    kind="call",
                    note="Contacted student regarding lab submission checklist and attendance recovery path.",
                    follow_up_on=today - timedelta(days=1),
                    outcome="recovered",
                    score_at_creation=Decimal("58.00"),
                    band_at_creation="At risk",
                    created_at=datetime.now(timezone.utc) - timedelta(days=10),
                    closed_at=datetime.now(timezone.utc) - timedelta(days=1),
                ))
                counts.setdefault("interventions", 0)
                counts["interventions"] += 1

            # ── Phase 4: Synthetic Multi-Week Risk Snapshots for Trends ─────────
            from app.models.risk import RiskConfigModel, RiskSnapshotModel
            now_dt = datetime.now(timezone.utc)
            course_obj = courses_map.get("CS501") or _session.scalar(select(CourseModel).where(CourseModel.code == "CS501")) or _session.scalar(select(CourseModel))
            c_snap_id = course_obj.id if course_obj else None
            risk_cfg = _session.scalar(select(RiskConfigModel))
            cfg_id = risk_cfg.id if risk_cfg else 1

            students_bands = [
                (riya_id, [("Safe", Decimal("15.0"))] * 8),
                (aman_id, [("Safe", Decimal("18.0"))] * 8),
                (meera_id, [("Safe", Decimal("10.0"))] * 8),
                (karan_id, [("Watch", Decimal("45.0"))] * 3 + [("At risk", Decimal("62.0"))] * 3 + [("Critical", Decimal("78.0"))] * 2),
                (dev_id, [("Critical", Decimal("85.0"))] * 2 + [("At risk", Decimal("65.0"))] * 3 + [("Watch", Decimal("48.0"))] * 3),
            ]
            for stu_id, band_series in students_bands:
                if not stu_id or not c_snap_id:
                    continue
                for w_idx, (b_name, b_score) in enumerate(band_series):
                    snap_time = now_dt - timedelta(days=(7 - w_idx) * 7 + 2)
                    existing_snap = _session.scalar(
                        select(RiskSnapshotModel).where(
                            RiskSnapshotModel.student_id == stu_id,
                            RiskSnapshotModel.computed_at >= snap_time - timedelta(days=2),
                            RiskSnapshotModel.computed_at <= snap_time + timedelta(days=2),
                        )
                    )
                    if not existing_snap:
                        _session.add(RiskSnapshotModel(
                            student_id=stu_id,
                            computed_at=snap_time,
                            score=b_score,
                            band=b_name,
                            worst_course_id=c_snap_id,
                            config_id=cfg_id,
                        ))
                        counts.setdefault("risk_snapshots", 0)
                        counts["risk_snapshots"] += 1

            # ── Phase 5: Synthetic Needs Attention & Upload Batches ─────────────
            from app.models.attendance import AttendanceUploadBatchModel
            batch_exists = _session.scalar(select(AttendanceUploadBatchModel).limit(1))
            faculty_user = core_users.get("faculty@acadflow.edu") or _session.scalar(select(UserModel).where(UserModel.role == "faculty"))
            if not batch_exists and course_obj and faculty_user:
                _session.add(AttendanceUploadBatchModel(
                    course_id=course_obj.id,
                    uploaded_by=faculty_user.id,
                    uploaded_at=now_dt - timedelta(days=2),
                    filename="cs501_attendance_week10.xlsx",
                    records_created=25,
                    records_updated=2,
                    sessions_created=1,
                    backup_data="{}",
                    is_undone=False,
                ))
                counts.setdefault("attendance_batches", 0)
                counts["attendance_batches"] += 1

            # ── Coherent Demo Universe: ensure student@acadflow.edu & scope peers are populated ──
            for stu_uid, present_target in [(core_stu_id, 32), (classmate_id, 36), (secb_id, 34)]:
                for idx, cs in enumerate(created_sessions[:40]):
                    if not _session.scalar(
                        select(AttendanceRecordModel).where(
                            AttendanceRecordModel.session_id == cs.id,
                            AttendanceRecordModel.student_id == stu_uid,
                        )
                    ):
                        _session.add(AttendanceRecordModel(
                            session_id=cs.id,
                            student_id=stu_uid,
                            status="present" if idx < present_target else "absent",
                            marked_by=core_users["faculty@acadflow.edu"].id,
                            marked_at=now_dt,
                        ))
                        counts["attendance"] += 1

            # CS502, CS503, CS504, CS505 sessions & records for core_stu_id & classmate_id
            extra_course_attendance = [
                ("CS502", 20, 16, 18, "faculty@acadflow.edu", date(2026, 8, 2), 2),
                ("CS503", 12, 8, 11, "mentor@acadflow.edu", date(2026, 8, 1), 3),
                ("CS504", 16, 13, 14, "faculty@acadflow.edu", date(2026, 8, 3), 2),
                ("CS505", 15, 11, 13, "faculty@acadflow.edu", date(2026, 8, 4), 2),
            ]
            for ccode, n_sess, core_pres, mate_pres, marker_email, start_dt, step_days in extra_course_attendance:
                c_obj = courses_map[ccode]
                c_sessions = []
                for i in range(n_sess):
                    sd = start_dt + timedelta(days=i * step_days)
                    cs_s = _get_or_create(
                        _session, ClassSessionModel,
                        {"course_id": c_obj.id, "held_on": sd},
                        {"is_cancelled": False},
                    )
                    c_sessions.append(cs_s)
                for stu_uid, pres in [(core_stu_id, core_pres), (classmate_id, mate_pres)]:
                    for idx, cs_s in enumerate(c_sessions):
                        if not _session.scalar(
                            select(AttendanceRecordModel).where(
                                AttendanceRecordModel.session_id == cs_s.id,
                                AttendanceRecordModel.student_id == stu_uid,
                            )
                        ):
                            _session.add(AttendanceRecordModel(
                                session_id=cs_s.id,
                                student_id=stu_uid,
                                status="present" if idx < pres else "absent",
                                marked_by=core_users[marker_email].id,
                                marked_at=now_dt,
                            ))
                            counts["attendance"] += 1
            cs503_obj = courses_map["CS503"]

            # Risk snapshot for core_stu_id so Student Risk & Needs Attention are non-empty
            if not _session.scalar(select(RiskSnapshotModel).where(RiskSnapshotModel.student_id == core_stu_id)):
                _session.add(RiskSnapshotModel(
                    student_id=core_stu_id,
                    computed_at=now_dt - timedelta(days=7),
                    score=Decimal("38.00"),
                    band="watch",
                    worst_course_id=cs503_obj.id,
                    config_id=cfg_id,
                ))
                _session.add(RiskSnapshotModel(
                    student_id=core_stu_id,
                    computed_at=now_dt,
                    score=Decimal("44.00"),
                    band="watch",
                    worst_course_id=cs503_obj.id,
                    config_id=cfg_id,
                ))

            # Deliver general_notice & exam_notice to core_stu_id & classmate_id
            for notice_obj in (general_notice, exam_notice):
                if notice_obj:
                    for uid in (core_stu_id, classmate_id):
                        if not _session.scalar(
                            select(NoticeRecipientModel).where(
                                NoticeRecipientModel.notice_id == notice_obj.id,
                                NoticeRecipientModel.user_id == uid,
                            )
                        ):
                            _session.add(NoticeRecipientModel(
                                notice_id=notice_obj.id,
                                user_id=uid,
                                reason="Section A CSE Sem 5",
                                delivered_at=now_dt - timedelta(days=1),
                            ))

            # Section B notice (must NOT be visible to Section A student@acadflow.edu or ECE student_ece)
            secb_notice = _session.scalar(
                select(NoticeModel).where(NoticeModel.title == "Section B Lab Reschedule")
            )
            if secb_notice is None:
                secb_notice = NoticeModel(
                    sender_id=coord_user.id,
                    title="Section B Lab Reschedule",
                    body="Section B CS501 lab is moved to Room 102 this Friday.",
                    category="circular",
                    priority="normal",
                    urgent=False,
                    status="sent",
                    audience_spec='{"type":"department","department_id":1,"section":"B"}',
                    audience_summary="CSE · Section B",
                    created_at=now_dt - timedelta(hours=6),
                )
                _session.add(secb_notice)
                _session.flush()
                _session.add(NoticeRecipientModel(
                    notice_id=secb_notice.id,
                    user_id=secb_id,
                    reason="Section B student",
                    delivered_at=now_dt - timedelta(hours=6),
                ))

            # Leave requests for core_stu_id in pending, approved (full_day ML & lectures DL), and rejected states
            if not _session.scalar(select(LeaveRequestModel).where(LeaveRequestModel.student_id == core_stu_id)):
                _session.add_all([
                    LeaveRequestModel(
                        student_id=core_stu_id,
                        type="medical",
                        mode="full_day",
                        date_from=today - timedelta(days=1),
                        date_to=today,
                        reason="Medical document: clinic_note.pdf",
                        status="pending",
                        created_at=now_dt - timedelta(hours=4),
                    ),
                    LeaveRequestModel(
                        student_id=core_stu_id,
                        type="duty",
                        mode="lectures",
                        date_from=created_sessions[10].held_on,
                        date_to=created_sessions[10].held_on,
                        lecture_nos="[1, 3]",
                        reason="Inter-College Hackathon — Coding Club — (Participant)",
                        status="approved",
                        decided_by=mentor_user_id,
                        decided_at=now_dt - timedelta(days=12),
                        decision_note="Approved for representing department.",
                        created_at=now_dt - timedelta(days=15),
                    ),
                    LeaveRequestModel(
                        student_id=core_stu_id,
                        type="medical",
                        mode="full_day",
                        date_from=created_sessions[33].held_on,
                        date_to=created_sessions[34].held_on,
                        reason="Viral fever recovery — doctor_certificate.pdf",
                        status="approved",
                        decided_by=mentor_user_id,
                        decided_at=now_dt - timedelta(days=6),
                        decision_note="Approved with medical certificate.",
                        created_at=now_dt - timedelta(days=8),
                    ),
                    LeaveRequestModel(
                        student_id=core_stu_id,
                        type="medical",
                        mode="full_day",
                        date_from=today - timedelta(days=25),
                        date_to=today - timedelta(days=24),
                        reason="Medical leave",
                        status="rejected",
                        decided_by=mentor_user_id,
                        decided_at=now_dt - timedelta(days=23),
                        decision_note="Please upload a signed prescription.",
                        created_at=now_dt - timedelta(days=26),
                    ),
                ])

            # Notifications for core demo accounts
            from app.models.notification import NotificationModel
            demo_notifs = [
                (core_stu_id, "Leave Request Approved", "Your Hackathon duty leave was approved by Meera Mentor.", "info", None, "demo-stu-leave-approved"),
                (core_stu_id, "CS503 Buffer Alert", "Your attendance in CS503 is at 67%. Attend upcoming classes.", "warning", cs503_obj.id, "demo-stu-cs503-warn"),
                (mentor_user_id, "Pending Leave Request", "Aarav Sharma submitted a medical leave request for review.", "reminder", None, "demo-mentor-leave-pending"),
                (dean_user_id, "Condonation Review Needed", "Karan Singh is recommended for condonation by Meera Mentor.", "alert", None, "demo-dean-condonation"),
            ]
            for rec_id, n_title, n_msg, n_kind, n_cid, dkey in demo_notifs:
                if not _session.scalar(select(NotificationModel).where(NotificationModel.dedup_key == dkey)):
                    _session.add(NotificationModel(
                        recipient_id=rec_id,
                        title=n_title,
                        message=n_msg,
                        kind=n_kind,
                        course_id=n_cid,
                        is_read=False,
                        created_at=now_dt,
                        dedup_key=dkey,
                    ))

            # Backfill lecture_no on ClassSessionModel from published TimetableSlotModel
            all_pub_slots = _session.scalars(
                select(TimetableSlotModel)
                .join(TimetableVersionModel, TimetableSlotModel.version_id == TimetableVersionModel.id)
                .where(TimetableVersionModel.status == "published")
            ).all()
            slot_lecture_map: dict[tuple[int, int], int] = {}
            for sl in all_pub_slots:
                lbl = (sl.period_label or "").strip().upper()
                digits = "".join(ch for ch in lbl if ch.isdigit())
                if digits:
                    slot_lecture_map.setdefault((sl.course_id, sl.day), int(digits))

            for cs_row in _session.scalars(select(ClassSessionModel)).all():
                derived_lec = slot_lecture_map.get((cs_row.course_id, cs_row.held_on.weekday()), 1)
                if cs_row.lecture_no != derived_lec:
                    # Only update if no collision with an existing session for same (course_id, held_on, derived_lec)
                    conflict = _session.scalar(
                        select(ClassSessionModel.id).where(
                            ClassSessionModel.course_id == cs_row.course_id,
                            ClassSessionModel.held_on == cs_row.held_on,
                            ClassSessionModel.lecture_no == derived_lec,
                            ClassSessionModel.id != cs_row.id,
                        )
                    )
                    if not conflict:
                        cs_row.lecture_no = derived_lec

            _session.flush()
        except Exception as ph2_err:
            print(f"[WARN] Phase 2 seed notice: {ph2_err}")

        if owns_session:
            _session.commit()
            print("[OK] Seed complete! AcadFlow is populated.")
            for k, v in counts.items():
                print(f"   {k}: {v} created/verified")
        else:
            _session.flush()

    except Exception as exc:
        if owns_session:
            _session.rollback()
        raise exc
    finally:
        if owns_session:
            _session.close()

    return counts


def seed_all_legacy():
    seed_all()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Seed AcadFlow local demo database.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Drop and recreate all tables before seeding.",
    )
    args = parser.parse_args()

    eng = get_engine()
    if args.reset:
        reset_database(engine=eng)
    print("Seeding AcadFlow demo universe ...")
    seed_all(engine=eng)
