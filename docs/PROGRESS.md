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

### Phase 4: Dean Trends and Export
- [/] **In Progress**:
  - [ ] Schema & Models / Migration for Phase 4 (if needed).
  - [ ] `GET /departments/{id}/trends?weeks=8`: weekly counts per risk band from `risk_snapshots`, top courses/sections by share needing support, intervention funnel (flagged, contacted, recovered).
  - [ ] Scoped to dean's own department; cross-department access returns 403 with audit log.
  - [ ] Dean page UI: trend chart (using existing charting library), hotspot table, intervention funnel, Excel export.
  - [ ] Mentor load view for dean: mentees per mentor and share of high-risk mentees.
  - [ ] Pytest and vitest suites.
  - [ ] Phase 4 git commit and report.

### Phase 5: Additional Enhancements (Conditional on Phases 1-4 passing all tests)
- [ ] **Remaining**:
  - Faculty "Needs attention this week" list (missed 2+ consecutive or dropped band).
  - Attendance upload preview with warnings (unknown IDs, 100% present, duplicate sessions) and undo.
