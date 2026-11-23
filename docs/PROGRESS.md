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

### Phase 3: Intervention Log and Deadline Collision Warning
- [/] **In Progress**:
  - [ ] Schema & Models: `interventions` table (id, student_id, course_id, created_by, kind, note, follow_up_on, outcome, score_at_creation, band_at_creation, created_at, closed_at).
  - [ ] Alembic migration `005_phase3_interventions_collision.py`.
  - [ ] Visibility rules: creator, student's mentor, course instructors can create/view; dean has read-only access (audited); students cannot see interventions (403); others 403.
  - [ ] Interventions API endpoints with score delta calculation (current score - score_at_creation). Human-driven outcome selection.
  - [ ] Deadline collision warning preview endpoint: per-day deadline counts in +/-3 day window and lightest nearby date in +/-5 days; non-blocking warning when >= 3 deadlines in 7 days.
  - [ ] UI integration: "Log action" button on at-risk and mentee lists, per-student timeline, "Follow-ups due" panel on faculty home, non-blocking deadline warning in assignment form.
  - [ ] Seed data, unit and integration tests, vitest tests.
  - [ ] Phase 3 git commit and report.

### Phase 3: Intervention Log and Deadline Collision Warning
- [ ] **Remaining**:
  - `interventions` table and model.
  - Visibility rules (creator, mentor, instructor, dean read-only audited, student 403).
  - UI: Log action button, timeline, follow-ups due panel, score change delta display.
  - Deadline collision preview endpoint and non-blocking form warning.
  - Phase 3 migration, endpoints, tests, commit.

### Phase 4: Dean Trends and Export
- [ ] **Remaining**:
  - `GET /departments/{id}/trends?weeks=8` with risk band trends, hotspot table, intervention funnel.
  - Dean page: trend chart, hotspot table, funnel, Excel export.
  - Mentor load view for dean.
  - Cross-department 403 scope check with audit logging.
  - Phase 4 migration, endpoints, tests, commit.

### Phase 5: Additional Enhancements (Conditional on Phases 1-4 passing all tests)
- [ ] **Remaining**:
  - Faculty "Needs attention this week" list (missed 2+ consecutive or dropped band).
  - Attendance upload preview with warnings (unknown IDs, 100% present, duplicate sessions) and undo.
