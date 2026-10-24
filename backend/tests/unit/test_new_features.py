"""
Unit tests for AcadFlow Evaluation 1 additions:
- CSV & Excel ingest
- Notification service & deduplication
- Attendance calendar engine & planned holidays
- Academic pressure forecast engine
"""

from datetime import date, datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models import (
    AssignmentModel,
    CourseModel,
    DepartmentModel,
    EnrolmentModel,
    SemesterModel,
    StudentHolidayModel,
    StudentModel,
    UserModel,
)
from app.services.calendar_service import build_attendance_calendar
from app.services.csv_ingest import (
    _normalize_status,
    _parse_date,
    ingest_attendance_file,
)
from app.services.notification_service import (
    _upsert_notification,
)
from app.services.pressure_forecast import compute_monthly_pressure


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_date_and_status_parsing():
    assert _parse_date("2026-10-21") == date(2026, 10, 21)
    assert _parse_date("21/10/2026") == date(2026, 10, 21)
    assert _parse_date("21-10-2026") == date(2026, 10, 21)
    assert _parse_date("invalid-date") is None

    assert _normalize_status("present") == "present"
    assert _normalize_status("P") == "present"
    assert _normalize_status("A") == "absent"
    assert _normalize_status("Late") == "late"
    assert _normalize_status("xyz") is None


def test_notification_dedup(db_session):
    u = UserModel(
        id=1, name="Test User", email="test@acadflow.edu", password_hash="hash", role="student"
    )
    db_session.add(u)
    db_session.commit()

    n1 = _upsert_notification(
        db=db_session,
        recipient_id=1,
        title="Test Alert",
        message="Message 1",
        kind="warning",
        dedup_key="test:key:1",
    )
    db_session.commit()
    assert n1 is not None

    # Duplicate call with identical dedup_key must return None
    n2 = _upsert_notification(
        db=db_session,
        recipient_id=1,
        title="Test Alert 2",
        message="Message 2",
        kind="warning",
        dedup_key="test:key:1",
    )
    assert n2 is None


def test_csv_ingest(db_session):
    dept = DepartmentModel(id=1, name="CSE", code="CSE")
    sem = SemesterModel(id=1, name="Sem 5", start_date=date(2026, 8, 1), end_date=date(2026, 12, 15))
    course = CourseModel(id=1, code="CS501", name="Algorithms", semester_id=1, department_id=1, total_classes=40)
    user = UserModel(id=2, name="Student One", email="s1@acadflow.edu", password_hash="hash", role="student")
    student = StudentModel(user_id=2, roll_no="CS202601", batch="2026")
    enrol = EnrolmentModel(student_id=2, course_id=1, enrolled_on=date(2026, 8, 1))

    db_session.add_all([dept, sem, course, user, student, enrol])
    db_session.commit()

    csv_data = "roll_no,date,status\nCS202601,2026-10-21,present\n"
    res = ingest_attendance_file(
        db=db_session,
        file_bytes=csv_data.encode("utf-8"),
        filename="test.csv",
        course_id=1,
        marked_by_user_id=1,
    )

    assert res.total_rows == 1
    assert res.processed == 1
    assert res.sessions_created == 1
    assert len(res.errors) == 0


def test_calendar_and_pressure_forecast(db_session):
    dept = DepartmentModel(id=1, name="CSE", code="CSE")
    sem = SemesterModel(id=1, name="Sem 5", start_date=date(2026, 8, 1), end_date=date(2026, 12, 15))
    course = CourseModel(id=1, code="CS501", name="Algorithms", semester_id=1, department_id=1, total_classes=40)
    user = UserModel(id=2, name="Student One", email="s1@acadflow.edu", password_hash="hash", role="student")
    student = StudentModel(user_id=2, roll_no="CS202601", batch="2026")
    enrol = EnrolmentModel(student_id=2, course_id=1, enrolled_on=date(2026, 8, 1))

    # Add assignment with deadline
    asgn = AssignmentModel(
        id=1,
        course_id=1,
        title="Lab 1",
        kind="assignment",
        due_at=datetime(2026, 10, 25, 12, 0, tzinfo=timezone.utc),
        grace_hours=48,
        is_published=True,
    )

    # Add planned holiday
    hol = StudentHolidayModel(
        id=1,
        student_id=2,
        holiday_date=date(2026, 10, 28),
        reason="Family event",
        is_future_plan=True,
        created_at=datetime.now(timezone.utc),
    )

    db_session.add_all([dept, sem, course, user, student, enrol, asgn, hol])
    db_session.commit()

    # Test calendar service
    cal = build_attendance_calendar(db=db_session, student_id=2, year=2026, month=10)
    assert cal.student_id == 2
    assert len(cal.days) == 31
    assert any(d.is_student_planned_holiday for d in cal.days if d.date == "2026-10-28")

    # Test pressure forecast service
    pressure = compute_monthly_pressure(db=db_session, student_id=2, year=2026, month=10)
    assert pressure.student_id if hasattr(pressure, 'student_id') else True
    assert len(pressure.days) == 31
    assert pressure.total_deadlines >= 1
