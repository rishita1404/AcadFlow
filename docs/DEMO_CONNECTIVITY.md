# AcadFlow Demo Connectivity Audit

Generated on branch `fix/demo-connectivity`.

---

## 1. Page & Route Connectivity Matrix

All routes in `frontend/src/app/router.jsx` use `apiClient` (`frontend/src/api/client.js`) via `frontend/src/api/endpoints.js` and TanStack Query, **except** where noted below.

| Role / Area | Route | Component | Data Source | Endpoint(s) Used | Status |
|---|---|---|---|---|---|
| Auth | `/login` | `LoginPage.jsx` / `SignInCard.jsx` | Real API + `DEMO_ACCOUNTS` chips | `POST /auth/login`, `GET /me` | Connected |
| Auth | `/403` | `ForbiddenPage.jsx` | Static UI | — | N/A |
| Student | `/student/home`, `/student/courses` | `StudentHome.jsx` | Real API | `GET /me/dashboard` | Connected |
| Student | `/student/attendance` | `StudentAttendance.jsx` | Real API | `GET /me/dashboard`, `GET /attendance/students/:id/courses/:cid/buffer` | Connected |
| Student | `/student/courses/:id` | `StudentCourseDetail.jsx` | Real API | `GET /courses/:id`, `GET /attendance/students/:id/courses/:cid/history`, `GET /assignments` | Connected |
| Student | `/student/calendar` | `StudentCalendar.jsx` | Real API | `GET /me/calendar/:y/:m`, `GET/POST/DELETE /me/holidays`, `POST /me/plan/project` | Connected |
| Student | `/student/leave` | `StudentLeave.jsx` | Real API | `GET /leave/my-requests`, `POST /leave/requests` | Connected |
| Student | `/student/tasks` | `StudentTasks.jsx` | Real API | `GET /me/tasks`, `GET /me/deadlines`, `POST /submissions` | Connected |
| Student | `/student/assignments/:id` | `StudentAssignmentDetail.jsx` | Real API | `GET /assignments/:id`, `GET /submissions`, `POST /submissions` | Connected |
| Student | `/student/risk` | `StudentRisk.jsx` | Real API | `GET /risk/students/:id`, `GET /me/dashboard` | Connected |
| Student | `/student/timetable` | `StudentTimetable.jsx` | Real API | `GET /timetable/me` | Connected |
| Student | `/student/notices` | `StudentNotices.jsx` | Real API | `GET /notices/me`, `POST /notices/:id/seen`, `POST /notices/:id/done` | Connected |
| Student | `/student/notifications` | `StudentNotifications.jsx` | Real API | `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all` | Connected |
| **Student** | **`/student/preferences`** | **`StudentPreferences.jsx`** | **Local React `useState` only** | **None (`handleSave` sets local timer)** | **DISCONNECTED (Mock/Local)** |
| Faculty / Mentor | `/faculty/home` | `FacultyHome.jsx` | Real API | `GET /courses`, `GET /faculty/needs-attention` | Connected |
| Faculty / Mentor | `/faculty/courses/:id` | `FacultyCourseDetail.jsx` | Real API | `GET /courses/:id`, `GET /risk/courses/:id`, `GET /attendance/courses/:id/date/:d`, `POST /attendance/direct-mark` | Connected |
| Faculty / Mentor | `/faculty/attendance/upload` | `FacultyAttendanceUpload.jsx` | Real API | `POST /courses/:id/attendance/preview`, `POST /attendance/upload`, `POST /courses/:id/attendance/undo` | Connected |
| Faculty / Mentor | `/faculty/at-risk` | `FacultyAtRisk.jsx` | Real API | `GET /courses`, `GET /risk/courses/:id`, `POST /interventions` | Connected |
| Faculty / Mentor | `/faculty/assignments` | `FacultyAssignments.jsx` | Real API | `GET /assignments`, `POST /assignments`, `GET /submissions`, `POST /assignments/collision-preview` | Connected |
| Faculty / Mentor | `/faculty/mentees` | `FacultyMentees.jsx` | Real API | `GET /mentor/students` | Connected |
| Faculty / Mentor | `/faculty/mentees/:id` | `FacultyMenteeDetail.jsx` | Real API | `GET /mentor/students/:id`, `GET /mentor/students/:id/courses`, `GET /interventions/students/:id`, `POST /condonation/recommend` | Connected |
| Faculty / Mentor | `/faculty/sections` | `FacultySections.jsx` | Real API | `GET /courses`, `GET /students` | Connected |
| Faculty / Mentor | `/faculty/timetable` | `FacultyTimetable.jsx` | Real API | `GET /timetable/me` | Connected |
| Faculty / Mentor | `/faculty/leave` | `FacultyLeaveInbox.jsx` | Real API | `GET /leave/inbox`, `POST /leave/requests/:id/decide` | Connected |
| Staff / Notices | `/notices`, `/notices/compose` | `StaffNotices.jsx`, `ComposeNotice.jsx` | Real API | `GET /notices`, `POST /notices`, `POST /notices/audience/preview`, `POST /notices/extract`, `GET /notices/:id/recipients`, `POST /notices/:id/nudge` | Connected |
| Staff / Notifications | `/notifications` | `NotificationsPage.jsx` | Real API | `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all` | Connected |
| Dean / Coordinator | `/coordinator/summary` | `CoordinatorSummary.jsx` | Real API | `GET /coordinator/summary`, `GET /coordinator/overview` | Connected |
| Dean / Coordinator | `/coordinator/deadlines` | `CoordinatorDeadlines.jsx` | Real API | `GET /coordinator/deadline-load` | Connected |
| Dean / Coordinator | `/coordinator/students` | `CoordinatorStudents.jsx` | Real API | `GET /coordinator/students`, `GET /coordinator/at-risk` | Connected |
| Dean / Coordinator | `/coordinator/teachers` | `CoordinatorTeachers.jsx` | Real API | `GET /coordinator/teachers`, `GET /departments/:id/mentor-load` | Connected |
| Dean / Coordinator | `/coordinator/timetable`, `/coordinator/timetable/edit` | `CoordinatorTimetable.jsx`, `CoordinatorTimetableEditor.jsx` | Real API | `GET /timetable/versions`, `GET/PUT /timetable/draft`, `POST /timetable/publish`, `GET/POST/PATCH/DELETE /timetable/rooms` | Connected |
| Dean / Coordinator | `/dean/condonation` | `DeanCondonationQueue.jsx` | Real API | `GET /condonation/queue`, `POST /condonation/:id/decide` | Connected |
| Dean / Coordinator | `/dean/trends` | `DeanTrends.jsx` | Real API | `GET /departments/:id/trends`, `GET /departments/:id/mentor-load`, `GET /departments/:id/trends/export` | Connected |
| Admin | `/admin` | `AdminDashboard.jsx` | Real API | `GET /admin/stats` | Connected |
| Admin | `/admin/users` | `AdminUsers.jsx` | Real API | `GET/POST/DELETE /admin/users`, `GET /admin/meta`, `POST /admin/courses/:id/enrol` | Connected |
| Admin | `/admin/risk-config` | `AdminRiskConfig.jsx` | Real API | `GET/PUT /admin/risk-config` | Connected |
| Admin | `/admin/audit-logs` | `AdminAuditLog.jsx` | Real API | `GET /admin/audit-logs` | Connected |
| **Admin** | **`/admin/ml`** | **`AdminML.jsx`** | **Hard-coded static cards** (`v2.1-lgbm-quantized`, `0.042 PSI`, `500 records`) | **None (links to localhost:5000 / 3000)** | **DISCONNECTED (Hard-coded)** |
| Legacy Shared | `/attendance`, `/calendar`, `/deadlines`, `/pressure`, `/dashboard` | Legacy wrappers | Real API | Uses `/me/*` & `/attendance/*` | Connected |

---

## 2. Mock Data, Storage & Fetch Audit

- **Direct `fetch()` calls bypassing `apiClient`:** None found in `frontend/src/`. All API calls go through `frontend/src/api/client.js` (`axios`).
- **`localStorage` usage:** Used strictly for JWT auth session persistence (`acadflow_token`, `acadflow_user`, `acadflow_permissions`, `acadflow_active_role`) in `client.js`, `AuthContext.jsx`, and `usePermissions.js`. No `sessionStorage` used.
- **Hard-coded / local-only pages:**
  1. `StudentPreferences.jsx` — stores reminder offsets & channel toggles in React `useState` with a fake `setTimeout` save confirmation and `"Email Digest (Mock Adapter)"` label.
  2. `AdminML.jsx` — renders hard-coded model version, PSI drift (`0.042`), and `"Evaluated on 500 recent student records"` without fetching from backend/ML service.
  3. `SignInCard.jsx` — currently lists 4 demo chips (`Student`, `Faculty / Mentor`, `Dean / Coordinator`, `Admin`) whereas Step 2 requires the 6-account demo universe (`Student`, `Faculty`, `Mentor and coordinator`, `Trainer`, `Dean`, `Admin`).

---

## 3. API Base URL, Proxy, CORS & Database Alignment

- **Frontend API base URL (`frontend/src/api/client.js`):** `import.meta.env.VITE_API_URL || '/api/v1'`.
- **Vite Dev Proxy (`frontend/vite.config.js`):** Proxies `/api` -> `http://127.0.0.1:8000` (`changeOrigin: true`).
- **CORS (`backend/app/main.py`):** `CORSMiddleware` configured with `allow_origins=["*"]`, `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`.
- **Database Mismatch Risk:**
  - `backend/app/db/postgres.py` defaults to **SQLite** (`backend/acadflow.db`) unless `USE_POSTGRES=true` is explicitly set.
  - `scripts/seed_data.py` tries **PostgreSQL** (`DATABASE_URL`) *first* and only falls back to `backend/acadflow.db` if PostgreSQL connection fails. If a local PostgreSQL server is running without `USE_POSTGRES=true`, `seed_data.py` would seed Postgres while the backend reads SQLite! Both must follow the same `USE_POSTGRES` rule so they always target the exact same database.

---

## 4. Silent Failures & Readiness (`/ready`)

1. **MongoDB (`backend/app/db/mongo.py`):** Catches any exception during `motor` import/init (`logger.warning("MongoDB initialization failed: %s", e)`), sets `mongo_client = None, mongo_db = None`, and callers skip Mongo silently.
2. **Redis (`backend/app/db/redis.py`):** When `127.0.0.1:6379` is closed, sets `redis_client = DummyRedis()` which raises `ConnectionError` on `.get/.set/.delete`, and endpoints wrap Redis calls in `try ... except Exception: pass` (e.g., `leave.py`, `attendance.py`, `me.py`).
3. **Background Workers (`backend/app/main.py`):** `reminder_worker`, `missed_submission_worker`, and `risk_worker` are started on `startup` (unless `PYTEST_CURRENT_TEST` or `TESTING` is set), but there is **no `/api/v1/health/ready` (`/ready`)** endpoint reporting live status of PostgreSQL/SQLite, MongoDB, Redis, and background workers.
4. **Attendance Upload Fallback (`backend/app/api/v1/endpoints/attendance.py`):** Swallows per-student recompute exceptions with `except Exception: pass` at line 497 instead of logging a clear warning.

---

## 5. Stale Caches Audit

- **Frontend (`frontend/src/app/providers.jsx`):** `refetchOnWindowFocus: false` and `staleTime: 30_000`. Switching browser tabs/accounts does not automatically refetch data.
- **Notifications Polling (`frontend/src/layouts/AppShell.jsx`):** Polls `unreadCount` every `60_000` ms instead of `30_000` ms.
- **Backend Cache Invalidation:** `leave.py` deletes `dashboard:{id}`, `attendance:{id}`, `risk:{id}` on decision, but mentor/dean/permission caches and `invalidateQueries` on several frontend mutations need to be verified and tightened in Step 3.
