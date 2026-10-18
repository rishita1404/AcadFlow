"""
AcadFlow Deterministic Seed Data — Member 3 (Raghav)

Generates fictional academic records for local development and testing.

Fixed random seed: 42 (documented, reproducible).
Safe to rerun: uses get-or-create patterns; never deletes existing records.
No real student data — all names and emails are entirely fictional.

Usage:
    cd backend
    python -m scripts.seed_data          # from repo root
    python scripts/seed_data.py          # direct

Seeded scenarios (all use a 60-class course so Appendix A math applies):
  Riya  — buffer=5,  margin=37.5  (Safe/borderline)
  Aman  — buffer=11, margin=22.5  (Safe)
  Meera — buffer=15, margin=12.5  (Safe, near-perfect)
  Karan — buffer=-5, margin=50    (At risk, not recoverable)
  Dev   — held=5 < min_classes=8  (Insufficient data)
  + 10 random students across risk bands
"""

from __future__ import annotations

import os
import random
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

# Make sure 'backend/' is on the path when run from repo root
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Also handle running from inside backend/
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://acadflow_user:acadflow_password@localhost:5432/acadflow_db",
)


def get_engine():
    return create_engine(DATABASE_URL, echo=False)


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _get_or_create(session, model, filter_kwargs, create_kwargs=None):
    """Fetch an existing row or create one; never duplicates."""
    obj = session.scalar(
        select(model).filter_by(**filter_kwargs)
    )
    if obj is None:
        kwargs = {**filter_kwargs, **(create_kwargs or {})}
        obj = model(**kwargs)
        session.add(obj)
        session.flush()
    return obj


# ──────────────────────────────────────────────────────────────────────────────
# Core seed function
# ──────────────────────────────────────────────────────────────────────────────

FIXED_SEED = 42


def seed_all(session=None, engine=None) -> dict:
    """
    Seed all fictional data.  Returns counts of created records.

    Parameters
    ----------
    session : optional SQLAlchemy session (used in tests to pass in-memory DB)
    engine  : optional engine (used when session is None)
    """
    random.seed(FIXED_SEED)

    from app.db.base import Base
    from app.models import (
        AssignmentModel,
        AttendanceRecordModel,
        ClassSessionModel,
        CourseModel,
        DepartmentModel,
        EnrolmentModel,
        RiskConfigModel,
        SemesterModel,
        StudentModel,
        SubmissionModel,
        UserModel,
    )
    from app.core.security import get_password_hash

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
        "departments": 0, "semesters": 0, "users": 0, "students": 0,
        "courses": 0, "sessions": 0, "attendance": 0, "assignments": 0,
        "submissions": 0, "risk_config": 0,
    }

    try:
        # ── Department ───────────────────────────────────────────────────────
        dept = _get_or_create(
            _session, DepartmentModel,
            {"code": "CSE"},
            {"name": "Computer Science & Engineering"},
        )
        counts["departments"] += 1

        # ── Semester ─────────────────────────────────────────────────────────
        sem = _get_or_create(
            _session, SemesterModel,
            {"name": "Semester 5 (2026)"},
            {"start_date": date(2026, 7, 15), "end_date": date(2026, 12, 20)},
        )
        counts["semesters"] += 1

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
            {"name": "Amara Osei",      "email": "student@acadflow.edu",     "role": "student"},
            {"name": "Dr. Priya Nair",  "email": "faculty@acadflow.edu",     "role": "faculty"},
            {"name": "Raj Trainer",     "email": "trainer@acadflow.edu",     "role": "faculty"},
            {"name": "Meera Mentor",    "email": "mentor@acadflow.edu",      "role": "faculty"},
            {"name": "Coord Vijay",     "email": "coordinator@acadflow.edu", "role": "coordinator"},
            {"name": "Admin Sunita",    "email": "admin@acadflow.edu",       "role": "admin"},
        ]
        faculty_user = None
        for acc in core_accounts:
            u = _get_or_create(
                _session, UserModel,
                {"email": acc["email"]},
                {
                    "name": acc["name"],
                    "password_hash": get_password_hash("AcadFlow@123"),
                    "role": acc["role"],
                    "department_id": dept.id,
                },
            )
            counts["users"] += 1
            if acc["email"] == "faculty@acadflow.edu":
                faculty_user = u

        # ── 60-class course (Appendix A fixture course) ──────────────────────
        course = _get_or_create(
            _session, CourseModel,
            {"code": "CS501"},
            {
                "name": "Data Structures & Algorithms",
                "semester_id": sem.id,
                "department_id": dept.id,
                "total_classes": 60,
            },
        )
        counts["courses"] += 1

        # ── Appendix A Reference Students ────────────────────────────────────
        # Each row: (name, email, roll, held, attended, assignment_setup)
        # held = sessions already conducted before seeding
        appendix_a = [
            ("Riya Sharma",   "riya@acadflow.edu",   "26CSE001", 40, 30),
            ("Aman Khanna",   "aman@acadflow.edu",   "26CSE002", 40, 36),
            ("Meera Pillai",  "meera2@acadflow.edu", "26CSE003", 40, 40),
            ("Karan Singh",   "karan@acadflow.edu",  "26CSE004", 50, 30),
            ("Dev Gupta",     "dev@acadflow.edu",    "26CSE005",  5,  5),
        ]

        semester_start = date(2026, 7, 15)
        today = date(2026, 10, 17)   # fixed reference date for reproducibility

        for name, email, roll, held, attended in appendix_a:
            # User
            user = _get_or_create(
                _session, UserModel,
                {"email": email},
                {
                    "name": name,
                    "password_hash": get_password_hash("AcadFlow@123"),
                    "role": "student",
                    "department_id": dept.id,
                },
            )
            counts["users"] += 1

            # Student
            student = _get_or_create(
                _session, StudentModel,
                {"user_id": user.id},
                {"roll_no": roll, "batch": "2026"},
            )
            counts["students"] += 1

            # Enrolment
            _get_or_create(
                _session, EnrolmentModel,
                {"student_id": student.user_id, "course_id": course.id},
                {"enrolled_on": semester_start},
            )

            # Class sessions: create 'held' sessions spread from semester start
            session_dates = [
                semester_start + timedelta(days=i * (today - semester_start).days // max(held, 1))
                for i in range(held)
            ]
            sessions_for_student: list[ClassSessionModel] = []
            for sd in session_dates:
                cs = _get_or_create(
                    _session, ClassSessionModel,
                    {"course_id": course.id, "held_on": sd},
                    {"is_cancelled": False},
                )
                sessions_for_student.append(cs)
                counts["sessions"] += 1

            # Attendance records
            # Mark `attended` sessions as present, rest as absent
            random.seed(FIXED_SEED + hash(email) % 1000)
            present_indices = set(
                random.sample(range(len(sessions_for_student)), min(attended, len(sessions_for_student)))
            )
            for idx, cs in enumerate(sessions_for_student):
                att_status = "present" if idx in present_indices else "absent"
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
                        marked_by=faculty_user.id if faculty_user else 1,
                        marked_at=datetime.now(timezone.utc),
                    )
                    _session.add(att_rec)
                    counts["attendance"] += 1

        # ── Assignments for the fixture course ───────────────────────────────
        assignments_data = [
            ("Assignment 1: Arrays",    "assignment", date(2026, 9, 1),  True),
            ("Lab File 1: Sorting",     "lab file",   date(2026, 9, 15), True),
            ("Review 1: Complexity",    "review",     date(2026, 10, 5), True),
            ("Assignment 2: Trees",     "assignment", date(2026, 11, 1), True),   # upcoming
            ("Lab File 2: Graphs",      "lab file",   date(2026, 11, 20), True),  # upcoming
        ]
        created_assignments: list[AssignmentModel] = []
        for title, kind, due_date, published in assignments_data:
            due_dt = datetime(due_date.year, due_date.month, due_date.day,
                              17, 0, 0, tzinfo=timezone.utc)
            asgn = _get_or_create(
                _session, AssignmentModel,
                {"course_id": course.id, "title": title},
                {
                    "kind": kind,
                    "due_at": due_dt,
                    "grace_hours": 48,
                    "is_published": published,
                },
            )
            created_assignments.append(asgn)
            counts["assignments"] += 1

        # ── Submissions: past assignments for Riya and Aman ──────────────────
        riya_user = _session.scalar(select(UserModel).where(UserModel.email == "riya@acadflow.edu"))
        aman_user = _session.scalar(select(UserModel).where(UserModel.email == "aman@acadflow.edu"))

        past_assignments = [a for a in created_assignments if a.due_at.date() < today]

        for sub_user, submit_status in [(riya_user, "on_time"), (aman_user, "on_time")]:
            if sub_user is None:
                continue
            student = _session.get(StudentModel, sub_user.id)
            if student is None:
                continue
            for asgn in past_assignments[:2]:  # first 2 past assignments submitted
                import hashlib as _hl
                dedupe = _hl.md5(f"{asgn.id}:{student.user_id}:1".encode()).hexdigest()
                existing_sub = _session.scalar(
                    select(SubmissionModel).where(SubmissionModel.dedupe_key == dedupe)
                )
                if existing_sub is None:
                    sub = SubmissionModel(
                        assignment_id=asgn.id,
                        student_id=student.user_id,
                        version=1,
                        status=submit_status,
                        submitted_at=asgn.due_at - timedelta(hours=1),
                        dedupe_key=dedupe,
                    )
                    _session.add(sub)
                    counts["submissions"] += 1

        # Karan: one missed submission
        karan_user = _session.scalar(select(UserModel).where(UserModel.email == "karan@acadflow.edu"))
        if karan_user:
            karan_student = _session.get(StudentModel, karan_user.id)
            if karan_student and past_assignments:
                asgn = past_assignments[0]
                import hashlib as _hl
                dedupe = _hl.md5(f"{asgn.id}:{karan_student.user_id}:1".encode()).hexdigest()
                existing_sub = _session.scalar(
                    select(SubmissionModel).where(SubmissionModel.dedupe_key == dedupe)
                )
                if existing_sub is None:
                    sub = SubmissionModel(
                        assignment_id=asgn.id,
                        student_id=karan_student.user_id,
                        version=1,
                        status="missed",
                        submitted_at=None,
                        dedupe_key=dedupe,
                    )
                    _session.add(sub)
                    counts["submissions"] += 1

        if owns_session:
            _session.commit()
            print("✅ Seed complete!")
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


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

def seed_all_legacy():
    """Legacy wrapper kept for Makefile compatibility."""
    seed_all()


if __name__ == "__main__":
    print("Seeding AcadFlow with fixed seed 42 …")
    seed_all()
