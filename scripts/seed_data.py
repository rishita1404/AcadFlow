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
    sync_url = DATABASE_URL
    if sync_url.startswith("postgresql+asyncpg://"):
        sync_url = sync_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
    elif sync_url.startswith("postgresql://"):
        sync_url = sync_url.replace("postgresql://", "postgresql+psycopg://")
    # Try PostgreSQL first, fall back to file-based SQLite (same db the server uses)
    try:
        engine = create_engine(sync_url, echo=False, connect_args={"connect_timeout": 3})
        engine.connect().close()
        return engine
    except Exception:
        sqlite_path = str(BACKEND_DIR / "acadflow.db")
        print(f"[INFO] PostgreSQL unavailable, seeding into SQLite: {sqlite_path}")
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

        # Student model for core student
        _get_or_create(
            _session, StudentModel,
            {"user_id": core_users["student@acadflow.edu"].id},
            {"roll_no": "26CSE000", "batch": "2026"},
        )
        counts["students"] += 1

        # Dean assignment
        _get_or_create(
            _session, DeanAssignmentModel,
            {"user_id": core_users["coordinator@acadflow.edu"].id, "department_id": primary_dept.id}
        )
        counts["dean_assignments"] += 1

        # ── 6 Courses ────────────────────────────────────────────────────────
        courses_def = [
            ("CS501", "Data Structures & Algorithms", primary_dept.id, 60),
            ("CS502", "Operating Systems", primary_dept.id, 45),
            ("AI501", "Machine Learning Systems", dept_map["AIDS"].id, 45),
            ("EC501", "Digital Signal Processing", dept_map["ECE"].id, 45),
            ("CS503", "Database Management Systems", primary_dept.id, 50),
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
            {"course_id": cs501.id, "user_id": core_users["trainer@acadflow.edu"].id, "role": "trainer"}
        )
        _get_or_create(
            _session, CourseStaffModel,
            {"course_id": courses_map["CS503"].id, "user_id": core_users["mentor@acadflow.edu"].id, "role": "course_coordinator"}
        )
        counts["course_staff"] += 3

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

            # Assign to mentor
            _get_or_create(
                _session, MentorAssignmentModel,
                {"mentor_id": core_users["mentor@acadflow.edu"].id, "student_id": student.user_id}
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

        # ── 500 Total Students: Seed 494 additional synthetic students ────────
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
        students_needed = max(0, 500 - existing_students_count)

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
            ]
            room_map: dict[str, RoomModel] = {}
            for rname, cap, rtype in rooms_def:
                rm = _get_or_create(
                    _session, RoomModel,
                    {"name": rname},
                    {"capacity": cap, "room_type": rtype},
                )
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
                    status="published",
                    effective_from=str(semester_start),
                    created_by=core_users["coordinator@acadflow.edu"].id,
                    published_at=str(datetime.now(timezone.utc)),
                )
                _session.add(tv)
                _session.flush()
            counts.setdefault("timetable_versions", 0)
            counts["timetable_versions"] += 1

            # Period configs: Mon-Fri (days 0-4)
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
            for day_offset in range(5):  # Mon-Fri
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
            _session.flush()
            counts.setdefault("period_configs", 0)
            counts["period_configs"] += 40  # 5 days × 8 periods

            # Timetable slots
            # CS501 (DSA) — Dr. Priya, Mon P1, Wed P1, Fri P1 — Room 101
            # CS502 (OS)  — Dr. Priya, Tue P2, Thu P2          — Room 101 (deliberate clash with CS503 on Thu P2)
            # CS503 (DBMS)— Meera Mentor, Mon P3, Thu P2       — Lab 201  (Thu P2 clashes with CS502)
            # AI501       — Raj Trainer, Tue P1                 — Seminar 301
            slots_def = [
                (courses_map["CS501"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 101"].id, 0, "P1", "A", "lecture"),
                (courses_map["CS501"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 101"].id, 2, "P1", "A", "lecture"),
                (courses_map["CS501"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 101"].id, 4, "P1", "A", "lecture"),
                (courses_map["CS502"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 101"].id, 1, "P2", "A", "lecture"),
                (courses_map["CS502"].id, core_users["faculty@acadflow.edu"].id, room_map["Room 101"].id, 3, "P2", "A", "lecture"),  # clash: Dr Priya Thu P2 vs Mentor Thu P2 same room
                (courses_map["CS503"].id, core_users["mentor@acadflow.edu"].id, room_map["Lab 201"].id, 0, "P3", "A", "lecture"),
                (courses_map["CS503"].id, core_users["mentor@acadflow.edu"].id, room_map["Room 101"].id, 3, "P2", "A", "lecture"),  # same room as CS502 on Thu P2 = room clash
                (courses_map["AI501"].id, core_users["trainer@acadflow.edu"].id, room_map["Seminar 301"].id, 1, "P1", "A", "lecture"),
            ]
            for course_id, teacher_id, room_id, day, period, section, kind in slots_def:
                existing_slot = _session.scalar(
                    select(TimetableSlotModel).where(
                        TimetableSlotModel.version_id == tv.id,
                        TimetableSlotModel.course_id == course_id,
                        TimetableSlotModel.day == day,
                        TimetableSlotModel.period_label == period,
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
                    category="general",
                    urgent=False,
                    status="sent",
                    audience_spec='{"type":"department","department_id":1}',
                    created_at=datetime(2026, 7, 15, 8, 0, 0, tzinfo=timezone.utc),
                )
                _session.add(general_notice)
                _session.flush()
                # Deliver to all app_a_students
                for st in app_a_students:
                    _session.add(NoticeRecipientModel(
                        notice_id=general_notice.id,
                        user_id=st.user_id,
                        delivered_at=datetime(2026, 7, 15, 8, 0, 0, tzinfo=timezone.utc),
                        seen_at=datetime(2026, 7, 15, 10, 0, 0, tzinfo=timezone.utc),
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

        if owns_session:
            _session.commit()
            print("[OK] Seed complete! AcadFlow is populated with 500 students.")
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
    print("Seeding AcadFlow with fixed seed 42 (500 students, 6 courses) ...")
    seed_all()
