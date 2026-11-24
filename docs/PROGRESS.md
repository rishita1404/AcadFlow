# AcadFlow Improvement Progress

## Local-Only Mode
- All operations are strictly local.
- No git remote push, pull, fetch, or GitHub touches.

---

## Overall Status

### Phase 1: Reframe Student-Facing Language
- [x] **Done**:
  - Buffer Card with supportive copy: "Classes you must attend to stay eligible" (`still_need`) and "Your cushion: N classes, kept in reserve for illness and emergencies" (or "Not recoverable by attendance alone", never error).
  - Verified buffer calculation with semester-end formula: `required = ceil(0.75 * total_classes)`, `still_need = max(0, required - attended)`, `remaining = total_classes - held`, `buffer = remaining - still_need`. All 5 fixtures verified (Riya: 5, Aman: 11, Meera: 15, Karan: -5, Dev: Not enough data yet). Division by zero guarded.
  - Renamed leave planner / what-if feature to "Impact preview" across backend and frontend.
  - Relabeled top risk band from "Critical" to "Needs support" in UI (kept internal enum values and thresholds) with suggested next steps.
  - Cleaned unsupportive vocabulary ("bunk", "skip", "safe to miss") across the codebase.
  - Migration `003_phase1_reframe_language.py` recorded.
  - Committed as `ed543d0`.

### Phase 2: Leave Requests and Condonation
- [x] **Done**:
  - Schema & Models: created `leave_requests` and `condonation_requests` tables, and added `condonation_floor_pct` (default 65.0) and `require_recommendation` (default true) to `risk_config`.
  - Alembic migration `004_phase2_leave_condonation.py` applied and verified.
  - Central RBAC in `authorization.py` with actions `SUBMIT_LEAVE`, `VIEW_LEAVE`, `DECIDE_LEAVE`, `RECOMMEND_CONDONATION`, `VIEW_CONDONATION`, `DECIDE_CONDONATION` and scope enforcement (returning 403 on out-of-scope access).
  - Audit logging for approvals, rejections, recommendations, and dean record views.
  - Neutral attendance arithmetic: class sessions in approved leave ranges are excluded from held, total, and attended counts, preserving attendance ratios without penalty.
  - Worker recompute triggered, cache invalidated, and notification sent upon approval/rejection.
  - Seed script extended with synthetic leave and condonation requests.
  - Pytest suite: 9 integration tests added in `tests/integration/test_phase2_leave_condonation.py` covering leave submission, mentor approval, dean approval without mentor, 403 scope violations, neutral attendance arithmetic, condonation recommendation, floor percentage validation, and profile note logging. Total backend tests passing: 195/195.
  - Frontend: created Student "My leave" (`StudentLeave.jsx`), Faculty "Leave inbox" (`FacultyLeaveInbox.jsx`), and Dean "Condonation queue" (`DeanCondonationQueue.jsx`). 3 vitest tests added. Total frontend tests passing: 21/21.
  - Committed as `cfa754b`.

### Phase 3: Intervention Log and Deadline Collision Warning
- [x] **Done**:
  - Schema & Models: `interventions` table (id, student_id, course_id, created_by, kind, note, follow_up_on, outcome, score_at_creation, band_at_creation, created_at, closed_at) and `collision_warning_threshold` added to `RiskConfigModel`.
  - Alembic migration `005_phase3_interventions_collision.py` applied.
  - Central visibility & RBAC rules in `authorization.py` (`Action.CREATE_INTERVENTION`, `Action.VIEW_INTERVENTIONS`, `Action.UPDATE_INTERVENTION`):
    - Creator, student's mentor, and course instructors can create/view/update.
    - Dean of department has read-only access (audited with `DEAN_RECORD_VIEW`). Dean cannot modify (403).
    - Students cannot see interventions (403).
    - Other out-of-scope users receive 403.
  - API Endpoints:
    - `POST /interventions`: logs intervention, snapshots baseline score & band, writes audit event.
    - `GET /interventions/students/{student_id}`: returns timeline with calculated score change delta (`current_score - score_at_creation`). Audited on dean access.
    - `PATCH /interventions/{id}`: human-driven outcome selection (open, recovered, not_recovered, escalated), stamps closed_at when resolved.
    - `GET /interventions/follow-ups-due`: returns active follow-ups due for caller's students.
    - `POST /assignments/collision-preview`: calculates per-day deadline counts in +/-3 day window, finds lightest nearby date in +/-5 days, returns non-blocking warning when >= threshold (default 3).
  - UI Implementation:
    - `InterventionModal.jsx`: modal with action types (talk, call, email, referral, other), notes, and follow-up date.
    - `InterventionTimeline.jsx`: per-student timeline showing score change delta (`current_score - score_at_creation`), baseline metrics, and human-driven outcome selector.
    - `FollowUpsPanel.jsx`: faculty home dashboard panel displaying upcoming scheduled student follow-ups and quick actions.
    - `DeadlineCollisionWarning.jsx`: non-blocking warning banner with daily deadline counts and one-click "Use suggested date" button.
    - Integrated into `FacultyAtRisk.jsx`, `FacultyMentees.jsx`, `FacultyMenteeDetail.jsx`, `FacultyHome.jsx`, and `FacultyAssignments.jsx`.
  - Tests:
    - 10 backend integration tests in `test_phase3_interventions_collision.py` (all 205 backend tests passing).
    - 5 frontend vitest tests in `Intervention.test.jsx` (all 26 frontend tests passing).
  - Committed as `605457e`.

### Phase 4: Dean Trends and Export
- [x] **Done**:
  - Schema & Index Migration: `006_phase4_dean_trends.py` adding index `ix_risk_snapshots_computed_band` on `risk_snapshots`.
  - Central RBAC Actions: `VIEW_DEPARTMENT_TRENDS`, `EXPORT_DEPARTMENT_TRENDS`, `VIEW_MENTOR_LOAD` in `authorization.py` with strict department dean scoping (cross-department returns 403).
  - Endpoints in `departments.py`:
    - `GET /departments/{id}/trends?weeks=8`: weekly risk snapshot band distribution, top hotspots by support share, and 3-stage intervention funnel (flagged, contacted, recovered). Audited as `DEAN_RECORD_VIEW`.
    - `GET /departments/{id}/mentor-load`: mentees per mentor, high-risk mentee counts, high-risk percentage share, and open interventions count. Audited as `DEAN_RECORD_VIEW`.
    - `GET /departments/{id}/trends/export`: openpyxl Excel spreadsheet generator with 4 styled worksheets (Weekly Trends, Course Hotspots, Intervention Funnel, Mentor Load). Audited as `DEAN_RECORD_VIEW`.
  - UI Implementation:
    - `DeanTrends.jsx`: Responsive Recharts multi-week stacked bar chart using Holst palette, course hotspots table with advisory recommendations, visual 3-stage intervention funnel, mentor load balancing table, and one-click Excel report export.
    - Mounted in `router.jsx` (`/dean/trends`, `/coordinator/trends`) and linked in `AppShell.jsx`.
  - Synthetic Data: Extended `scripts/seed_data.py` with 8 weeks of multi-week risk snapshot series for department cohorts.
  - Tests:
    - 11 backend integration tests in `test_phase4_dean_trends.py` (all 216 backend tests passing).
    - 4 frontend vitest tests in `DeanTrends.test.jsx` (all 30 frontend tests passing).

### Phase 5: Additional Enhancements (Conditional on Phases 1-4 passing all tests)
- [x] **Done**:
  - Schema & Models: created `attendance_upload_batches` table (id, course_id, uploaded_by, uploaded_at, filename, records_created, records_updated, sessions_created, backup_data, is_undone, undone_at, undone_by) with index on `(course_id, uploaded_at)`.
  - Alembic migration `007_phase5_enhancements.py` created, applied, and verified.
  - Central RBAC in `authorization.py`: added `Action.VIEW_NEEDS_ATTENTION` and `Action.UNDO_ATTENDANCE` with strict scope checks (students get 403; faculty/trainer restricted to assigned courses).
  - Faculty "Needs attention this week":
    - Backend: implemented `get_needs_attention_for_faculty` in `attendance_stats.py` and endpoints `GET /courses/needs-attention` (and `GET /faculty/needs-attention`, `GET /courses/{course_id}/needs-attention`). Detects students with 2+ consecutive absences (accounting for neutral approved leave) or risk band drop since last week (comparing against ~7 days ago with "Needs support" UI label), synthesizing "what changed" and supportive "suggested next step".
    - Frontend: created `NeedsAttentionPanel.jsx` in desktop-only Holst palette with icon + text status indicators, course filter, and one-click "Log action" integration with `InterventionModal`. Integrated into `FacultyHome.jsx`.
  - Attendance upload preview warnings & undo:
    - Backend: extended `ingest_attendance_file` and preview endpoints (`POST /courses/{course_id}/attendance/preview`, `POST /attendance/preview`) to return structured warnings: unknown roll numbers/IDs, 100% present sessions (preventing accidental default template commits), and duplicate sessions (dates with pre-existing attendance).
    - Backend Undo: implemented `undo_attendance_upload` and endpoints `POST /courses/{course_id}/attendance/undo` (and `POST /attendance/undo`), which deletes newly created attendance records, restores overwritten statuses to their exact prior values, cleans up orphan sessions, recomputes risk snapshots, and records audit logs with PII redaction.
    - Frontend: updated `FacultyAttendanceUpload.jsx` with automatic preview validation scanning for warnings, warning callout cards, upload summary chips, post-commit "Undo Upload" action button, and revert confirmation banner.
  - Synthetic Data: Extended `scripts/seed_data.py` with multi-week snapshot band drops and synthetic attendance upload batches.
  - Testing:
    - 9 backend pytest integration tests in `backend/tests/integration/test_phase5_enhancements.py` covering consecutive absence detection, band drop detection, preview warnings, undo restoration, audit logs, and 403 out-of-scope permissions. Full backend pytest suite passing: **227/227 passed**.
    - 5 frontend vitest tests across `NeedsAttention.test.jsx` and `AttendanceUploadPreview.test.jsx`. Full frontend vitest suite passing: **35/35 passed**.
  - No teacher ranking or per-teacher compliance views added. Supportive vocabulary maintained. Strict LOCAL-ONLY MODE maintained.

### Part A: Notices with Targeted Audience
- [x] **Done**:
  - A1. 3-step compose flow (`Message`, `Audience`, `Review and send`):
    - Message step: Title, body, category (`form`, `hackathon`, `exam`, `circular`, `event`, `other`), priority (`normal`, `important`), optional link (links only, no file uploads).
    - Rule-based deadline detection on notice body with editable chips and "Add to deadlines" opt-in checkbox (nothing added to deadlines tab unless ticked), plus manual deadline input.
  - A2. Targeted audience builder:
    - Recipient types: `students`, `teachers`, `both`.
    - Student filters combined with AND: `department_id` (locked to sender's scope), `batch`/`programme`, `semester_id`, `section`, `course_id`, `my_mentees`, `pending_assignment_id`, and `attendance_band` (Needs support / Watch / Safe; strictly scoped to faculty's own courses or mentees).
    - Teacher filters: `department_id`, `course_id`, and `duty` (`instructor`, `mentor`, `course_coordinator`, `trainer`).
    - One-click presets: `"My course sections"`, `"My mentees"`, `"My course, needs support"`, `"Whole department"` (Dean only).
    - Roll number search and paste with out-of-scope IDs reported as `excluded`.
    - Live recipient counter and preview sample list.
    - "Save as preset" and recent audiences support (`/notices/presets`, `/notices/recent-audiences`).
  - A3. Guardrails:
    - Faculty scoped to own course sections and mentees. Dean scoped to own department. Admin unconstrained.
    - "Everyone" broadcast restricted to Dean and Admin behind count confirmation dialog (others receive 403).
    - Cross-scope attendance band filtering returns 403.
    - Large audience reach warning when count > threshold (default 100, configurable in `risk_config`).
    - Empty audience blocked (422).
    - Daily send rate limiting (default 20, returns 429 when exceeded).
    - Resolved audience snapshot stored at send time (`NoticeRecipientModel`: `notice_id`, `user_id`, `reason`, `delivered_at`, `read_at`) with filter spec.
  - A4. Delivery and tracking:
    - In-app notification and feed notice with `"Sent to: <audience summary> (reason)"`.
    - Opted-in confirmed deadlines added to student tasks/deadlines tab.
    - Sent notices view with audience summary, total count, and read count.
    - Unread list endpoint (`GET /notices/{id}/unread`) scoped to sender permissions.
    - "Send correction" endpoint (`POST /notices/{id}/correction`) notifying the original recipient snapshot with audit logging.
  - Database & Migration:
    - Added columns to `notices` (`link`, `priority`, `audience_summary`, `is_correction_for_id`), `notice_recipients` (`reason`, `read_at`), `students` (`section`), and `risk_config` (`notice_reach_threshold`, `notice_daily_rate_limit`).
    - Created `audience_presets` table.
    - Alembic migration `008_partA_notices.py` applied.
  - Seed Script: Extended `scripts/seed_data.py` with synthetic circular, exam, and hackathon notices, presets, and delivery reasons.
  - Testing:
    - 12 integration tests in `backend/tests/integration/test_partA_notices.py` (237/237 backend tests passing).
    - 3 Vitest tests in `frontend/src/pages/__tests__/ComposeNotice.test.jsx` (38/38 frontend tests passing).

### Part B: Timetable Manager
- [x] **Done**:
  - B1. Non-blocking clash behavior:
    - Multi-dimensional clash detection across 3 axes: teacher overlap, room overlap, and section overlap.
    - Rigorous back-to-back vs overlap logic: `max(s1, s2) < min(e1, e2)` ensures consecutive classes (e.g., 09:00-10:00 and 10:00-11:00) produce zero clashes, while partial or full overlaps are flagged.
    - Warn, never block on draft save (`PUT /timetable/draft` and `POST /timetable/draft/validate`): stores detected clashes in `conflicts_json` alongside draft slots and returns HTTP 200.
    - Publish-with-conflicts guard: publishing a draft with clashes requires explicit confirmation (`publish_with_conflicts: true`). Unconfirmed requests return HTTP 422 (`TIMETABLE_CLASHES_EXIST`). Confirmed requests publish the timetable, set `is_published_with_conflicts = true`, and record an audit log with action `timetable_publish_with_conflicts`. Clean publishes record `timetable_publish`.
    - Clashes displayed non-blockingly across UI with Holst palette warning badges (icon + text: AlertTriangle + "Room Overlap" / "Teacher Overlap") and interactive "Jump to cell" conflict resolution panel. Student view renders overlapping slots with warning badges.
  - B2. Entry screen (`CoordinatorTimetable.jsx`):
    - Option 1: "Edit Current Timetable" — quick-links directly into the visual grid editor for the active published schedule.
    - Option 2: "Create New from Scratch" — initiates the 5-step guided wizard modal.
    - Versions list table displaying version name, status badge, publish date, effective-from date, conflicts indicator, and "Restore as Draft" / "Open Editor" actions.
    - Integrated Room Master management tab with full CRUD dialog for department classrooms, labs, and seminar halls.
  - B3. Edit mode (`CoordinatorTimetableEditor.jsx`):
    - Section-scoped weekly grid (Days 0-4, configurable periods) with section filter switcher (e.g. Sec A, Sec B).
    - Slot creation/editing modal with course, section, teacher, room, kind (lecture, lab, tutorial), start time, and end time.
    - "Copy Day" schedule duplication action across weekdays.
    - Live "Changes vs published" diff drawer showing real-time slot movements, additions, and deletions compared against the active published schedule.
    - Effective-from date configuration with semester boundary validation.
  - B4. From-scratch wizard & Room master:
    - 5-step guided wizard: (1) Scope (academic year, department, semester), (2) Time Structure (period count, duration, lunch break), (3) Grid Fill (course/teacher/room assignment, multi-period lab blocks), (4) Review & Clash Analysis, (5) Publish with conflict override checkbox.
    - Room Master endpoints (`GET /timetable/rooms`, `POST /timetable/rooms`, `PATCH /timetable/rooms/{id}`, `DELETE /timetable/rooms/{id}`) with capacity, room type, and department scoping.
  - B5. Versioning & restoration:
    - Single draft at a time lifecycle per department/semester.
    - Historical versions preserved with immutable audit trail.
    - Restore version (`POST /timetable/versions/{id}/restore`): clones historical slots into a fresh draft without touching past class sessions or attendance records, with audit logging (`timetable_version_restore`).
  - B6. Diff notifications:
    - Slot-level diff engine comparing draft slots to active published timetable (e.g. `"Tue 11:00 DSA moved from Mon 10:00, Room B-204"`).
    - Pre-publish audience preview endpoint (`POST /timetable/publish-preview`) calculating exact counts of affected teachers and enrolled students.
    - Targeted delivery: sends in-app notifications only to affected students and teachers with the formatted slot diff summary. If no slot timings changed, zero notifications are broadcast.
  - B7. Permissions & RBAC:
    - Central scope and role enforcement: Department Coordinator/Dean (own department) and Admin have edit, draft, and publish permissions.
    - Cross-department coordinators receive HTTP 403.
    - Faculty and students receive HTTP 403 on draft mutation, publish, version restore, and room modification endpoints.
  - B8. Tests & verification:
    - Database migration `009_partB_timetable.py` created and applied.
    - Backend integration tests in `backend/tests/integration/test_partB_timetable.py` (10 tests covering 403 RBAC, non-blocking drafts, back-to-back non-clashes vs overlap clashes, 422 publish guard, publish-with-conflicts audit log, diff preview, version restore, room master CRUD). Full backend suite passing: **247/247 passed**.
    - Frontend Vitest tests in `frontend/src/pages/__tests__/TimetableManager.test.jsx` (5 tests covering entry screen, 5-step wizard progression, publish dialog with impact preview & conflict confirmation, Room Master management, visual grid editor). Full frontend suite passing: **43/43 passed across 10 test files**.
    - Synthetic seed data extended in `scripts/seed_data.py` with rooms, sections, published timetable with conflicts, and draft timetable with warnings.

### Hardening Pass (No New Features)
- [x] **Done**:
  - 1. Test mapping and edge cases added:
    - Mapped all Part A (12 tests in `test_partA_notices.py`) and Part B (15 tests in `test_partB_timetable.py`) tests to specifications.
    - Added comprehensive edge-case tests:
      - `test_replaced_teacher_is_notified_and_grouped_notifications_per_person`: ensures replaced teachers receive notification of reassignment and each recipient receives exactly one grouped notification containing only their personal slot changes.
      - `test_no_diff_means_zero_notifications`: verifies publishing identical timetable creates zero notifications.
      - `test_multi_period_lab_clash_detection_and_back_to_back`: verifies back-to-back classes (e.g. 09:00-10:00 and 10:00-11:00) do NOT clash, while multi-period lab spanning periods overlaps properly flag clashes.
      - `test_restoring_version_leaves_past_attendance_and_sessions_untouched`: verifies restoring an older timetable version does not delete or alter historical class sessions or attendance records.
      - `test_teacher_own_timetable_shows_both_classes_in_clashing_slot_with_conflict_marker`: verifies teacher timetable returns both classes in overlapping slot.
  - 2. Teacher's own timetable clashing slot view:
    - Updated `FacultyTimetable.jsx` to render both classes in a clashing slot with an overlapping marker (`AlertTriangle` icon + "Overlapping class") and a "Conflict (2 Classes)" badge.
    - Added frontend test in `TimetableManager.test.jsx`.
  - 3. Publish with conflicts UI confirmation dialog:
    - Confirmed and verified that `CoordinatorTimetable.jsx` and `CoordinatorTimetableEditor.jsx` open the confirmation modal with the "Publish with N conflict(s)" checkbox and do not block with an error message.
  - 4. Duplicate Phase 5 routes cleanup:
    - Kept canonical routes `/courses/{id}/attendance/preview`, `/courses/{id}/attendance/undo`, `/faculty/needs-attention`, and `/courses/{id}/needs-attention`.
    - Removed redundant route aliases `/attendance/preview`, `/attendance/undo`, and duplicate `/courses/needs-attention`.
    - Updated `frontend/src/api/endpoints.js` and added test `test_removed_phase5_duplicate_routes_return_404_or_405`.
  - 5. Attendance undo restricted to most recent non-undone batch:
    - Updated `csv_ingest.py` and `courses.py` to enforce that only the latest non-undone batch per course can be undone; attempting to undo an older batch returns HTTP 409 Conflict with a clear message.
    - Added test `test_attendance_undo_only_most_recent_batch_otherwise_409`.
  - 6. Configuration and migration safety:
    - Confirmed `.env.example` lists all new settings (`MISSED_SUB_INTERVAL_HOURS`, `CONDONATION_FLOOR_PCT`, `REQUIRE_CONDONATION_RECOMMENDATION`, `COLLISION_WARNING_THRESHOLD`, `NOTICE_REACH_THRESHOLD`, `NOTICE_DAILY_RATE_LIMIT`).
    - Hardened Alembic migrations (`001_initial_schema.py`, `002_new_features.py`, `008_partA_notices.py`, `009_partB_timetable.py`) to safely apply cleanly on a completely empty fresh database from scratch as well as incrementally.
    - Fixed `scripts/seed_data.py` to ensure all foreign keys (such as `risk_snapshots.config_id`) are populated deterministically.
    - Verified migrations 001-009 apply cleanly and `seed_data.py` completes with zero errors on a fresh database.
  - 7. Full test suite execution:
    - Full backend pytest suite: **254/254 passed** in 24.27s (100%).
    - Full frontend Vitest suite: **44/44 passed across 10 test files** in 10.22s (100%).

### Verification Pass (No New Features)
- [x] **Done**:
  - 1. Fresh Local PostgreSQL Instance:
    - Initialized clean local PostgreSQL 18 instance cluster (`backend/.pgdata.local`) on port 5433 with trust authentication.
    - Fixed Alembic migration column size limit: enlarged `alembic_version.version_num` to `VARCHAR(128)` via `version_table_column_type` in `backend/alembic/env.py` to support longer revision IDs (e.g. `005_phase3_interventions_collision`).
    - Standardized boolean column `server_default` values across revisions `007`, `008`, and `009` to use `sa.text("false")` instead of integer literals for PostgreSQL strict type compatibility.
    - Applied all 9 Alembic migrations (`alembic upgrade head`) cleanly from scratch with zero errors.
    - Fixed foreign key insertion ordering in `scripts/seed_data.py` (explicit `StudentModel` session flushes, valid course references for snapshots). Ran `scripts/seed_data.py` on PostgreSQL: all 35 synthetic entities populated with zero errors.
  - 2. SQLite Foreign Key Enforcement:
    - Enabled `PRAGMA foreign_keys=ON` via SQLAlchemy connect listeners across both production engine configuration (`backend/app/db/postgres.py`) and test session fixtures (`backend/tests/conftest.py`).
    - Resolved SQLite FK constraint ordering issues in test fixtures (e.g., `test_phase4_dean_trends.py`).
  - 3. Part A Comprehensive Test Suite Audit & Coverage:
    - Audited every Part A test by name; expanded `backend/tests/integration/test_partA_notices.py` to 17 tests covering all required specification scenarios:
      - `test_student_cannot_preview_or_create_notice_403`: student sending or previewing notice returns 403.
      - `test_faculty_cannot_broadcast_to_everyone_403`: faculty attempting "everyone" broadcast returns 403.
      - `test_faculty_cannot_target_outside_department_403`: faculty targeting another department returns 403.
      - `test_faculty_cannot_target_unassigned_course_403`: faculty targeting course they do not teach returns 403.
      - `test_faculty_targeting_unassigned_section_returns_403`: faculty targeting section they do not teach returns 403.
      - `test_dean_targeting_another_department_returns_403`: dean targeting cross-department returns 403.
      - `test_faculty_attendance_band_unscoped_403`: faculty filtering attendance band outside assigned students returns 403.
      - `test_empty_audience_returns_422`: empty audience returns 422 Unprocessable Content.
      - `test_daily_rate_limiting_429`: exceeding per-sender daily limit returns 429.
      - `test_audience_preview_and_presets`: live audience preview and preset save/load.
      - `test_roll_numbers_with_out_of_scope_exclusion`: pasted roll numbers outside scope listed as excluded.
      - `test_pasted_roll_numbers_outside_scope_excluded_and_not_sent`: confirmed out-of-scope roll numbers are not delivered to.
      - `test_deadlines_opt_in`: deadlines only added to tasks when sender explicitly opts in.
      - `test_unread_recipients_and_scoping_403`: unread recipient listing permissions and scoping.
      - `test_user_outside_audience_cannot_read_notice_or_recipient_list_403`: user outside target audience cannot read notice details or recipient list (403).
      - `test_large_audience_warning_appears_above_threshold`: returns warning when recipient count exceeds threshold.
      - `test_send_correction_notifies_snapshot_and_audits`: sending notice correction notifies original snapshot and writes audit log.
  - 4. Environment Settings Configuration:
    - Verified `.env.example` documents every setting added across all phases and parts with safe defaults:
      - `NOTICE_REACH_THRESHOLD=100`
      - `NOTICE_DAILY_RATE_LIMIT=20`
      - `CONDONATION_FLOOR_PCT=65.0`
      - `REQUIRE_CONDONATION_RECOMMENDATION=True`
      - `COLLISION_WARNING_THRESHOLD=3`
      - `MIN_CLASSES=8`
      - `TIMETABLE_PERIOD_LENGTH_MINUTES=50`
      - `TIMETABLE_DEFAULT_PERIODS=8`
  - 5. Full Test Suite Execution:
    - Full backend pytest suite: **259/259 passed** (100%) with SQLite `PRAGMA foreign_keys=ON`.
    - Full frontend Vitest suite: **44/44 passed across 10 test files** (100%).

### Login Page Redesign
- [x] **Done**:
  - Asymmetric 60/40 split desktop layout reusing exact Holst palette tokens from `tokens.css` (`--bg`, `--surface`, `--border`, `--ink-900`, `--accent`, `--risk-bg`, `--risk-fg`) and existing typography (`--font-serif`, `--font-sans`, `--font-mono`) with zero new dependencies.
  - Lazy-loaded CSS 3D perspective scene (`ProductScene.jsx` + `ProductScene.css`) with three staggered product layers:
    1. Weekly timetable slab (`Semester V · Sec B`) with `Wed 10:00` amber clash marker.
    2. Notice card (`Sent to: Sem 5, Section B` and detected deadline chip).
    3. Early support signal card (`59%` attendance ring + `Needs support` icon-and-text badge).
  - Cursor-reactive 3D tilt (max 12 degrees), per-layer Z parallax, hover Z-lift with single-line labels (`Timetable with clash warnings`, `Targeted notices`, `Early support signals`), subtle idle float, and full `prefers-reduced-motion` static fallback (`aria-hidden="true"`, `tabIndex={-1}`, non-blocking).
  - Preserved all login behaviour, validation, 401/403/429 error states, accessible labels, show/hide password toggle, and added 3D press effect on submit button.
  - Updated copy (`Sign in to AcadFlow`, `Attendance support, notices and timetables for your department.`, `Demo data only. No real student records.`), added `VITE_DEMO_MODE=false` to `.env.example`, and gated demo credential chips (`Student`, `Faculty`, `Mentor and coordinator`, `Trainer`, `Dean`, `Admin`) on `VITE_DEMO_MODE=true` (and dev mode).
  - Fixed two pre-existing Vite build syntax errors in `StudentNotices.jsx` and `FacultyAssignments.jsx`.
  - Frontend Vitest suite: **51/51 passed across 11 test files** (including `LoginPage.test.jsx` and `ProductScene.test.jsx`).
  - Production build (`vite build`):
    - Before: `index.js` `1,275.13 kB` (`307.41 kB` gzip), `index.css` `13.79 kB` (`3.33 kB` gzip).
    - After: `index.js` `1,273.39 kB` (`307.34 kB` gzip), `ProductScene.js` `5.82 kB` (`1.98 kB` gzip, lazy chunk), `index.css` `22.36 kB` (`5.02 kB` gzip).
  - Saved before/after screenshots in `docs/evidence/login-redesign/before.png` and `docs/evidence/login-redesign/after.png`.



