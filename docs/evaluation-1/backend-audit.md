# AcadFlow Evaluation 1 — Backend Audit

**Date:** 2026-10-16  
**Auditor:** Member 2 (Security & Infrastructure)  
**Test result:** ✅ 49 / 49 passing

---

## 1. Integration Status

### 1.1 Merge Summary

| Commit | Author | Description |
|--------|--------|-------------|
| `64e40e6` | Liza | Initialize full-stack directory structure |
| `cf718b2` | Liza | sys.path resolution for pytest |
| `6aa749f` | Liza | CI format / ruff / frontend lockfile |
| `00e0d35` | Liza | CD workflow fix |
| `5bc8fbf` | Liza | **3NF models, Alembic migration, RESTful APIs, integration tests** |
| `c6b9145` | Himanshi | Security: RBAC, sessions, JWT, lockout, CSRF, audit, rate limiting |
| `393d4ac` | Merge | Integrated Liza's backend — 2 conflicts resolved (config.py, conftest.py) |
| `624ba60` | Himanshi | Auth endpoints, middleware wiring, argon2id, 49 tests |

### 1.2 Conflict Resolution

**`backend/app/core/config.py`**  
- Liza added `model_config = SettingsConfigDict(...)` (replaces inner `Config` class).  
- Member 2 added `ENVIRONMENT`, security fields (`LOCKOUT_THRESHOLD`, `LOCKOUT_DURATION_SECONDS`, `RATE_LIMIT_*`), and a `@model_validator` for production secret enforcement.  
- **Resolution:** Both changes combined; Member 2 security fields placed after Liza's DB connection settings.

**`backend/tests/conftest.py`**  
- Liza added a full SQLite in-memory test DB setup with `db_session`, `client`, seeded `DepartmentModel`, `SemesterModel`, `StudentModel`, `UserModel`.  
- Member 2 had a minimal `async_client` fixture only.  
- **Resolution:** Kept all of Liza's fixtures plus Member 2's `async_client` fixture appended at the bottom.

---

## 2. Backend Inventory

### 2.1 Models (18 tables — all implemented in `001_initial_schema.py`)

| Table | Model Class | File |
|-------|------------|------|
| departments | DepartmentModel | models/user.py |
| organizations | OrganizationModel | models/user.py |
| users | UserModel | models/user.py |
| students | StudentModel | models/user.py |
| dean_assignments | DeanAssignmentModel | models/user.py |
| mentor_assignments | MentorAssignmentModel | models/user.py |
| semesters | SemesterModel | models/course.py |
| holidays | HolidayModel | models/course.py |
| courses | CourseModel | models/course.py |
| course_staff | CourseStaffModel | models/course.py |
| enrolments | EnrolmentModel | models/enrollment.py |
| class_sessions | ClassSessionModel | models/attendance.py |
| attendance_records | AttendanceRecordModel | models/attendance.py |
| assignments | AssignmentModel | models/assignment.py |
| submissions | SubmissionModel | models/submission.py |
| risk_config | RiskConfigModel | models/risk.py |
| risk_snapshots | RiskSnapshotModel | models/risk.py |
| audit_log | AuditLogModel | models/audit.py |

### 2.2 API Endpoints

#### Auth (`/api/v1/auth`)
| Method | Path | Status | Auth Required |
|--------|------|--------|--------------|
| GET | `/` | ✅ Stub (keep) | No |
| POST | `/register` | ✅ Implemented | No |
| POST | `/login` | ✅ Implemented + lockout | No |
| POST | `/refresh` | ✅ Implemented + rotation | Cookie |
| POST | `/logout` | ✅ Implemented + revocation | Cookie |
| GET | `/me/token` | ✅ Dev helper | Bearer |

#### Students (`/api/v1/students`)
| Method | Path | Status |
|--------|------|--------|
| GET | `` | ✅ Paginated list + filters |
| POST | `` | ✅ Create (unique email + roll) |
| GET | `/{user_id}` | ✅ Get by ID |

#### Courses (`/api/v1/courses`)
| Method | Path | Status |
|--------|------|--------|
| GET | `` | ✅ Paginated list + filters + sort |
| POST | `` | ✅ Create |
| GET | `/{course_id}` | ✅ Get by ID |
| PUT | `/{course_id}` | ✅ Update |
| DELETE | `/{course_id}` | ✅ Delete |
| POST | `/{course_id}/enrol` | ✅ Batch enrol |

#### Other Router Stubs (attendance, assignments, submissions, notifications, risk, mentor, coordinator, admin)
- All routers are wired in `router.py`.
- All endpoint files exist (Liza's stubs return `{"endpoint": "...", "status": "active"}`).
- **Not yet implemented** — planned for Evaluation 2.

---

## 3. Security Modules (Member 2)

| Module | Purpose | Tests |
|--------|---------|-------|
| `core/authorization.py` | RBAC scope engine (`can_access`) | 7 passing |
| `core/session.py` | Redis session store + cookie flags | 2 passing |
| `core/tokens.py` | JWT access+refresh, rotation, revocation | 4 passing |
| `core/lockout.py` | Redis sliding-window login lockout | 3 passing |
| `core/rate_limit.py` | Sliding-window rate limiter + anti-IP-spoofing | 2 passing |
| `core/audit.py` | Structured audit log + credential redaction | 2 passing |
| `core/csrf.py` | CSRF double-submit token + origin validation | 2 passing |
| `core/sanitization.py` | HTML/XSS sanitization utilities | 1 passing |
| `core/middleware.py` | Security headers middleware | Wired in `main.py` |
| `core/security.py` | argon2id hashing + bcrypt legacy verify | — |
| `api/deps.py` | Real JWT `get_current_user`, `require_roles` | — |

---

## 4. Test Coverage

```
tests/integration/test_api.py              1 test   ✅
tests/integration/test_auth_api.py        12 tests  ✅ NEW
tests/integration/test_courses_api.py      5 tests  ✅ Liza
tests/integration/test_students_api.py     3 tests  ✅ Liza
tests/security/test_audit.py               2 tests  ✅
tests/security/test_authorization.py       7 tests  ✅
tests/security/test_config.py              2 tests  ✅
tests/security/test_csrf_and_sanitization.py 3 tests ✅
tests/security/test_lockout.py             3 tests  ✅
tests/security/test_rate_limit.py          2 tests  ✅
tests/security/test_security.py            1 test   ✅
tests/security/test_session_and_tokens.py  4 tests  ✅
tests/unit/test_buffer.py                  1 test   ✅ Liza
tests/unit/test_reminders.py               1 test   ✅ Liza
tests/unit/test_risk.py                    1 test   ✅ Liza

TOTAL: 49 / 49 passed
```

---

## 5. Known Issues / TODOs

### 5.1 Fixed This Session
- ✅ `bcrypt` v5 raises `ValueError` for passwords > 72 bytes — switched to **argon2id** primary (bcrypt as deprecated fallback).
- ✅ Missing `psycopg`, `pydantic[email]`, `argon2-cffi`, `bcrypt` packages — all installed and added to `requirements.txt`.
- ✅ `httpx.AsyncClient(app=app)` deprecated pattern — fixed to `ASGITransport`.
- ✅ `can_access()` was a stub returning `True` — wired to real `require_roles` in `api/deps.py`.

### 5.2 Outstanding
- ⚠️ **`students.py` uses `hashlib.sha256`** for password hashing on student creation — this is insecure. Should call `get_password_hash` from `core/security.py`. Liza's file; needs cross-team alignment before modifying.
- ⚠️ **`CORS allow_origins=["*"]`** — must be restricted to the frontend origin before production. Add `ALLOWED_ORIGINS` env var.
- ⚠️ **`COOKIE_SECURE=False`** in `auth.py` — must be `True` in production (HTTPS only).
- ⚠️ Attendance, assignments, submissions, notifications, risk, mentor, coordinator, admin endpoints are stubs — Evaluation 2 scope.
- ⚠️ Alembic migration must be run against a live PostgreSQL instance (`alembic upgrade head`) before the Docker Compose stack is used.
- ⚠️ Rate limiter not yet applied as FastAPI middleware/dependency to `auth/login` — apply for production hardening.

---

## 6. Dependency Tree

```
fastapi >= 0.110
uvicorn[standard]
pydantic >= 2.6 (+ [email])
pydantic-settings >= 2.2
sqlalchemy >= 2.0
psycopg[binary] >= 3.1  ← Liza's sync SQLAlchemy engine
asyncpg >= 0.29          ← future async usage
motor >= 3.3             ← MongoDB (notifications)
redis >= 5.0             ← sessions, rate limiting, token revocation
alembic >= 1.13
python-jose[cryptography] >= 3.3
passlib[bcrypt] >= 1.7
argon2-cffi >= 21.3      ← NEW: primary password hashing
python-multipart >= 0.0.9 ← form login
httpx >= 0.27
```

---

## 7. How to Run Locally

```bash
# 1. Install all dependencies
pip3 install -r backend/requirements.txt

# 2. Run tests (no database needed — uses SQLite in-memory)
cd backend && python3 -m pytest tests/ -v

# 3. Start the API (needs .env with DATABASE_URL pointing to Postgres)
cd backend && uvicorn app.main:app --reload

# 4. Or use Docker Compose (starts Postgres + Redis + 2 API replicas + NGINX)
cd deploy && docker compose up --build
```
