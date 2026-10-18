"""
Live demo of the AcadFlow Risk Engine — Appendix A scenarios
Run: cd backend && python demo_risk_engine.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.main import app
from app.core.deps import get_db
from app.core.security import get_password_hash
from app.models import (
    DepartmentModel, SemesterModel, UserModel, StudentModel,
    CourseModel, EnrolmentModel, ClassSessionModel,
    AttendanceRecordModel, RiskConfigModel,
)
from app.services.buffer import compute_margin_score

# In-memory SQLite (no Postgres needed for demo)
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
db = Session()

# Seed reference data
dept = DepartmentModel(name="CSE", code="CSE")
db.add(dept); db.flush()

sem = SemesterModel(name="Sem5-2026", start_date=date(2026, 7, 15), end_date=date(2026, 12, 20))
db.add(sem); db.flush()

cfg = RiskConfigModel(
    w_margin=Decimal("50"), w_trend=Decimal("20"),
    w_deadline=Decimal("20"), w_missed=Decimal("10"),
    t_watch=Decimal("30"), t_risk=Decimal("55"),
    t_critical=Decimal("80"), min_classes=8, version="v1",
)
db.add(cfg); db.flush()

faculty = UserModel(
    name="Dr. Priya Nair", email="faculty@demo.edu",
    password_hash=get_password_hash("Demo@123"),
    role="faculty", department_id=dept.id,
)
db.add(faculty); db.flush()

# Appendix A: all use a 60-class course, threshold 75%, required=45
SCENARIOS = [
    ("Riya Sharma",  "riya@demo.edu",  "001", 40, 30),
    ("Aman Khanna",  "aman@demo.edu",  "002", 40, 36),
    ("Meera Pillai", "meera@demo.edu", "003", 40, 40),
    ("Karan Singh",  "karan@demo.edu", "004", 50, 30),
    ("Dev Gupta",    "dev@demo.edu",   "005",  5,  5),
]

student_map = {}
for name, email, roll, held, attended in SCENARIOS:
    u = UserModel(
        name=name, email=email,
        password_hash=get_password_hash("Demo@123"),
        role="student", department_id=dept.id,
    )
    db.add(u); db.flush()

    s = StudentModel(user_id=u.id, roll_no=roll, batch="2026")
    db.add(s); db.flush()

    c = CourseModel(
        code="CS5" + roll, name="Data Structures & Algorithms",
        semester_id=sem.id, department_id=dept.id, total_classes=60,
    )
    db.add(c); db.flush()

    db.add(EnrolmentModel(student_id=s.user_id, course_id=c.id, enrolled_on=date(2026, 7, 15)))

    sessions = []
    for i in range(held):
        cs = ClassSessionModel(
            course_id=c.id,
            held_on=date(2026, 8, 1) + timedelta(days=i),
            is_cancelled=False,
        )
        db.add(cs); db.flush()
        sessions.append(cs)

    for i, cs in enumerate(sessions):
        db.add(AttendanceRecordModel(
            session_id=cs.id, student_id=s.user_id,
            status="present" if i < attended else "absent",
            marked_by=faculty.id, marked_at=datetime.now(timezone.utc),
        ))

    student_map[name] = (s.user_id, c.id, held, attended)

db.commit()

# Wire DB override
app.dependency_overrides[get_db] = lambda: (yield db)
client = TestClient(app, raise_server_exceptions=False)

# ── DEMO ──────────────────────────────────────────────────────────────────────
W = 68
print("\n" + "=" * W)
print("  ACADFLOW RISK ENGINE  —  LIVE DEMONSTRATION")
print("  Server  : http://localhost:8000")
print("  Swagger : http://localhost:8000/docs")
print("=" * W)

h = client.get("/api/v1/health").json()
root = client.get("/").json()
print(f"\n  Health : {h}")
print(f"  Root   : {root}")

# --- Buffer table ---
print("\n" + "-" * W)
print("  APPENDIX A — Attendance Buffer")
print("  Course: 60 classes | Threshold: 75% | Required: 45")
print("-" * W)
print(f"  {'Student':<14} {'Held':>4} {'Att':>4} {'Buffer':>7} {'Margin':>7}  Status")
print(f"  {'-'*14} {'-'*4} {'-'*4} {'-'*7} {'-'*7}  {'-'*30}")

for name, (sid, cid, held, attended) in student_map.items():
    r = client.get(f"/api/v1/attendance/students/{sid}/courses/{cid}/buffer")
    b = r.json()
    buf_str = str(b["buffer"]) if b["buffer"] is not None else "N/A"
    if b["buffer"] is not None and b["remaining"]:
        margin = compute_margin_score(b["buffer"], b["remaining"])
        margin_str = f"{margin:.1f}"
    else:
        margin_str = "N/A"
    print(f"  {name:<14} {held:>4} {attended:>4} {buf_str:>7} {margin_str:>7}  {b['status_message']}")

# --- Risk score table ---
print("\n" + "-" * W)
print("  RISK SCORES  (margin component active; trend/deadlines need live DB)")
print("-" * W)
print(f"  {'Student':<14} {'Score':>6}  {'Band':<22} Insufficient?")
print(f"  {'-'*14} {'-'*6}  {'-'*22} {'-'*13}")

for name, (sid, cid, _, _) in student_map.items():
    r = client.get(f"/api/v1/risk/students/{sid}/courses/{cid}")
    d = r.json()
    score_str = f"{d['score']:.1f}" if d["score"] is not None else "null"
    insuf = "YES (< 8 sessions)" if d["insufficient_data"] else "no"
    print(f"  {name:<14} {score_str:>6}  {d['band']:<22} {insuf}")

# --- Phase G demo: change attendance, check score changes ---
print("\n" + "-" * W)
print("  PHASE G DEMO — Change Riya's attendance, verify score updates")
print("-" * W)

riya_sid, riya_cid, _, _ = student_map["Riya Sharma"]

r_before = client.get(f"/api/v1/risk/students/{riya_sid}/courses/{riya_cid}")
before = r_before.json()
print(f"  Before : score={before['score']}, buffer={before['buffer']}, band={before['band']}")

# Mark a new session (simulating attendance correction via API)
r_sess = client.post("/api/v1/attendance/sessions", json={
    "course_id": riya_cid, "held_on": "2026-11-01", "is_cancelled": False
})
if r_sess.status_code == 201:
    new_sess_id = r_sess.json()["id"]
    client.post(f"/api/v1/attendance/sessions/{new_sess_id}/mark", json={
        "session_id": new_sess_id,
        "records": [{"session_id": new_sess_id, "student_id": riya_sid, "status": "present"}]
    })
    r_after = client.get(f"/api/v1/risk/students/{riya_sid}/courses/{riya_cid}")
    after = r_after.json()
    print(f"  After  : score={after['score']}, buffer={after['buffer']}, band={after['band']}")
    changed = "YES" if before["buffer"] != after["buffer"] else "NO"
    print(f"  Buffer changed: {changed}  (before={before['buffer']} -> after={after['buffer']})")

# --- All live routes ---
print("\n" + "-" * W)
print("  ALL LIVE API ROUTES")
print("-" * W)
spec = client.get("/api/v1/openapi.json").json()
for path in sorted(spec["paths"].keys()):
    methods = ", ".join(m.upper() for m in spec["paths"][path].keys())
    print(f"  [{methods:<18}]  {path}")

print("\n" + "=" * W)
print("  TESTS:  cd backend && python -m pytest tests/unit/ -v")
print("  DOCS:   http://localhost:8000/docs")
print("=" * W + "\n")
