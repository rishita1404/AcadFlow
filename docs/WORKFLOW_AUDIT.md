# AcadFlow Workflow Audit & Specification Gap Analysis

Generated according to the comprehensive AcadFlow Specification.

## Assumptions
1. **Database Fallback**: When PostgreSQL is unavailable locally, SQLite (`acadflow.db`) is used as persistent storage. All SQLAlchemy models, relationships, and queries must remain dialect-agnostic between PostgreSQL and SQLite.
2. **Authentication Flow**: Supports both browser cookie-based session and `Authorization: Bearer <access_token>` header. Token refresh endpoint accepts the refresh token in the JSON request body `{"refresh_token": "..."}` or cookie.
3. **ML Service**: Machine Learning model is an auxiliary advisory signal for Evaluation 1. When offline or unreachable, the system displays "Model score unavailable" without failing and continues utilizing the rule-based risk calculation.
4. **Sections**: In `enrolments`, if section assignment is not explicitly present, students default to section "A".
5. **Timezone**: Date and deadline parsing uses `Asia/Kolkata` (IST, UTC+05:30).

---

## Audit Matrix

| Spec Item | Spec Section | Status | File Path | Fix Needed |
| :--- | :--- | :--- | :--- | :--- |
| **User Roles & Duties** | A | Partial | `backend/app/models/user.py`, `backend/app/core/authorization.py` | Add full duties (`instructor`, `trainer`, `course_coordinator`, `mentor`) mapping in `me.py` permissions; verify RBAC actions. |
| **Permissions Endpoint (`/me/permissions`)** | A | Partial | `backend/app/api/v1/endpoints/me.py` | Return `duties`, `primary_role`, `allowed_roles`, and `department_id` queried dynamically from database per request. |
| **Login Redirects** | A | Missing | `frontend/src/app/router.jsx`, `frontend/src/app/AuthContext.jsx` | Redirect users based on role after login: student -> `/student/home`, faculty -> `/faculty/home`, coordinator -> `/coordinator/summary`, admin -> `/admin`. |
| **Expired Session & 403 Page** | A | Missing | `frontend/src/app/router.jsx`, `frontend/src/pages/ForbiddenPage.jsx` | Redirect expired token to `/login?next=<page>`. Add 403 page with "Back to my home" button. |
| **App Shell & Role Navigation** | A | Partial | `frontend/src/layouts/AppShell.jsx` | Add role-specific sidebars (Student, Faculty, Coordinator, Admin) and top bar role switcher if user holds multiple duties. |
| **Status Labels & Score Expander** | A | Partial | `frontend/src/components/StatusBadge.jsx`, `frontend/src/components/RiskExpander.jsx` | Use icon + text labels: Safe="On track", Watch="Keep an eye", At risk="Needs attention", Critical="Priority support". Add "last computed at" & "Why?" expander. |
| **Buffer Calculation Contract** | B | Present | `backend/app/services/buffer.py` | Verified exact formula: `required = ceil(0.75 * total_classes)`, `still_need = max(0, required - attended)`, `remaining = total_classes - held`, `buffer = remaining - still_need`. Negative buffer status: "Not recoverable by attendance alone". |
| **Risk Score Engine** | B | Present | `backend/app/services/risk.py`, `backend/app/services/risk_data.py` | Verified weights: Margin 50, Trend 20, Deadlines 20, Missed 10. Min classes = 8. Unit test fixtures match Riya, Aman, Meera, Karan, Dev. |
| **Planned Absence & Projection** | B, C | Partial | `backend/app/services/calendar_service.py`, `backend/app/api/v1/endpoints/me.py` | Add `POST /me/plan/project` returning date-based projection: projected %, spare misses left, projected band. |
| **Must-Attend Day Calculation** | B | Partial | `backend/app/services/pressure_forecast.py` | Flag days where missing classes causes buffer to become negative or exam/review due. |
| **Student Home (`/student/home`)** | C (S1) | Missing | `frontend/src/pages/student/StudentHome.jsx` | Build desktop multi-column home with status badge, warning banner, course cards, due this week, today's classes, mini pressure strip, notices strip. |
| **Student Course Detail (`/student/courses/:id`)** | C (S2) | Missing | `frontend/src/pages/student/StudentCourseDetail.jsx` | Tabbed view: Overview, Attendance (%, buffer, history), Deadlines, Announcements, Materials, Risk breakdown. |
| **Student Calendar & Planner (`/student/calendar`)** | C (S3) | Partial | `frontend/src/pages/student/StudentCalendar.jsx` | Attendance vs Pressure modes, Month/Week/Agenda views, right-side day drawer, interactive leave planner with live projection panel. |
| **Student Timetable (`/student/timetable`)** | C (S4) | Missing | `frontend/src/pages/student/StudentTimetable.jsx` | Weekly grid Mon-Sat x time slots, holiday strike-through, recent changes tag, click slot -> course. |
| **Student Tasks (`/student/tasks`)** | C (S5) | Missing | `frontend/src/pages/student/StudentTasks.jsx` | Tabs (This week, Upcoming, Submitted, Missed), course filter, includes assignment & notice deadlines, countdowns. |
| **Student Assignment Detail (`/student/assignments/:id`)** | C (S6) | Missing | `frontend/src/pages/student/StudentAssignmentDetail.jsx` | Timeline bar (Due -> Grace 48h -> Closed), drag-drop submission, receipt card with file hash, version history. |
| **Student Risk Page (`/student/risk`)** | C (S7) | Missing | `frontend/src/pages/student/StudentRisk.jsx` | Stacked bar breakdown (Margin/Trend/Deadlines/Missed), model estimate & version, trend chart, what-if simulator (`POST /me/simulate`). |
| **Student Notifications (`/student/notifications`)** | C (S8) | Partial | `frontend/src/pages/student/StudentNotifications.jsx` | Grouped Today/Earlier, filters, deep links to assignments, notices, timetable, risk. |
| **Student Preferences (`/student/preferences`)** | C (S9) | Missing | `frontend/src/pages/student/StudentPreferences.jsx` | Reminder offsets (7d, 2d, 24h, overdue toggles), channels, quiet hours display. |
| **Faculty Home (`/faculty/home`)** | D (F1) | Missing | `frontend/src/pages/faculty/FacultyHome.jsx` | Duty cards: My courses, My mentees, Sections, Upload attendance shortcut. |
| **Faculty Course Detail (`/faculty/courses/:id`)** | D (F2) | Missing | `frontend/src/pages/faculty/FacultyCourseDetail.jsx` | Roster table, attendance rate, at-risk count, sessions list, add session dialog. |
| **Faculty Attendance Upload (`/faculty/courses/:id/attendance`)** | D (F3) | Partial | `frontend/src/pages/faculty/FacultyAttendanceUpload.jsx`, `backend/app/services/csv_ingest.py` | 4-step wizard: upload & detect, preview & map (`POST /courses/{id}/attendance/preview`), confirm & diff, summary. Audit log on edit. |
| **Faculty At-Risk List (`/faculty/courses/:id/at-risk`)** | D (F4) | Missing | `frontend/src/pages/faculty/FacultyAtRisk.jsx` | Table sorted by risk, buffer indicator, filter by band, export CSV, one-click email/nudge dialog. |
| **Faculty Assignments (`/faculty/courses/:id/assignments`)** | D (F5) | Missing | `frontend/src/pages/faculty/FacultyAssignments.jsx` | Create assignment form with weight/grace period, submissions grading table with file download. |
| **Faculty Mentees (`/faculty/mentees`)** | D (F6) | Missing | `frontend/src/pages/faculty/FacultyMentees.jsx`, `frontend/src/pages/faculty/FacultyMenteeDetail.jsx` | Mentee cards by band, detail page with multi-course view, attendance history, logged mentor notes. |
| **Faculty Sections & Timetable (`/faculty/timetable`)** | D (F7) | Missing | `frontend/src/pages/faculty/FacultyTimetable.jsx`, `frontend/src/pages/faculty/FacultySections.jsx` | Weekly teaching grid, section comparison table (for course coordinator). |
| **Coordinator Summary & Pages** | E | Partial | `frontend/src/pages/coordinator/CoordinatorSummary.jsx`, `backend/app/api/v1/endpoints/coordinator.py` | Department KPI summary, deadline load heatmap, student list (sanitized view), teacher workload, timetable editor. |
| **Admin Pages** | E | Partial | `frontend/src/pages/admin/AdminDashboard.jsx`, `frontend/src/pages/admin/AdminUsers.jsx` | System stats, risk config editor, user role manager, audit log viewer. |
| **Timetable Models** | F | Missing | `backend/app/models/timetable.py` | Add `TimetableVersionModel`, `PeriodConfigModel`, `RoomModel`, `TimetableSlotModel`. |
| **Timetable Endpoints** | F | Missing | `backend/app/api/v1/endpoints/timetable.py` | `GET/PUT /timetable/draft`, `POST /timetable/draft/validate`, `POST /timetable/publish`, `GET /timetable/versions`, `GET /me/timetable`. |
| **Timetable Clash Detection & Publishing** | F | Missing | `backend/app/services/timetable_service.py` | Detect room and teacher clashes, notify affected students and teachers upon publish, audit log publish. |
| **Notices Models** | G | Missing | `backend/app/models/notice.py` | Add `NoticeModel`, `NoticeRecipientModel`, `NoticeDeadlineModel`. |
| **Notices Endpoints** | G | Missing | `backend/app/api/v1/endpoints/notices.py` | `POST /notices`, `POST /notices/audience/preview`, `POST /notices/extract`, `GET /notices`, `GET /notices/{id}/recipients`, `PATCH /notices/{id}`, `DELETE /notices/{id}`, `GET /me/notices`, `POST /me/notices/{id}/seen`, `POST /me/notices/{id}/done`. |
| **Notices Date Extraction & Tasks Link** | G | Missing | `backend/app/services/notice_extractor.py`, `backend/app/api/v1/endpoints/me.py` | Rule-based date/time extraction with IST timezone, combined tasks in `GET /me/tasks`. |
| **Seed Data Additions** | H | Partial | `scripts/seed_data.py` | Add rooms, period configs, timetable slots, deliberate clash, 2 sample notices, planned absences. |
| **Test Suite** | I | Partial | `backend/tests/` | Add test coverage for timetable, notices, 403 scopes, attendance preview/quarantine, bearer auth & refresh body. |
| **Verification & Documentation** | J | Missing | `docs/WORKFLOW_VERIFICATION.md` | Execute automated test suite and manual verification checklist. |
