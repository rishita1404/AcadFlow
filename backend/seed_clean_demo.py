"""
Clean Demo Data Seeder for AcadFlow.

Wipes all existing demo data and seeds:
- 4 login types: Student, Faculty/Mentor, Dean/Coordinator, Admin
- 1 Department (CSE), 1 Semester, 1 Section ('A')
- 20 students (all in Section A, all mentored by the 1 faculty/mentor)
- 1 Faculty / Mentor (teaches all 5 subjects & mentors all 20 students)
- 1 Dean / Coordinator (head of CSE)
- 1 Admin
- 5 subjects with timetable, rooms, class sessions, attendance, assignments, submissions
- Leave requests, condonation requests, interventions, notices, deadlines, notifications, risk snapshots
"""

import json
import random
import sqlite3
from datetime import date, datetime, timedelta, timezone

from app.core.security import get_password_hash

DB_PATH = "acadflow.db"
PASSWORD_HASH = get_password_hash("AcadFlow@123")
TODAY = date.today()
NOW = datetime.now(timezone.utc)


def clear_all_tables(cur: sqlite3.Cursor):
    tables = [
        "audit_log",
        "notifications",
        "notice_deadlines",
        "notice_recipients",
        "notices",
        "audience_presets",
        "interventions",
        "condonation_requests",
        "leave_requests",
        "submissions",
        "assignments",
        "attendance_records",
        "attendance_upload_batches",
        "class_sessions",
        "timetable_slots",
        "period_configs",
        "timetable_versions",
        "rooms",
        "risk_snapshots",
        "student_holidays",
        "holidays",
        "enrolments",
        "course_staff",
        "courses",
        "mentor_assignments",
        "dean_assignments",
        "students",
        "users",
        "organizations",
        "semesters",
        "departments",
        "risk_config",
    ]
    cur.execute("PRAGMA foreign_keys = OFF;")
    for t in tables:
        cur.execute(f"DELETE FROM {t};")
        cur.execute("DELETE FROM sqlite_sequence WHERE name = ?;", (t,))
    cur.execute("PRAGMA foreign_keys = ON;")


def seed():
    random.seed(42)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    clear_all_tables(cur)

    # 1. Department & Semester & RiskConfig
    cur.execute(
        "INSERT INTO departments (id, name, code) VALUES (1, 'Computer Science & Engineering', 'CSE')"
    )
    sem_start = (TODAY - timedelta(days=60)).isoformat()
    sem_end = (TODAY + timedelta(days=90)).isoformat()
    cur.execute(
        "INSERT INTO semesters (id, name, start_date, end_date) VALUES (1, 'Semester 5 (2026)', ?, ?)",
        (sem_start, sem_end),
    )
    cur.execute(
        """
        INSERT INTO risk_config (
            id, w_margin, w_trend, w_deadline, w_missed,
            t_watch, t_risk, t_critical, min_classes, version,
            condonation_floor_pct, require_recommendation,
            collision_warning_threshold, notice_reach_threshold, notice_daily_rate_limit
        ) VALUES (1, 50, 20, 20, 10, 30, 55, 80, 5, 'v1', 65, 1, 3, 100, 20)
        """
    )

    # 2. Users: 1 Admin, 1 Dean/Coordinator, 1 Faculty/Mentor, 20 Students
    cur.execute(
        "INSERT INTO users (id, name, email, password_hash, role, department_id, failed_logins) VALUES (1, 'System Admin', 'admin@acadflow.edu', ?, 'admin', 1, 0)",
        (PASSWORD_HASH,),
    )
    cur.execute(
        "INSERT INTO users (id, name, email, password_hash, role, department_id, failed_logins) VALUES (2, 'Prof. Vijay Deshmukh', 'coordinator@acadflow.edu', ?, 'coordinator', 1, 0)",
        (PASSWORD_HASH,),
    )
    cur.execute(
        "INSERT INTO users (id, name, email, password_hash, role, department_id, failed_logins) VALUES (3, 'Dr. Priya Nair', 'faculty@acadflow.edu', ?, 'faculty', 1, 0)",
        (PASSWORD_HASH,),
    )
    cur.execute("INSERT INTO dean_assignments (user_id, department_id) VALUES (2, 1)")

    student_names = [
        "Aarav Sharma",
        "Riya Verma",
        "Kabir Patel",
        "Ananya Iyer",
        "Devansh Kulkarni",
        "Meera Krishnan",
        "Rohan Malhotra",
        "Ishita Bose",
        "Aditya Nair",
        "Sneha Reddy",
        "Vihaan Gupta",
        "Diya Chatterjee",
        "Arjun Mehta",
        "Kavya Menon",
        "Siddharth Joshi",
        "Neha Agarwal",
        "Pranav Deshpande",
        "Tara Sen",
        "Karan Kapoor",
        "Pooja Rao",
    ]

    student_ids = []
    for idx, name in enumerate(student_names, start=1):
        uid = 3 + idx  # 4..23
        email = "student@acadflow.edu" if idx == 1 else f"student{idx}@acadflow.edu"
        roll_no = f"24CSE{idx:03d}"
        cur.execute(
            "INSERT INTO users (id, name, email, password_hash, role, department_id, failed_logins) VALUES (?, ?, ?, ?, 'student', 1, 0)",
            (uid, name, email, PASSWORD_HASH),
        )
        cur.execute(
            "INSERT INTO students (user_id, roll_no, batch, section) VALUES (?, ?, '2024', 'A')",
            (uid, roll_no),
        )
        cur.execute(
            "INSERT INTO mentor_assignments (mentor_id, student_id) VALUES (3, ?)",
            (uid,),
        )
        student_ids.append(uid)

    # 3. 5 Subjects
    subjects = [
        (1, "CS501", "Operating Systems", "OS", 45),
        (2, "CS502", "Database Management Systems", "DBMS", 45),
        (3, "CS503", "Computer Networks", "CN", 40),
        (4, "CS504", "Design & Analysis of Algorithms", "DAA", 45),
        (5, "CS505", "Software Engineering", "SE", 40),
    ]
    for cid, code, name, short_name, total_classes in subjects:
        cur.execute(
            "INSERT INTO courses (id, code, name, semester_id, department_id, total_classes, short_name) VALUES (?, ?, ?, 1, 1, ?, ?)",
            (cid, code, name, total_classes, short_name),
        )
        cur.execute(
            "INSERT INTO course_staff (course_id, user_id, role) VALUES (?, 3, 'instructor')",
            (cid,),
        )
        for sid in student_ids:
            cur.execute(
                "INSERT INTO enrolments (student_id, course_id, enrolled_on) VALUES (?, ?, ?)",
                (sid, cid, sem_start),
            )

    # 4. Rooms & Timetable
    rooms = [
        (1, "Room 101", 60, "classroom", 1),
        (2, "Room 102", 60, "classroom", 1),
        (3, "Lab 201", 30, "lab", 1),
        (4, "Seminar Hall 301", 80, "seminar", 1),
    ]
    for r in rooms:
        cur.execute(
            "INSERT INTO rooms (id, name, capacity, room_type, department_id) VALUES (?, ?, ?, ?, ?)",
            r,
        )

    cur.execute(
        """
        INSERT INTO timetable_versions (
            id, department_id, semester_id, status, effective_from,
            created_by, published_at, name, conflicts_json, is_published_with_conflicts
        ) VALUES (1, 1, 1, 'published', ?, 2, ?, 'CSE Sem 5 — Section A', '[]', 0)
        """,
        (sem_start, NOW.isoformat()),
    )

    periods = [
        ("09:00", "09:50", "P1", 0),
        ("10:00", "10:50", "P2", 0),
        ("11:00", "11:50", "P3", 0),
        ("12:00", "12:50", "Lunch", 1),
        ("13:00", "13:50", "P4", 0),
        ("14:00", "14:50", "P5", 0),
    ]
    for day in range(5):  # Mon..Fri
        for st, et, lbl, is_brk in periods:
            cur.execute(
                "INSERT INTO period_configs (version_id, day, start_time, end_time, label, is_break) VALUES (1, ?, ?, ?, ?, ?)",
                (day, st, et, lbl, is_brk),
            )

    # Weekly schedule for Section A across all 5 subjects
    slot_plan = [
        # day, course_id, room_id, label, kind, start, end
        (0, 1, 1, "P1", "lecture", "09:00", "09:50"),
        (0, 2, 1, "P2", "lecture", "10:00", "10:50"),
        (0, 3, 2, "P3", "lecture", "11:00", "11:50"),
        (0, 1, 3, "P4", "lab",     "13:00", "13:50"),
        (1, 4, 1, "P1", "lecture", "09:00", "09:50"),
        (1, 5, 2, "P2", "lecture", "10:00", "10:50"),
        (1, 1, 1, "P3", "lecture", "11:00", "11:50"),
        (1, 2, 3, "P4", "lab",     "13:00", "13:50"),
        (2, 2, 1, "P1", "lecture", "09:00", "09:50"),
        (2, 3, 1, "P2", "lecture", "10:00", "10:50"),
        (2, 4, 2, "P3", "lecture", "11:00", "11:50"),
        (2, 5, 4, "P4", "tutorial","13:00", "13:50"),
        (3, 3, 2, "P1", "lecture", "09:00", "09:50"),
        (3, 4, 1, "P2", "lecture", "10:00", "10:50"),
        (3, 5, 1, "P3", "lecture", "11:00", "11:50"),
        (3, 3, 3, "P4", "lab",     "13:00", "13:50"),
        (4, 1, 1, "P1", "lecture", "09:00", "09:50"),
        (4, 2, 2, "P2", "lecture", "10:00", "10:50"),
        (4, 4, 4, "P3", "tutorial","11:00", "11:50"),
        (4, 5, 1, "P4", "lecture", "13:00", "13:50"),
    ]
    for day, cid, rid, lbl, kind, st, et in slot_plan:
        cur.execute(
            """
            INSERT INTO timetable_slots (
                version_id, course_id, section, teacher_id, room_id,
                day, period_label, kind, start_time, end_time
            ) VALUES (1, ?, 'A', 3, ?, ?, ?, ?, ?, ?)
            """,
            (cid, rid, day, lbl, kind, st, et),
        )

    # 5. Holidays
    holidays = [
        ((TODAY - timedelta(days=25)).isoformat(), "Founders Day"),
        ((TODAY + timedelta(days=12)).isoformat(), "Annual Tech Fest"),
        ((TODAY + timedelta(days=30)).isoformat(), "Mid-Semester Break"),
    ]
    for hdate, hlabel in holidays:
        cur.execute(
            "INSERT INTO holidays (semester_id, date, label) VALUES (1, ?, ?)",
            (hdate, hlabel),
        )

    # 6. Class Sessions & Attendance Records (past 40 weekdays, ~16 sessions per subject)
    weekdays = [
        TODAY - timedelta(days=d)
        for d in range(42, 0, -1)
        if (TODAY - timedelta(days=d)).weekday() < 5
    ]

    # Target attendance probability per student (1..20)
    # Student 1 (Aarav) ~ 82% overall; students 16-20 lower attendance for realistic risk/condonation
    student_probs = {}
    for i, sid in enumerate(student_ids):
        if i == 0:
            student_probs[sid] = 0.84
        elif i < 12:
            student_probs[sid] = 0.85 + (i % 4) * 0.03
        elif i < 16:
            student_probs[sid] = 0.72 + (i % 3) * 0.02
        else:
            student_probs[sid] = 0.58 + (i % 3) * 0.02

    session_id = 1
    for cid, _, _, _, _ in subjects:
        # Pick ~16 weekdays for this subject
        course_days = weekdays[cid % 2 :: 2][:16]
        for day_idx, held_on in enumerate(course_days):
            cur.execute(
                "INSERT INTO class_sessions (id, course_id, held_on, is_cancelled) VALUES (?, ?, ?, 0)",
                (session_id, cid, held_on.isoformat()),
            )
            for s_idx, sid in enumerate(student_ids):
                # Give Aarav (sid=4) lower attendance in CS503 (cid=3) so one course shows watch/cushion warning
                p = 0.70 if (sid == 4 and cid == 3) else student_probs[sid]
                # Make students 17-20 have 3 consecutive absences at the end for Needs Attention
                if s_idx >= 16 and day_idx >= len(course_days) - 3:
                    status = "absent"
                else:
                    status = "present" if random.random() < p else "absent"
                cur.execute(
                    "INSERT INTO attendance_records (student_id, session_id, status, marked_by, marked_at) VALUES (?, ?, ?, 3, ?)",
                    (sid, session_id, status, NOW.isoformat()),
                )
            session_id += 1

    # 7. Risk Snapshots for all 20 students
    for s_idx, sid in enumerate(student_ids):
        if s_idx < 12:
            score, band, worst = round(15 + s_idx * 1.2, 2), "safe", 3
        elif s_idx < 16:
            score, band, worst = round(42 + (s_idx - 12) * 5.0, 2), "watch", 3
        elif s_idx < 18:
            score, band, worst = round(64 + (s_idx - 16) * 6.0, 2), "risk", 1
        else:
            score, band, worst = round(84 + (s_idx - 18) * 4.0, 2), "critical", 4
        # Previous snapshot (7 days ago) + current snapshot
        cur.execute(
            "INSERT INTO risk_snapshots (student_id, computed_at, score, band, worst_course_id, config_id) VALUES (?, ?, ?, ?, ?, 1)",
            (sid, (NOW - timedelta(days=7)).isoformat(), max(10, score - 5), band, worst),
        )
        cur.execute(
            "INSERT INTO risk_snapshots (student_id, computed_at, score, band, worst_course_id, config_id) VALUES (?, ?, ?, ?, ?, 1)",
            (sid, NOW.isoformat(), score, band, worst),
        )

    # 8. Assignments & Submissions (2 per subject)
    asg_templates = [
        (1, "CPU Scheduling Simulator", "lab file", 4),
        (1, "Memory Management Review", "review", 10),
        (2, "ER Diagram & Normalization", "assignment", 5),
        (2, "SQL Query Lab File", "lab file", 14),
        (3, "TCP Socket Programming", "lab file", 3),
        (3, "Subnetting Worksheet", "assignment", 9),
        (4, "Dynamic Programming Problem Set", "assignment", 6),
        (4, "Graph Algorithms Lab File", "lab file", 15),
        (5, "SRS Document Review", "review", 7),
        (5, "Mid-Sem Exam Prep", "exam", 18),
    ]
    asg_id = 1
    for cid, title, kind, due_days in asg_templates:
        due_at = (NOW + timedelta(days=due_days)).isoformat()
        cur.execute(
            "INSERT INTO assignments (id, course_id, title, kind, description, due_at, grace_hours, is_published) VALUES (?, ?, ?, ?, ?, ?, 24, 1)",
            (asg_id, cid, title, kind, f"{title} for Section A", due_at),
        )
        # Seed submissions for roughly half the students on earlier assignments
        if due_days <= 7:
            for s_idx, sid in enumerate(student_ids[:14]):
                cur.execute(
                    "INSERT INTO submissions (assignment_id, student_id, version, status, submitted_at, dedupe_key) VALUES (?, ?, 1, 'on_time', ?, ?)",
                    (asg_id, sid, (NOW - timedelta(days=1)).isoformat(), f"{asg_id}:{sid}:1"),
                )
        asg_id += 1

    # 9. Leave Requests
    cur.execute(
        """
        INSERT INTO leave_requests (student_id, type, date_from, date_to, reason, status, created_at)
        VALUES (4, 'medical', ?, ?, 'Medical document: clinic_prescription.pdf', 'pending', ?)
        """,
        ((TODAY - timedelta(days=2)).isoformat(), (TODAY - timedelta(days=1)).isoformat(), (NOW - timedelta(hours=5)).isoformat()),
    )
    cur.execute(
        """
        INSERT INTO leave_requests (student_id, type, date_from, date_to, reason, status, decided_by, decided_at, decision_note, created_at)
        VALUES (4, 'duty', ?, ?, 'Smart India Hackathon — Coding Club — (Team Lead)', 'approved', 3, ?, 'Approved for university representation.', ?)
        """,
        ((TODAY - timedelta(days=15)).isoformat(), (TODAY - timedelta(days=14)).isoformat(), (NOW - timedelta(days=13)).isoformat(), (NOW - timedelta(days=16)).isoformat()),
    )
    cur.execute(
        """
        INSERT INTO leave_requests (student_id, type, date_from, date_to, reason, status, created_at)
        VALUES (5, 'duty', ?, ?, 'Inter-College Debate — Literary Society — (Speaker)', 'pending', ?)
        """,
        ((TODAY + timedelta(days=2)).isoformat(), (TODAY + timedelta(days=3)).isoformat(), (NOW - timedelta(hours=3)).isoformat()),
    )
    cur.execute(
        """
        INSERT INTO leave_requests (student_id, type, date_from, date_to, reason, status, decided_by, decided_at, decision_note, created_at)
        VALUES (6, 'medical', ?, ?, 'Medical leave', 'rejected', 3, ?, 'Please attach a valid doctor note.', ?)
        """,
        ((TODAY - timedelta(days=10)).isoformat(), (TODAY - timedelta(days=9)).isoformat(), (NOW - timedelta(days=8)).isoformat(), (NOW - timedelta(days=11)).isoformat()),
    )

    # 10. Condonation Requests
    cur.execute(
        """
        INSERT INTO condonation_requests (student_id, semester_id, attendance_pct_at_request, reason, status, recommended_by, created_at)
        VALUES (22, 1, 61.50, 'Hospitalized for dengue recovery; medical records verified by mentor.', 'recommended', 3, ?)
        """,
        ((NOW - timedelta(days=2)).isoformat(),),
    )
    cur.execute(
        """
        INSERT INTO condonation_requests (student_id, semester_id, attendance_pct_at_request, reason, status, recommended_by, decided_by, decision_note, decided_at, created_at)
        VALUES (23, 1, 66.00, 'National robotics finals representation.', 'approved', 3, 2, 'Condoned based on mentor recommendation.', ?, ?)
        """,
        ((NOW - timedelta(days=3)).isoformat(), (NOW - timedelta(days=5)).isoformat()),
    )

    # 11. Interventions
    cur.execute(
        """
        INSERT INTO interventions (student_id, course_id, created_by, kind, note, follow_up_on, outcome, score_at_creation, band_at_creation, created_at)
        VALUES (21, 1, 3, 'talk', 'Discussed recent absences and created weekly catch-up plan.', ?, 'open', 70.00, 'risk', ?)
        """,
        ((TODAY + timedelta(days=4)).isoformat(), (NOW - timedelta(days=2)).isoformat()),
    )
    cur.execute(
        """
        INSERT INTO interventions (student_id, course_id, created_by, kind, note, follow_up_on, outcome, score_at_creation, band_at_creation, created_at, closed_at)
        VALUES (20, 3, 3, 'call', 'Spoke with guardian regarding attendance in Computer Networks.', ?, 'recovered', 64.00, 'risk', ?, ?)
        """,
        ((TODAY - timedelta(days=1)).isoformat(), (NOW - timedelta(days=10)).isoformat(), (NOW - timedelta(days=1)).isoformat()),
    )

    # 12. Notices, Recipients & Deadlines
    audience_spec = json.dumps({"scope": "section", "department_id": 1, "section": "A"})
    notices = [
        (1, 2, "Mid-Semester Exam Schedule Released", "Mid-semester examinations for CSE Sem 5 Section A begin next month. Check your timetable and room allocations.", "exam", 1, "published", "CSE · Sem 5 · Section A", "high"),
        (2, 3, "CS503 Lab Submission Window", "Please submit your TCP Socket Programming lab before Friday 11:59 PM.", "assignment", 0, "published", "CSE · Sem 5 · Section A", "normal"),
        (3, 2, "Annual Tech Fest Registration Open", "Students participating in Hackathon / Tech Fest events can apply for Duty Leave via My Leave.", "event", 0, "published", "CSE · Sem 5 · Section A", "normal"),
    ]
    for nid, sender, title, body, cat, urgent, status_v, aud_sum, prio in notices:
        cur.execute(
            """
            INSERT INTO notices (id, sender_id, title, body, category, urgent, status, audience_spec, created_at, priority, audience_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (nid, sender, title, body, cat, urgent, status_v, audience_spec, (NOW - timedelta(days=nid)).isoformat(), prio, aud_sum),
        )
        for sid in student_ids:
            cur.execute(
                "INSERT INTO notice_recipients (notice_id, user_id, delivered_at) VALUES (?, ?, ?)",
                (nid, sid, (NOW - timedelta(days=nid)).isoformat()),
            )
    cur.execute(
        "INSERT INTO notice_deadlines (notice_id, kind, at, label, source, confirmed_by) VALUES (1, 'exam', ?, 'Mid-Sem Exams Begin', 'manual', 2)",
        ((NOW + timedelta(days=20)).isoformat(),),
    )
    cur.execute(
        "INSERT INTO notice_deadlines (notice_id, kind, at, label, source, confirmed_by) VALUES (2, 'assignment', ?, 'CS503 Lab Due', 'manual', 3)",
        ((NOW + timedelta(days=3)).isoformat(),),
    )

    # 13. Notifications
    notifs = [
        (4, "Leave Request Approved", "Your duty leave for Smart India Hackathon was approved by Dr. Priya Nair.", "info", None, 0),
        (4, "Attendance Buffer Notice", "Your attendance in CS503 (Computer Networks) is close to the 75% threshold.", "warning", 3, 0),
        (3, "New Mentee Leave Request", "Aarav Sharma (24CSE001) submitted a medical leave request for review.", "reminder", None, 0),
        (3, "Students Needing Support", "4 mentees in Section A have 3+ consecutive absences.", "warning", None, 0),
        (2, "Condonation Queue Item", "Dr. Priya Nair recommended condonation for Karan Kapoor (61.5%).", "alert", None, 0),
    ]
    for idx, (rec_id, title, msg, kind, cid, is_read) in enumerate(notifs, start=1):
        cur.execute(
            "INSERT INTO notifications (recipient_id, title, message, kind, course_id, is_read, created_at, dedup_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (rec_id, title, msg, kind, cid, is_read, NOW.isoformat(), f"demo-notif-{idx}"),
        )

    conn.commit()
    conn.close()
    print("Clean demo seed completed successfully.")


if __name__ == "__main__":
    seed()
