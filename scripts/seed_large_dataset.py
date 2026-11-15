"""
AcadFlow Large Scale Synthetic Seed Script (Lab 21 - Evaluation 2).
Generates ~3,000 synthetic student records with varied attendance profiles to test
virtualization (@tanstack/react-virtual) and server-side pagination performance.

DISCLAIMER: This script generates SIMULATED academic data for performance testing.
"""
from __future__ import annotations

import os
import random
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.security import get_password_hash
from app.models import (
    AttendanceRecordModel,
    ClassSessionModel,
    CourseModel,
    DepartmentModel,
    EnrolmentModel,
    RiskSnapshotModel,
    StudentModel,
    UserModel,
)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://acadflow_user:acadflow_password@localhost:5432/acadflow_db",
)


def get_engine():
    sync_url = DATABASE_URL
    if "asyncpg" in sync_url:
        sync_url = sync_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
    try:
        engine = create_engine(sync_url, echo=False, connect_args={"connect_timeout": 2})
        engine.connect().close()
        return engine
    except Exception:
        sqlite_path = str(BACKEND_DIR / "acadflow.db")
        return create_engine(f"sqlite:///{sqlite_path}", echo=False)


FIRST_NAMES = [
    "Aarav", "Aditi", "Akash", "Ananya", "Arjun", "Bhavna", "Chirag", "Deepika",
    "Eshaan", "Farhan", "Gauri", "Harsh", "Ishaan", "Jaya", "Kavya", "Madhav",
    "Neha", "Pranav", "Rohan", "Sanya", "Tanvi", "Varun", "Yash", "Zoya",
]
LAST_NAMES = [
    "Sharma", "Khanna", "Pillai", "Singh", "Gupta", "Deshmukh", "Joshi", "Mehta",
    "Reddy", "Verma", "Chawla", "Iyer", "Malhotra", "Rao", "Nair", "Bose",
    "Patel", "Das", "Menon", "Kapoor", "Chatterjee", "Mishra", "Saxena", "Choudhury",
]


def seed_large_cohort(target_count: int = 3000):
    print(f"[SIMULATED DATA] Seeding ~{target_count} students with varied attendance...")
    engine = get_engine()
    SessionLocal = sessionmaker(bind=engine)
    session: Session = SessionLocal()

    random.seed(42)

    try:
        # Check existing department and courses
        dept = session.scalar(select(DepartmentModel).limit(1))
        if not dept:
            print("Please run basic seed first: python scripts/seed_data.py")
            return

        dept_id = dept.id
        courses = session.scalars(select(CourseModel).where(CourseModel.department_id == dept_id)).all()
        if not courses:
            courses = session.scalars(select(CourseModel)).all()
        if not courses:
            print("No courses found. Run basic seed first.")
            return

        # Check existing count
        existing_count = session.scalar(select(func.count(StudentModel.user_id))) or 0
        to_create = max(0, target_count - existing_count)
        print(f"Existing students: {existing_count}. Generating {to_create} new students...")

        if to_create == 0:
            print("Target student count already reached.")
            return

        default_pw_hash = get_password_hash("AcadFlow@123")
        start_id = (session.scalar(select(func.max(UserModel.id))) or 1000) + 1

        batch_size = 500
        created = 0

        for b in range(0, to_create, batch_size):
            chunk = min(batch_size, to_create - b)
            for i in range(chunk):
                curr_id = start_id + created
                fname = random.choice(FIRST_NAMES)
                lname = random.choice(LAST_NAMES)
                roll = f"26CS{curr_id:04d}"
                email = f"student_{curr_id}@acadflow.edu"

                user = UserModel(
                    id=curr_id,
                    name=f"{fname} {lname}",
                    email=email,
                    password_hash=default_pw_hash,
                    role="student",
                    department_id=dept_id,
                )
                session.add(user)

                student = StudentModel(
                    user_id=curr_id,
                    roll_no=roll,
                    batch="2023-2027",
                )
                session.add(student)

                # Enrol into 4 random courses
                enrolled_courses = random.sample(courses, min(4, len(courses)))
                for c in enrolled_courses:
                    enrolment = EnrolmentModel(
                        student_id=curr_id,
                        course_id=c.id,
                        status="active",
                    )
                    session.add(enrolment)

                # Assign a synthetic risk band: 60% safe, 20% watch, 12% at-risk, 8% critical
                r = random.random()
                if r < 0.60:
                    band = "safe"
                    score = round(random.uniform(5.0, 24.0), 1)
                elif r < 0.80:
                    band = "watch"
                    score = round(random.uniform(25.0, 49.0), 1)
                elif r < 0.92:
                    band = "at_risk"
                    score = round(random.uniform(50.0, 74.0), 1)
                else:
                    band = "critical"
                    score = round(random.uniform(75.0, 95.0), 1)

                snap = RiskSnapshotModel(
                    student_id=curr_id,
                    course_id=enrolled_courses[0].id,
                    score=score,
                    band=band,
                    model_version="v2.1-lgbm-simulated",
                )
                session.add(snap)

                created += 1

            session.commit()
            print(f"Committed {created}/{to_create} simulated students...")

        print(f"[DONE] Total {created} simulated students created. Database now contains {existing_count + created} students.")

    except Exception as e:
        session.rollback()
        print(f"Error during large seed: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    seed_large_cohort(count)
