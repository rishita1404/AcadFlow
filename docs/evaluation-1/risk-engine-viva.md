# AcadFlow Evaluation 1 — Risk Engine Viva Notes

**Author:** Member 3 (Raghav)  
**Date:** 2026-10-17

These notes explain the implementation in plain language, grounded in the actual code.

---

## Q1: Why is the initial engine rule-based rather than ML-based?

**Answer:**  
The PRD explicitly requires a rule-based risk score for Evaluation 1.
ML models require training data, labelled outcomes, and validation pipelines.
A rule-based engine is fully deterministic, explainable, and testable against the
PRD's own Appendix A fixtures — you can verify every output on paper.
The rule-based score is also the primary score throughout the project; the ML
model is an additional signal shown beside it, not a replacement.

---

## Q2: How is the attendance buffer calculated?

**Answer (with formula from PRD Section 8):**

    required   = ceil(0.75 x total_classes)
    still_need = max(0, required - attended)
    remaining  = total_classes - held - holiday_count
    buffer     = remaining - still_need

Buffer is the number of future classes the student can still miss and still hit 75%.
A negative buffer means the student can no longer reach 75% by attendance alone.

Example (Riya, Appendix A):
  total_classes=60, held=40, attended=30
  required = ceil(45) = 45
  still_need = max(0, 45-30) = 15
  remaining = 60 - 40 = 20
  buffer = 20 - 15 = 5

The implementation is in app/services/buffer.py, function compute_attendance_buffer().
It is a pure function — no database calls — so it can be unit-tested independently.

---

## Q3: How does a missed submission affect the score?

**Answer:**

The missed-submission component contributes up to 10 points (from risk_config.w_missed).
The formula is:
  missed_points = w_missed x (missed_count / total_submissions)

If a student has submitted nothing yet, missed_count=0 and total_submissions=0,
so the penalty is 0 — the PRD says "a student with no submissions yet has no
missed-submission penalty."

If a student has 5 assignments and missed 2:
  missed_points = 10 x (2/5) = 4 points

---

## Q4: What happens when attendance history is insufficient?

**Answer:**

The PRD specifies a minimum-evidence rule: do not compute a status until
risk_config.min_classes sessions have been held (default 8).
Until then, the engine returns insufficient_data=True and status "Not enough data yet."
The API returns score=null (not 0) so the frontend can distinguish this from a
genuine Safe score of 0. This is the Dev scenario in Appendix A (held=5 < 8).

---

## Q5: How are risk bands assigned?

**Answer:**

The PRD defines four bands based on the final 0-100 score:
  Safe     : 0–29
  Watch    : 30–54
  At risk  : 55–79
  Critical : 80–100

The boundaries and the band thresholds (t_watch=30, t_risk=55, t_critical=80) are
stored in the risk_config table so an admin can tune them without redeploying.
The classify_band() function in app/services/risk.py implements this lookup.

---

## Q6: How does changing attendance trigger recalculation?

**Answer:**

Phase G (PRD requirement): synchronous trigger on every attendance change.

1. Faculty POSTs to /api/v1/attendance/sessions/{id}/mark (or PATCHes a record).
2. Attendance records are upserted into attendance_records.
3. persist_risk_snapshot() is called for every affected student.
4. The function re-queries all current attendance, submission, and trend data.
5. A new RiskSnapshotModel row is written to risk_snapshots.
6. The next GET /risk/students/.../courses/... returns the updated score.

The recalculation reads from the database — not from stale in-memory values.

---

## Q7: How do you prove the calculation is deterministic?

**Answer:**

Two ways:
1. Pure functions: compute_attendance_buffer() and compute_risk_score() take only
   primitive inputs and return the same output for the same inputs every time.
   There is no randomness, no global state, no I/O.
2. Unit tests: tests/unit/test_risk.py includes test_determinism() which calls
   compute_risk_score() twice with identical inputs and asserts the results are equal.

Also: the seed script uses random.seed(42) so every run produces the same data.

---

## Q8: How are incorrect or missing inputs handled?

**Answer:**

The buffer function raises ValueError for:
- attended > held (data integrity violation)
- held > total_classes (impossible)
- negative values
- invalid threshold

Missing DB data (no config row) falls back to DEFAULT_RISK_CONFIG (PRD defaults).
Missing trend data (not enough history) → trend_points=0 (no penalty, not a score).
Missing submission data (no assignments) → deadline_points=0 and missed_points=0.

The API returns clear error messages with 404 for missing students/courses.

---

## Q9: How do you prevent one student from viewing another student's risk data?

**Answer:**

This is enforced by Member 2 (Himanshi)'s auth layer via get_current_user and
require_roles in app/api/deps.py. Each endpoint calls can_access() which checks
RBAC scopes. Students can only call /me/dashboard, which is scoped to their own
user_id from the verified JWT. Faculty endpoints that list student risk require
the faculty role and are scoped to courses they are assigned to.
The risk engine itself never leaks cross-student data — each calculation is
explicitly parameterised by (student_id, course_id).

---

## Q10: What is the difference between a unit test and an integration test?

**Answer:**

Unit tests (tests/unit/):
  - Test pure functions in isolation, with no database, no FastAPI
  - Fast, deterministic, verify the formulas independently of infrastructure
  - Example: test_riya() in test_buffer.py passes integers directly to the function

Integration tests (tests/integration/):
  - Test the full stack: DB (SQLite in-memory), FastAPI, service layer together
  - Verify that DB queries return the correct data and API responses match the contract
  - Example: test_appendix_a_riya_via_db() creates real DB rows and asserts the
    full risk calculation pipeline returns buffer=5

---

## Appendix A Quick Reference (for viva demo)

Course: 60 classes, threshold 75%, required=45

| Student | Held | Attended | Buffer | Margin | Band |
|---------|------|----------|--------|--------|------|
| Riya | 40 | 30 | 5 | 37.5 | Watch |
| Aman | 40 | 36 | 11 | 22.5 | Safe |
| Meera | 40 | 40 | 15 | 12.5 | Safe |
| Karan | 50 | 30 | -5 | 50.0 | Watch (not recoverable) |
| Dev | 5 | 5 | N/A | N/A | Insufficient data |

To demo: change Riya's attended from 30 to 25, then call the buffer endpoint.
Expected: buffer = 20 - max(0,45-25) = 20-20 = 0. "Cannot miss any more classes."
