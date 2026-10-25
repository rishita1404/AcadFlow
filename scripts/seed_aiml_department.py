"""
AcadFlow AIML Department Deterministic Seed Script

Seeds complete, production-grade academic records for:
1. Department: Artificial Intelligence & Machine Learning (AIML)
2. 5 Dedicated Faculty Members (+ Coordinator & Mentor)
3. 6 Core Subjects:
   - Intro to AI (AIML501)
   - DSA (AIML502)
   - CNDC (AIML503)
   - System Design (AIML504)
   - Agentic AI (AIML505)
   - Backend Engineering (AIML506)
4. 5 Sections (AIML-A, AIML-B, AIML-C, AIML-D, AIML-E) with 20 students each (Total 100 students)
5. Complete Class Sessions (~28 held sessions per course) and realistic Attendance Records
6. Assignments & Submissions across all courses
7. Precomputed Risk Snapshots for all students
8. Published Department Timetable across all sections and periods
9. Department Notices with Confirmed Deadlines & Notifications
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

from sqlalchemy import create_engine, select
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


def seed_aiml(session=None, engine=None) -> dict:
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
    from app.services.risk_data import calculate_student_course_risk, load_risk_config

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

    counts = {
        "departments": 0,
        "faculty": 0,
        "students": 0,
        "courses": 0,
        "sessions": 0,
        "attendance": 0,
        "assignments": 0,
        "submissions": 0,
        "snapshots": 0,
        "timetable_slots": 0,
        "notices": 0,
        "notifications": 0,
    }

    try:
        shared_password_hash = get_password_hash("AcadFlow@123")

        # ── 1. Organization & AIML Department ─────────────────────────────────
        org = _get_or_create(
            _session, OrganizationModel, {"name": "AcadFlow Institute of Technology"}
        )

        aiml_dept = _session.scalar(select(DepartmentModel).where(DepartmentModel.code.in_(["CSE-AI", "AIML"])))
        if aiml_dept is None:
            aiml_dept = DepartmentModel(
                code="CSE-AI",
                name="Computer Science & Engineering (Artificial Intelligence)",
            )
            _session.add(aiml_dept)
            _session.flush()
        else:
            aiml_dept.code = "CSE-AI"
            aiml_dept.name = "Computer Science & Engineering (Artificial Intelligence)"
            _session.flush()
        counts["departments"] += 1

        # ── 2. Semester ───────────────────────────────────────────────────────
        semester_start = date(2026, 7, 15)
        semester_end = date(2026, 12, 20)
        reference_today = date(2026, 10, 24)

        sem = _get_or_create(
            _session,
            SemesterModel,
            {"name": "Semester 5 (2026)"},
            {"start_date": semester_start, "end_date": semester_end},
        )

        # Risk config
        existing_config = _session.scalar(select(RiskConfigModel))
        if existing_config is None:
            config = RiskConfigModel(
                w_margin=Decimal("50"),
                w_trend=Decimal("20"),
                w_deadline=Decimal("20"),
                w_missed=Decimal("10"),
                t_watch=Decimal("30"),
                t_risk=Decimal("55"),
                t_critical=Decimal("80"),
                min_classes=8,
                version="v1",
            )
            _session.add(config)
            _session.flush()

        # ── 3. 5 Dedicated Faculty Members + Coordinator + Mentor ─────────────
        faculty_roster = [
            {
                "name": "Dr. Rajesh Kumar",
                "email": "rajesh.faculty@acadflow.edu",
                "role": "faculty",
                "title": "Professor & AI Lab Director",
            },
            {
                "name": "Dr. Sneha Sharma",
                "email": "sneha.faculty@acadflow.edu",
                "role": "faculty",
                "title": "Associate Professor (Algorithms)",
            },
            {
                "name": "Prof. Vikram Verma",
                "email": "vikram.faculty@acadflow.edu",
                "role": "faculty",
                "title": "Assistant Professor (Networks)",
            },
            {
                "name": "Dr. Ananya Iyer",
                "email": "ananya.faculty@acadflow.edu",
                "role": "faculty",
                "title": "Professor (Distributed Systems)",
            },
            {
                "name": "Prof. Arjun Mehta",
                "email": "arjun.faculty@acadflow.edu",
                "role": "faculty",
                "title": "Assistant Professor (Cloud & Systems)",
            },
            {
                "name": "Dr. Meera Nambiar",
                "email": "meera.coord@acadflow.edu",
                "role": "coordinator",
                "title": "HOD & Academic Coordinator",
            },
            {
                "name": "Prof. Siddharth Joshi",
                "email": "siddharth.mentor@acadflow.edu",
                "role": "faculty",
                "title": "Senior Faculty Mentor",
            },
        ]

        faculty_users: dict[str, UserModel] = {}
        for f_data in faculty_roster:
            existing_u = _session.scalar(
                select(UserModel).where(
                    UserModel.name == f_data["name"],
                    UserModel.department_id == aiml_dept.id,
                )
            )
            if existing_u:
                existing_u.email = f_data["email"]
                u = existing_u
            else:
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
            counts["faculty"] += 1

        # Also link general demo accounts so demo logins work smoothly:
        demo_accounts = [
            ("faculty@acadflow.edu", "Dr. Priya Nair", "faculty"),
            ("coordinator@acadflow.edu", "Coord Vijay", "coordinator"),
            ("mentor@acadflow.edu", "Meera Mentor", "faculty"),
            ("admin@acadflow.edu", "Admin Sunita", "admin"),
        ]
        for email, name, role in demo_accounts:
            u = _get_or_create(
                _session,
                UserModel,
                {"email": email},
                {
                    "name": name,
                    "password_hash": shared_password_hash,
                    "role": role,
                    "department_id": aiml_dept.id,
                    "organization_id": org.id,
                },
            )
            faculty_users[email] = u

        # Coordinator / Dean assignment for AIML department
        _get_or_create(
            _session,
            DeanAssignmentModel,
            {"user_id": faculty_users["meera.coord@acadflow.edu"].id, "department_id": aiml_dept.id},
        )
        _get_or_create(
            _session,
            DeanAssignmentModel,
            {"user_id": faculty_users["coordinator@acadflow.edu"].id, "department_id": aiml_dept.id},
        )

        # ── 4. 6 Subjects (Courses) for AIML ──────────────────────────────────
        courses_def = [
            {
                "code": "AIML501",
                "name": "Introduction to Artificial Intelligence",
                "total_classes": 45,
                "instructor": faculty_users["rajesh.faculty@acadflow.edu"],
                "assistant": faculty_users["faculty@acadflow.edu"],
            },
            {
                "code": "AIML502",
                "name": "Data Structures & Algorithms",
                "total_classes": 50,
                "instructor": faculty_users["sneha.faculty@acadflow.edu"],
                "assistant": faculty_users["faculty@acadflow.edu"],
            },
            {
                "code": "AIML503",
                "name": "Computer Networks & Data Communication",
                "total_classes": 45,
                "instructor": faculty_users["vikram.faculty@acadflow.edu"],
                "assistant": faculty_users["siddharth.mentor@acadflow.edu"],
            },
            {
                "code": "AIML504",
                "name": "System Design & Distributed Systems",
                "total_classes": 45,
                "instructor": faculty_users["ananya.faculty@acadflow.edu"],
                "assistant": faculty_users["arjun.faculty@acadflow.edu"],
            },
            {
                "code": "AIML505",
                "name": "Agentic AI & Multi-Agent Systems",
                "total_classes": 40,
                "instructor": faculty_users["rajesh.faculty@acadflow.edu"],
                "assistant": faculty_users["ananya.faculty@acadflow.edu"],
            },
            {
                "code": "AIML506",
                "name": "Backend Engineering & API Architecture",
                "total_classes": 45,
                "instructor": faculty_users["arjun.faculty@acadflow.edu"],
                "assistant": faculty_users["vikram.faculty@acadflow.edu"],
            },
        ]

        course_models: dict[str, CourseModel] = {}
        for cdata in courses_def:
            c = _get_or_create(
                _session,
                CourseModel,
                {"code": cdata["code"]},
                {
                    "name": cdata["name"],
                    "semester_id": sem.id,
                    "department_id": aiml_dept.id,
                    "total_classes": cdata["total_classes"],
                },
            )
            course_models[cdata["code"]] = c
            counts["courses"] += 1

            # Course Staff
            _get_or_create(
                _session,
                CourseStaffModel,
                {"course_id": c.id, "user_id": cdata["instructor"].id, "role": "instructor"},
            )
            _get_or_create(
                _session,
                CourseStaffModel,
                {"course_id": c.id, "user_id": cdata["assistant"].id, "role": "trainer"},
            )
            _get_or_create(
                _session,
                CourseStaffModel,
                {
                    "course_id": c.id,
                    "user_id": faculty_users["meera.coord@acadflow.edu"].id,
                    "role": "course_coordinator",
                },
            )

        # ── 5. 5 Sections with 20 Students Each (Total 100 Students) ──────────
        # Sections: AIML-A, AIML-B, AIML-C, AIML-D, AIML-E
        student_roster = [
            # Section A (1-20)
            ("Riya Sharma", "riya.aiml001@acadflow.edu", "26AIML001", "A", "at_risk"),
            ("Aarav Patel", "aarav.aiml002@acadflow.edu", "26AIML002", "A", "safe"),
            ("Aman Khanna", "aman.aiml003@acadflow.edu", "26AIML003", "A", "safe"),
            ("Meera Pillai", "meera.aiml004@acadflow.edu", "26AIML004", "A", "safe"),
            ("Karan Singh", "karan.aiml005@acadflow.edu", "26AIML005", "A", "watch"),
            ("Dev Gupta", "dev.aiml006@acadflow.edu", "26AIML006", "A", "critical"),
            ("Ananya Deshmukh", "ananya.aiml007@acadflow.edu", "26AIML007", "A", "safe"),
            ("Rohan Verma", "rohan.aiml008@acadflow.edu", "26AIML008", "A", "safe"),
            ("Ishita Iyer", "ishita.aiml009@acadflow.edu", "26AIML009", "A", "safe"),
            ("Aditya Sen", "aditya.aiml010@acadflow.edu", "26AIML010", "A", "safe"),
            ("Kavya Reddy", "kavya.aiml011@acadflow.edu", "26AIML011", "A", "safe"),
            ("Nikhil Joshi", "nikhil.aiml012@acadflow.edu", "26AIML012", "A", "watch"),
            ("Sneha Chawla", "sneha.aiml013@acadflow.edu", "26AIML013", "A", "safe"),
            ("Tarun Malhotra", "tarun.aiml014@acadflow.edu", "26AIML014", "A", "safe"),
            ("Pooja Agarwal", "pooja.aiml015@acadflow.edu", "26AIML015", "A", "safe"),
            ("Varun Bose", "varun.aiml016@acadflow.edu", "26AIML016", "A", "at_risk"),
            ("Bhavna Rao", "bhavna.aiml017@acadflow.edu", "26AIML017", "A", "safe"),
            ("Chirag Mehta", "chirag.aiml018@acadflow.edu", "26AIML018", "A", "safe"),
            ("Deepika Saxena", "deepika.aiml019@acadflow.edu", "26AIML019", "A", "safe"),
            ("Eshaan Goyal", "eshaan.aiml020@acadflow.edu", "26AIML020", "A", "safe"),
            # Section B (21-40)
            ("Harsh Kapoor", "harsh.aiml021@acadflow.edu", "26AIML021", "B", "safe"),
            ("Gauri Namboodiri", "gauri.aiml022@acadflow.edu", "26AIML022", "B", "safe"),
            ("Jay Bhatia", "jay.aiml023@acadflow.edu", "26AIML023", "B", "watch"),
            ("Radhika Nair", "radhika.aiml024@acadflow.edu", "26AIML024", "B", "safe"),
            ("Rohit Kulkarni", "rohit.aiml025@acadflow.edu", "26AIML025", "B", "safe"),
            ("Tanvi Ghosh", "tanvi.aiml026@acadflow.edu", "26AIML026", "B", "critical"),
            ("Siddharth Nair", "siddharth.aiml027@acadflow.edu", "26AIML027", "B", "safe"),
            ("Prachi Soni", "prachi.aiml028@acadflow.edu", "26AIML028", "B", "safe"),
            ("Kunal Mishra", "kunal.aiml029@acadflow.edu", "26AIML029", "B", "at_risk"),
            ("Divya Menon", "divya.aiml030@acadflow.edu", "26AIML030", "B", "safe"),
            ("Rahul Bhat", "rahul.aiml031@acadflow.edu", "26AIML031", "B", "safe"),
            ("Shreya Banerjee", "shreya.aiml032@acadflow.edu", "26AIML032", "B", "safe"),
            ("Yash Chopra", "yash.aiml033@acadflow.edu", "26AIML033", "B", "safe"),
            ("Ritu Hegde", "ritu.aiml034@acadflow.edu", "26AIML034", "B", "watch"),
            ("Alok Pandey", "alok.aiml035@acadflow.edu", "26AIML035", "B", "safe"),
            ("Neha Tripathy", "neha.aiml036@acadflow.edu", "26AIML036", "B", "safe"),
            ("Vivek Kaushik", "vivek.aiml037@acadflow.edu", "26AIML037", "B", "safe"),
            ("Swati Jain", "swati.aiml038@acadflow.edu", "26AIML038", "B", "safe"),
            ("Abhay Tiwari", "abhay.aiml039@acadflow.edu", "26AIML039", "B", "at_risk"),
            ("Nidhi Trivedi", "nidhi.aiml040@acadflow.edu", "26AIML040", "B", "safe"),
            # Section C (41-60)
            ("Aryan Mukherjee", "aryan.aiml041@acadflow.edu", "26AIML041", "C", "safe"),
            ("Kriti Rastogi", "kriti.aiml042@acadflow.edu", "26AIML042", "C", "safe"),
            ("Parth Singhal", "parth.aiml043@acadflow.edu", "26AIML043", "C", "safe"),
            ("Anjali Bhatt", "anjali.aiml044@acadflow.edu", "26AIML044", "C", "watch"),
            ("Mayank Dubey", "mayank.aiml045@acadflow.edu", "26AIML045", "C", "safe"),
            ("Simran Kaur", "simran.aiml046@acadflow.edu", "26AIML046", "C", "critical"),
            ("Gautam Thakur", "gautam.aiml047@acadflow.edu", "26AIML047", "C", "safe"),
            ("Payal Mahajan", "payal.aiml048@acadflow.edu", "26AIML048", "C", "safe"),
            ("Tushar Mittal", "tushar.aiml049@acadflow.edu", "26AIML049", "C", "at_risk"),
            ("Sanya Grover", "sanya.aiml050@acadflow.edu", "26AIML050", "C", "safe"),
            ("Mohit Mathur", "mohit.aiml051@acadflow.edu", "26AIML051", "C", "safe"),
            ("Pallavi Das", "pallavi.aiml052@acadflow.edu", "26AIML052", "C", "safe"),
            ("Vishal Chauhan", "vishal.aiml053@acadflow.edu", "26AIML053", "C", "safe"),
            ("Aditi Shukla", "aditi.aiml054@acadflow.edu", "26AIML054", "C", "safe"),
            ("Saurabh Prasad", "saurabh.aiml055@acadflow.edu", "26AIML055", "C", "watch"),
            ("Rashi Agrawal", "rashi.aiml056@acadflow.edu", "26AIML056", "C", "safe"),
            ("Akhil Varma", "akhil.aiml057@acadflow.edu", "26AIML057", "C", "safe"),
            ("Mansi Shah", "mansi.aiml058@acadflow.edu", "26AIML058", "C", "safe"),
            ("Harshit Somani", "harshit.aiml059@acadflow.edu", "26AIML059", "C", "at_risk"),
            ("Juhi Sengupta", "juhi.aiml060@acadflow.edu", "26AIML060", "C", "safe"),
            # Section D (61-80)
            ("Ayush Kashyap", "ayush.aiml061@acadflow.edu", "26AIML061", "D", "safe"),
            ("Priya Sundaram", "priya.aiml062@acadflow.edu", "26AIML062", "D", "safe"),
            ("Shubham Dixit", "shubham.aiml063@acadflow.edu", "26AIML063", "D", "watch"),
            ("Richa Ganguly", "richa.aiml064@acadflow.edu", "26AIML064", "D", "safe"),
            ("Naman Ahuja", "naman.aiml065@acadflow.edu", "26AIML065", "D", "safe"),
            ("Garima Bansal", "garima.aiml066@acadflow.edu", "26AIML066", "D", "critical"),
            ("Deepak Lal", "deepak.aiml067@acadflow.edu", "26AIML067", "D", "safe"),
            ("Renu Tomar", "renu.aiml068@acadflow.edu", "26AIML068", "D", "safe"),
            ("Kartik Pillai", "kartik.aiml069@acadflow.edu", "26AIML069", "D", "at_risk"),
            ("Sonali Sethi", "sonali.aiml070@acadflow.edu", "26AIML070", "D", "safe"),
            ("Gaurav Tyagi", "gaurav.aiml071@acadflow.edu", "26AIML071", "D", "safe"),
            ("Megha Chandran", "megha.aiml072@acadflow.edu", "26AIML072", "D", "safe"),
            ("Nishant Srivastava", "nishant.aiml073@acadflow.edu", "26AIML073", "D", "safe"),
            ("Shweta Mathur", "shweta.aiml074@acadflow.edu", "26AIML074", "D", "watch"),
            ("Ankit Rawat", "ankit.aiml075@acadflow.edu", "26AIML075", "D", "safe"),
            ("Preeti Nair", "preeti.aiml076@acadflow.edu", "26AIML076", "D", "safe"),
            ("Utkarsh Sinha", "utkarsh.aiml077@acadflow.edu", "26AIML077", "D", "safe"),
            ("Shalini Roy", "shalini.aiml078@acadflow.edu", "26AIML078", "D", "safe"),
            ("Hemant Bhatt", "hemant.aiml079@acadflow.edu", "26AIML079", "D", "at_risk"),
            ("Jyoti Panda", "jyoti.aiml080@acadflow.edu", "26AIML080", "D", "safe"),
            # Section E (81-100)
            ("Sameer Qureshi", "sameer.aiml081@acadflow.edu", "26AIML081", "E", "safe"),
            ("Disha Pillai", "disha.aiml082@acadflow.edu", "26AIML082", "E", "safe"),
            ("Varun Shenoy", "varun.aiml083@acadflow.edu", "26AIML083", "E", "watch"),
            ("Akanksha Anand", "akanksha.aiml084@acadflow.edu", "26AIML084", "E", "safe"),
            ("Kshitij Jain", "kshitij.aiml085@acadflow.edu", "26AIML085", "E", "safe"),
            ("Chetna Bhattacharya", "chetna.aiml086@acadflow.edu", "26AIML086", "E", "critical"),
            ("Prashant Nair", "prashant.aiml087@acadflow.edu", "26AIML087", "E", "safe"),
            ("Tanuja Joshi", "tanuja.aiml088@acadflow.edu", "26AIML088", "E", "safe"),
            ("Rajat Agnihotri", "rajat.aiml089@acadflow.edu", "26AIML089", "E", "at_risk"),
            ("Monali Sen", "monali.aiml090@acadflow.edu", "26AIML090", "E", "safe"),
            ("Dhruv Kothari", "dhruv.aiml091@acadflow.edu", "26AIML091", "E", "safe"),
            ("Natasha Paul", "natasha.aiml092@acadflow.edu", "26AIML092", "E", "safe"),
            ("Bharat Mani", "bharat.aiml093@acadflow.edu", "26AIML093", "E", "safe"),
            ("Srishti Upadhyay", "srishti.aiml094@acadflow.edu", "26AIML094", "E", "watch"),
            ("Lokesh Yadav", "lokesh.aiml095@acadflow.edu", "26AIML095", "E", "safe"),
            ("Mahima Roy", "mahima.aiml096@acadflow.edu", "26AIML096", "E", "safe"),
            ("Sandeep Nayak", "sandeep.aiml097@acadflow.edu", "26AIML097", "E", "safe"),
            ("Rashmi Kar", "rashmi.aiml098@acadflow.edu", "26AIML098", "E", "safe"),
            ("Tejas Kulshrestha", "tejas.aiml099@acadflow.edu", "26AIML099", "E", "at_risk"),
            ("Urvashi Gautam", "urvashi.aiml100@acadflow.edu", "26AIML100", "E", "safe"),
        ]

        created_students = []
        for name, email, roll, sec, profile in student_roster:
            # Check by roll_no if student already exists, to update their email directly
            existing_st = _session.scalar(select(StudentModel).where(StudentModel.roll_no == roll))
            if existing_st:
                u = _session.get(UserModel, existing_st.user_id)
                u.email = email
                u.name = name
                u.department_id = aiml_dept.id
                st = existing_st
            else:
                u = _get_or_create(
                    _session,
                    UserModel,
                    {"email": email},
                    {
                        "name": name,
                        "password_hash": shared_password_hash,
                        "role": "student",
                        "department_id": aiml_dept.id,
                        "organization_id": org.id,
                    },
                )
                u.department_id = aiml_dept.id
                st = _get_or_create(
                    _session,
                    StudentModel,
                    {"user_id": u.id},
                    {"roll_no": roll, "batch": "2026"},
                )
            st.roll_no = roll
            st.batch = "2026"
            created_students.append((u, st, sec, profile))
            counts["students"] += 1

            # Mentor assignment
            mentor_user = (
                faculty_users["siddharth.mentor@acadflow.edu"]
                if int(roll[-3:]) % 2 == 0
                else faculty_users["mentor@acadflow.edu"]
            )
            _get_or_create(
                _session,
                MentorAssignmentModel,
                {"mentor_id": mentor_user.id, "student_id": st.user_id},
            )

            # Enrol in ALL 6 courses
            for c in course_models.values():
                _get_or_create(
                    _session,
                    EnrolmentModel,
                    {"student_id": st.user_id, "course_id": c.id},
                    {"enrolled_on": semester_start},
                )

        # ── 6. Class Sessions & Realistic Attendance ──────────────────────────
        # Generate 28 class sessions per course from July 15 to Oct 23, 2026
        held_dates = []
        curr_d = semester_start
        while curr_d <= reference_today and len(held_dates) < 28:
            if curr_d.weekday() < 5:  # Monday to Friday
                held_dates.append(curr_d)
            curr_d += timedelta(days=3 if curr_d.weekday() == 4 else 2)

        course_session_map: dict[int, list[ClassSessionModel]] = {}
        for c in course_models.values():
            session_list = []
            for d in held_dates:
                cs = _get_or_create(
                    _session,
                    ClassSessionModel,
                    {"course_id": c.id, "held_on": d},
                    {"is_cancelled": False},
                )
                session_list.append(cs)
                counts["sessions"] += 1
            course_session_map[c.id] = session_list

        # Mark attendance for all 100 students across the 6 courses
        total_held = len(held_dates)
        now_dt = datetime.now(timezone.utc)
        instructor_id = faculty_users["rajesh.faculty@acadflow.edu"].id

        for u, st, sec, profile in created_students:
            for c_code, c in course_models.items():
                sessions = course_session_map[c.id]
                # Target attend count based on profile
                if profile == "safe":
                    # 86% - 96% attendance
                    target_att = random.randint(24, 27)
                elif profile == "watch":
                    # 71% - 75% attendance
                    target_att = random.randint(20, 21)
                elif profile == "at_risk":
                    # 60% - 68% attendance
                    target_att = random.randint(17, 19)
                else:  # critical
                    # 39% - 50% attendance
                    target_att = random.randint(11, 14)

                # Ensure Riya has specific known profile (30 attended out of 40 equivalent, ~75%)
                if st.roll_no == "26AIML001":
                    target_att = 18 if c_code in ("AIML501", "AIML505") else 20

                # Mark attendance deterministically
                for idx, cs in enumerate(sessions):
                    # Recent absences for at_risk to simulate negative trend
                    if profile in ("at_risk", "critical") and idx >= total_held - 4:
                        status = "absent"
                    elif idx < target_att:
                        status = "present"
                    else:
                        status = "absent"

                    existing = _session.scalar(
                        select(AttendanceRecordModel).where(
                            AttendanceRecordModel.session_id == cs.id,
                            AttendanceRecordModel.student_id == st.user_id,
                        )
                    )
                    if existing is None:
                        att_rec = AttendanceRecordModel(
                            session_id=cs.id,
                            student_id=st.user_id,
                            status=status,
                            marked_by=instructor_id,
                            marked_at=now_dt,
                        )
                        _session.add(att_rec)
                        counts["attendance"] += 1

        # ── 7. Assignments & Submissions across all 6 courses ─────────────────
        assignments_spec = [
            ("Assignment 1: Fundamentals & Setup", "assignment", date(2026, 8, 20), True),
            ("Lab Exercise 1: Hands-on Lab File", "lab file", date(2026, 9, 15), True),
            ("Review 1: Code Evaluation & Midterm", "review", date(2026, 10, 10), True),
            ("Assignment 2: Capstone System Implementation", "assignment", date(2026, 11, 25), True),
        ]

        course_assignments: dict[int, list[AssignmentModel]] = {}
        for c in course_models.values():
            asgn_list = []
            for title, kind, due_d, is_pub in assignments_spec:
                due_dt = datetime(due_d.year, due_d.month, due_d.day, 17, 0, 0, tzinfo=timezone.utc)
                asgn = _get_or_create(
                    _session,
                    AssignmentModel,
                    {"course_id": c.id, "title": f"[{c.code}] {title}"},
                    {"kind": kind, "due_at": due_dt, "grace_hours": 48, "is_published": is_pub},
                )
                asgn_list.append(asgn)
                counts["assignments"] += 1
            course_assignments[c.id] = asgn_list

        # Populate submissions for past assignments (first 3)
        for u, st, sec, profile in created_students:
            sid = st.user_id
            for c_id, asgns in course_assignments.items():
                past_asgns = asgns[:3]
                for idx, a in enumerate(past_asgns):
                    dedupe = f"{a.id}:{sid}:1"
                    if _session.scalar(select(SubmissionModel).where(SubmissionModel.dedupe_key == dedupe)):
                        continue

                    # Sub status based on profile
                    if profile == "critical":
                        sub_status = "missed" if idx >= 1 else "late"
                        sub_time = None if sub_status == "missed" else a.due_at + timedelta(hours=12)
                    elif profile == "at_risk":
                        sub_status = "missed" if idx == 2 else ("late" if idx == 1 else "on_time")
                        sub_time = None if sub_status == "missed" else (a.due_at + timedelta(hours=4) if sub_status == "late" else a.due_at - timedelta(hours=2))
                    elif profile == "watch":
                        sub_status = "late" if idx == 2 else "on_time"
                        sub_time = a.due_at + timedelta(hours=2) if sub_status == "late" else a.due_at - timedelta(hours=3)
                    else:
                        sub_status = "on_time"
                        sub_time = a.due_at - timedelta(hours=5)

                    sub = SubmissionModel(
                        assignment_id=a.id,
                        student_id=sid,
                        version=1,
                        status=sub_status,
                        submitted_at=sub_time,
                        dedupe_key=dedupe,
                    )
                    _session.add(sub)
                    counts["submissions"] += 1

        # ── 8. Rooms & Department Timetable ───────────────────────────────────
        rooms_def = [
            ("AI Lab 101", 60, "lab"),
            ("Room 202", 45, "classroom"),
            ("System Design Lab 301", 40, "lab"),
            ("Lecture Hall 401", 100, "seminar"),
        ]
        room_map: dict[str, RoomModel] = {}
        for rname, cap, rtype in rooms_def:
            rm = _get_or_create(
                _session, RoomModel, {"name": rname}, {"capacity": cap, "room_type": rtype}
            )
            room_map[rname] = rm

        # Timetable Version
        tv = _session.scalar(
            select(TimetableVersionModel).where(
                TimetableVersionModel.department_id == aiml_dept.id,
                TimetableVersionModel.semester_id == sem.id,
                TimetableVersionModel.status == "published",
            )
        )
        if tv is None:
            tv = TimetableVersionModel(
                department_id=aiml_dept.id,
                semester_id=sem.id,
                status="published",
                effective_from=str(semester_start),
                created_by=faculty_users["meera.coord@acadflow.edu"].id,
                published_at=str(datetime.now(timezone.utc)),
            )
            _session.add(tv)
            _session.flush()

        # Period Configs
        periods_def = [
            ("09:00", "10:00", "P1", False),
            ("10:00", "11:00", "P2", False),
            ("11:00", "11:15", "Morning Break", True),
            ("11:15", "12:15", "P3", False),
            ("12:15", "13:15", "P4", False),
            ("13:15", "14:00", "Lunch Break", True),
            ("14:00", "15:00", "P5", False),
            ("15:00", "16:00", "P6", False),
        ]
        for day_idx in range(5):  # Mon to Fri
            for start_t, end_t, label, is_brk in periods_def:
                _get_or_create(
                    _session,
                    PeriodConfigModel,
                    {"version_id": tv.id, "day": day_idx, "label": label},
                    {"start_time": start_t, "end_time": end_t, "is_break": is_brk},
                )

        # Timetable Slots across the 5 sections & 6 subjects
        # Section A to E
        schedule_grid = [
            # Day, Period, CourseCode, TeacherKey, RoomKey, Section, Kind
            (0, "P1", "AIML501", "rajesh.faculty@acadflow.edu", "AI Lab 101", "A", "lecture"),
            (0, "P2", "AIML502", "sneha.faculty@acadflow.edu", "Room 202", "A", "lecture"),
            (0, "P3", "AIML503", "vikram.faculty@acadflow.edu", "System Design Lab 301", "A", "lecture"),
            (0, "P4", "AIML504", "ananya.faculty@acadflow.edu", "Room 202", "B", "lecture"),
            (0, "P5", "AIML505", "rajesh.faculty@acadflow.edu", "AI Lab 101", "B", "lecture"),
            (1, "P1", "AIML505", "rajesh.faculty@acadflow.edu", "AI Lab 101", "A", "lecture"),
            (1, "P2", "AIML506", "arjun.faculty@acadflow.edu", "Room 202", "A", "lecture"),
            (1, "P3", "AIML501", "rajesh.faculty@acadflow.edu", "AI Lab 101", "B", "lecture"),
            (1, "P4", "AIML502", "sneha.faculty@acadflow.edu", "Room 202", "C", "lecture"),
            (1, "P5", "AIML503", "vikram.faculty@acadflow.edu", "System Design Lab 301", "C", "lecture"),
            (2, "P1", "AIML502", "sneha.faculty@acadflow.edu", "Room 202", "A", "lecture"),
            (2, "P2", "AIML503", "vikram.faculty@acadflow.edu", "System Design Lab 301", "B", "lecture"),
            (2, "P3", "AIML504", "ananya.faculty@acadflow.edu", "Room 202", "C", "lecture"),
            (2, "P4", "AIML505", "rajesh.faculty@acadflow.edu", "AI Lab 101", "D", "lecture"),
            (2, "P5", "AIML506", "arjun.faculty@acadflow.edu", "Room 202", "E", "lecture"),
            (3, "P1", "AIML504", "ananya.faculty@acadflow.edu", "Room 202", "A", "lecture"),
            (3, "P2", "AIML506", "arjun.faculty@acadflow.edu", "Room 202", "B", "lecture"),
            (3, "P3", "AIML501", "rajesh.faculty@acadflow.edu", "AI Lab 101", "C", "lecture"),
            (3, "P4", "AIML502", "sneha.faculty@acadflow.edu", "Room 202", "D", "lecture"),
            (3, "P5", "AIML503", "vikram.faculty@acadflow.edu", "System Design Lab 301", "E", "lecture"),
            (4, "P1", "AIML501", "rajesh.faculty@acadflow.edu", "AI Lab 101", "A", "lab"),
            (4, "P2", "AIML505", "rajesh.faculty@acadflow.edu", "AI Lab 101", "A", "lab"),
            (4, "P3", "AIML504", "ananya.faculty@acadflow.edu", "System Design Lab 301", "B", "lab"),
            (4, "P4", "AIML506", "arjun.faculty@acadflow.edu", "Room 202", "D", "lecture"),
            (4, "P5", "AIML505", "rajesh.faculty@acadflow.edu", "AI Lab 101", "E", "lab"),
        ]

        for day, period, c_code, t_email, r_name, sec, kind in schedule_grid:
            cid = course_models[c_code].id
            tid = faculty_users[t_email].id
            rid = room_map[r_name].id
            existing_slot = _session.scalar(
                select(TimetableSlotModel).where(
                    TimetableSlotModel.version_id == tv.id,
                    TimetableSlotModel.course_id == cid,
                    TimetableSlotModel.day == day,
                    TimetableSlotModel.period_label == period,
                    TimetableSlotModel.section == sec,
                )
            )
            if existing_slot is None:
                _session.add(
                    TimetableSlotModel(
                        version_id=tv.id,
                        course_id=cid,
                        section=sec,
                        teacher_id=tid,
                        room_id=rid,
                        day=day,
                        period_label=period,
                        kind=kind,
                    )
                )
                counts["timetable_slots"] += 1

        # ── 9. Notices with Confirmed Deadlines ───────────────────────────────
        coord_user = faculty_users["meera.coord@acadflow.edu"]
        dr_rajesh = faculty_users["rajesh.faculty@acadflow.edu"]
        dr_sneha = faculty_users["sneha.faculty@acadflow.edu"]

        notices_data = [
            (
                coord_user.id,
                "Welcome to AIML Semester 5 (2026)",
                (
                    "Welcome to the Artificial Intelligence & Machine Learning department for Semester 5. "
                    "This semester covers core specializations: Intro to AI, DSA, CNDC, System Design, "
                    "Agentic AI, and Backend Engineering. Minimum 75% attendance is strictly enforced. "
                    "Please verify your course enrollments and access your timetable via the portal."
                ),
                "general",
                False,
                f'{{"type":"department","department_id":{aiml_dept.id}}}',
                [],
            ),
            (
                dr_rajesh.id,
                "AIML505: Agentic AI Hackathon & Capstone Project",
                (
                    "Announcing the Fall 2026 Agentic AI Multi-Agent Hackathon! "
                    "All student teams must build an autonomous multi-agent workflow. "
                    "Final project milestone is due on 20 November 2026 at 5:00 PM."
                ),
                "event",
                True,
                f'{{"type":"course","course_id":{course_models["AIML505"].id}}}',
                [("submission", "2026-11-20T17:00:00+05:30", "Agentic AI Hackathon Project Deadline")],
            ),
            (
                dr_sneha.id,
                "AIML502: Data Structures Lab Practical Evaluation",
                (
                    "Mid-semester lab examination and code review for AIML502 (DSA) is scheduled for "
                    "12 November 2026 from 9:00 AM to 12:00 PM in Lab 101. Attendance is mandatory."
                ),
                "exam",
                True,
                f'{{"type":"course","course_id":{course_models["AIML502"].id}}}',
                [("exam", "2026-11-12T09:00:00+05:30", "AIML502 DSA Practical Lab Exam")],
            ),
        ]

        for sender_id, title, body, cat, urgent, aud, deadlines in notices_data:
            notice = _session.scalar(select(NoticeModel).where(NoticeModel.title == title))
            if notice is None:
                notice = NoticeModel(
                    sender_id=sender_id,
                    title=title,
                    body=body,
                    category=cat,
                    urgent=urgent,
                    status="sent",
                    audience_spec=aud,
                    created_at=datetime(2026, 9, 1, 10, 0, 0, tzinfo=timezone.utc),
                )
                _session.add(notice)
                _session.flush()
                counts["notices"] += 1

                for kind, dt_str, lbl in deadlines:
                    _session.add(
                        NoticeDeadlineModel(
                            notice_id=notice.id,
                            kind=kind,
                            at=dt_str,
                            label=lbl,
                            source="extracted",
                            confirmed_by=sender_id,
                        )
                    )

                # Deliver notice to all Section A students
                for u, st, sec, profile in created_students[:20]:
                    _session.add(
                        NoticeRecipientModel(
                            notice_id=notice.id,
                            user_id=u.id,
                            delivered_at=datetime(2026, 9, 1, 10, 0, 0, tzinfo=timezone.utc),
                            seen_at=datetime(2026, 9, 1, 14, 0, 0, tzinfo=timezone.utc),
                        )
                    )

        # ── 10. Notifications for Students ────────────────────────────────────
        notifications_data = [
            ("Low Buffer Warning (AIML505)", "Your attendance buffer in Agentic AI is down to 1 class. Missing further classes will push you into the At-Risk band.", "warning"),
            ("Upcoming Lab Exam Reminder", "AIML502 DSA Practical Lab Exam is coming up on 12 November 2026 at 9:00 AM.", "reminder"),
            ("Assignment Published", "Assignment 2: Capstone System Implementation has been published for AIML506.", "info"),
        ]
        for u, st, sec, profile in created_students[:10]:
            for title, msg, kind in notifications_data:
                dedup = f"notif:{st.user_id}:{title}"
                if not _session.scalar(select(NotificationModel).where(NotificationModel.dedup_key == dedup)):
                    _session.add(
                        NotificationModel(
                            recipient_id=u.id,
                            title=title,
                            message=msg,
                            kind=kind,
                            is_read=False,
                            created_at=now_dt - timedelta(days=2),
                            dedup_key=dedup,
                        )
                    )
                    counts["notifications"] += 1

        # ── 11. Precompute and Persist Risk Snapshots ─────────────────────────
        _session.flush()
        config, config_id = load_risk_config(_session)
        print("[INFO] Precomputing risk snapshots for students...")
        for u, st, sec, profile in created_students:
            worst_score = -1.0
            worst_band = "Safe"
            worst_cid = list(course_models.values())[0].id
            for cid, c in course_models.items():
                data = calculate_student_course_risk(_session, st.user_id, c.id, config=config, config_id=config_id)
                sc = data.get("score")
                if sc is not None and sc > worst_score:
                    worst_score = sc
                    worst_band = data.get("band", "Safe")
                    worst_cid = c.id

            if worst_score >= 0:
                snap = RiskSnapshotModel(
                    student_id=st.user_id,
                    computed_at=now_dt,
                    score=Decimal(str(round(worst_score, 1))),
                    band=worst_band,
                    worst_course_id=worst_cid,
                    config_id=config_id,
                )
                _session.add(snap)
                counts["snapshots"] += 1

        if owns_session:
            _session.commit()
            print("[SUCCESS] AIML Department Seed Complete!")
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


if __name__ == "__main__":
    print("Seeding AcadFlow with AI-ML Department (5 Faculty, 6 Subjects, 5 Sections x 20 Students) ...")
    seed_aiml()
