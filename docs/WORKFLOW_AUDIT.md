# AcadFlow Workflow Audit & Specification Gap Analysis

Generated according to the comprehensive AcadFlow Specification.

## Assumptions
1. **Database Fallback**: When PostgreSQL is unavailable locally, SQLite (`acadflow.db`) is used as persistent storage. All SQLAlchemy models, relationships, and queries remain dialect-agnostic between PostgreSQL and SQLite.
2. **Authentication Flow**: Supports both browser cookie-based session and `Authorization: Bearer <access_token>` header. Token refresh endpoint accepts the refresh token in the JSON request body `{"refresh_token": "..."}` or cookie.
3. **ML Service**: Machine Learning model is an auxiliary advisory signal for Evaluation 1. When offline or unreachable, the system displays "Model score unavailable" without failing and continues utilizing the rule-based risk calculation.
4. **Sections**: In `enrolments`, if section assignment is not explicitly present, students default to section "A".
5. **Timezone**: Date and deadline parsing uses `Asia/Kolkata` (IST, UTC+05:30).

---

## Audit Matrix

| Spec Item | Spec Section | Status | File Path | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **User Roles & Duties** | A | Completed | `backend/app/models/user.py`, `backend/app/core/authorization.py` | Full duties (`instructor`, `trainer`, `course_coordinator`, `mentor`) mapped in `/me/permissions`; RBAC validated. |
| **Permissions Endpoint (`/me/permissions`)** | A | Completed | `backend/app/api/v1/endpoints/me.py` | Returns `duties`, `primary_role`, `allowed_roles`, and `department_id` queried dynamically from database. |
| **Login Redirects** | A | Completed | `frontend/src/app/router.jsx`, `frontend/src/app/AuthContext.jsx` | Redirects users based on active role: student -> `/student/home`, faculty -> `/faculty/home`, coordinator -> `/coordinator/summary`, admin -> `/admin`. |
| **Expired Session & 403 Page** | A | Completed | `frontend/src/app/router.jsx`, `frontend/src/pages/ForbiddenPage.jsx` | Redirects expired token to `/login?next=<page>`. Added 403 page with "Back to my home" action. |
| **App Shell & Role Navigation** | A | Completed | `frontend/src/layouts/AppShell.jsx` | Desktop sidebar with role-specific nav items (Student, Faculty, Coordinator, Admin) and top bar role switcher for multi-duty users. |
| **Status Labels & Score Expander** | A | Completed | `frontend/src/components/StatusBadge.jsx`, `frontend/src/components/RiskExpander.jsx` | Icon + supportive text labels: Safe="On track", Watch="Keep an eye", At risk="Needs attention", Critical="Priority support". Score expander with component breakdown. |
| **Buffer Calculation Contract** | B | Completed | `backend/app/services/buffer.py` | Exact formula verified: `required = ceil(0.75 * total_classes)`, `still_need = max(0, required - attended)`, `remaining = total_classes - held`, `buffer = remaining - still_need`. Negative buffer status: "Not recoverable by attendance alone". |
| **Risk Score Engine** | B | Completed | `backend/app/services/risk.py`, `backend/app/services/risk_data.py` | Verified weights: Margin 50, Trend 20, Deadlines 20, Missed 10. Min classes = 8. Unit test fixtures match Riya, Aman, Meera, Karan, Dev. |
| **Planned Absence & Projection** | B, C | Completed | `backend/app/services/calendar_service.py`, `backend/app/api/v1/endpoints/me.py` | `POST /me/plan/project` returns live date-based projection: projected %, spare misses left, projected band. |
| **Must-Attend Day Calculation** | B | Completed | `backend/app/services/pressure_forecast.py` | Flags days where missing classes causes buffer to become negative or exam/review due. |
| **Student Home (`/student/home`)** | C (S1) | Completed | `frontend/src/pages/student/StudentHome.jsx` | Desktop multi-column layout with status badge, warning banner, course cards, due this week, today's classes, mini pressure strip, notices strip. |
| **Student Course Detail (`/student/courses/:id`)** | C (S2) | Completed | `frontend/src/pages/student/StudentCourseDetail.jsx` | Tabbed view: Overview, Attendance (%, buffer, history), Deadlines, Announcements, Materials, Risk breakdown. |
| **Student Calendar & Planner (`/student/calendar`)** | C (S3) | Completed | `frontend/src/pages/student/StudentCalendar.jsx` | Attendance vs Pressure modes, Month/Week/Agenda views, right-side day drawer, interactive leave planner with live projection panel. |
| **Student Timetable (`/student/timetable`)** | C (S4) | Completed | `frontend/src/pages/student/StudentTimetable.jsx` | Weekly grid Mon-Sat x time slots, holiday strike-through, recent changes tag, click slot -> course. |
| **Student Tasks (`/student/tasks`)** | C (S5) | Completed | `frontend/src/pages/student/StudentTasks.jsx` | Tabs (This week, Upcoming, Submitted, Missed), course filter, includes assignment & notice deadlines, countdowns. |
| **Student Assignment Detail (`/student/assignments/:id`)** | C (S6) | Completed | `frontend/src/pages/student/StudentAssignmentDetail.jsx` | Timeline bar (Due -> Grace 48h -> Closed), drag-drop submission, receipt card with file hash, version history. |
| **Student Risk Page (`/student/risk`)** | C (S7) | Completed | `frontend/src/pages/student/StudentRisk.jsx` | Stacked bar breakdown (Margin/Trend/Deadlines/Missed), model estimate & version, trend chart, what-if simulator (`POST /me/simulate`). |
| **Student Notifications (`/student/notifications`)** | C (S8) | Completed | `frontend/src/pages/student/StudentNotifications.jsx` | Grouped Today/Earlier, filters, deep links to assignments, notices, timetable, risk. |
| **Student Preferences (`/student/preferences`)** | C (S9) | Completed | `frontend/src/pages/student/StudentPreferences.jsx` | Reminder offsets (7d, 2d, 24h, overdue toggles), channels, quiet hours display. |
| **Faculty Home (`/faculty/home`)** | D (F1) | Completed | `frontend/src/pages/faculty/FacultyHome.jsx` | Duty cards: My courses, My mentees, Sections, Upload attendance shortcut. |
| **Faculty Course Detail (`/faculty/courses/:id`)** | D (F2) | Completed | `frontend/src/pages/faculty/FacultyCourseDetail.jsx` | Roster table, attendance rate, at-risk count, sessions list, add session dialog. |
| **Faculty Attendance Upload (`/faculty/courses/:id/attendance`)** | D (F3) | Completed | `frontend/src/pages/faculty/FacultyAttendanceUpload.jsx`, `backend/app/services/csv_ingest.py` | 4-step wizard: upload & detect, preview & map (`POST /courses/{id}/attendance/preview`), confirm & diff, summary. Audit log on edit. |
| **Faculty At-Risk List (`/faculty/courses/:id/at-risk`)** | D (F4) | Completed | `frontend/src/pages/faculty/FacultyAtRisk.jsx` | Table sorted by risk, buffer indicator, filter by band, export CSV, one-click email/nudge dialog. |
| **Faculty Assignments (`/faculty/courses/:id/assignments`)** | D (F5) | Completed | `frontend/src/pages/faculty/FacultyAssignments.jsx` | Create assignment form with weight/grace period, submissions grading table with file download. |
| **Faculty Mentees (`/faculty/mentees`)** | D (F6) | Completed | `frontend/src/pages/faculty/FacultyMentees.jsx`, `frontend/src/pages/faculty/FacultyMenteeDetail.jsx` | Mentee cards by band, detail page with multi-course view, attendance history, logged mentor notes. |
| **Faculty Sections & Timetable (`/faculty/timetable`)** | D (F7) | Completed | `frontend/src/pages/faculty/FacultyTimetable.jsx`, `frontend/src/pages/faculty/FacultySections.jsx` | Weekly teaching grid, section comparison table (for course coordinator). |
| **Coordinator Summary & Pages** | E | Completed | `frontend/src/pages/coordinator/CoordinatorSummary.jsx`, `backend/app/api/v1/endpoints/coordinator.py` | Department KPI summary, deadline load heatmap, student list (sanitized view), teacher workload, timetable editor. |
| **Admin Pages** | E | Completed | `frontend/src/pages/admin/AdminDashboard.jsx`, `frontend/src/pages/admin/AdminUsers.jsx` | System stats, risk config editor, user role manager, audit log viewer. |
| **Timetable Models** | F | Completed | `backend/app/models/timetable.py` | `TimetableVersionModel`, `PeriodConfigModel`, `RoomModel`, `TimetableSlotModel` added and migrated. |
| **Timetable Endpoints** | F | Completed | `backend/app/api/v1/endpoints/timetable.py` | `GET/PUT /timetable/draft`, `POST /timetable/draft/validate`, `POST /timetable/publish`, `GET /timetable/versions`, `GET /me/timetable`. |
| **Timetable Clash Detection & Publishing** | F | Completed | `backend/app/services/timetable_service.py` | Detects room, teacher, and student clashes; non-blocking publishing with stacked clash badges and notifications. |
| **Notices Models** | G | Completed | `backend/app/models/notice.py` | `NoticeModel`, `NoticeRecipientModel`, `NoticeDeadlineModel` added and migrated. |
| **Notices Endpoints** | G | Completed | `backend/app/api/v1/endpoints/notices.py` | `POST /notices`, `POST /notices/audience/preview`, `POST /notices/extract`, `GET /notices`, `GET /notices/{id}/recipients`, `PATCH /notices/{id}`, `DELETE /notices/{id}`, `GET /notices/me`, `POST /notices/{id}/seen`, `POST /notices/{id}/done`, `POST /notices/{id}/nudge`. |
| **Notices Date Extraction & Tasks Link** | G | Completed | `backend/app/services/notice_extractor.py`, `backend/app/api/v1/endpoints/me.py` | Rule-based date/time extraction with `Asia/Kolkata` timezone, combined tasks in `GET /me/tasks`. |
| **Seed Data Additions** | H | Completed | `scripts/seed_data.py` | Added rooms (101, 201, 301), period configs, timetable slots with 1 deliberate teacher clash, 2 sample notices with deadlines, planned absences. |
| **Test Suite** | I | Completed | `backend/tests/` | 168 tests passing across unit, security, and integration (including Phase 8 notices, timetable, attendance preview, bearer auth). |
| **Verification & Documentation** | J | Completed | `docs/WORKFLOW_VERIFICATION.md` | Full automated test suite and verification matrix compiled with 100% PASS rate. |
