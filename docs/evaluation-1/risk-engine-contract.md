# AcadFlow Evaluation 1 — Risk Engine API Contract

**Date:** 2026-10-17  
**Author:** Member 3 (Raghav)

---

## 1. Inputs

### Attendance Buffer Inputs
| Source | DB Table | Field |
|--------|----------|-------|
| Total planned classes | courses | total_classes |
| Sessions held (not cancelled) | class_sessions | COUNT WHERE is_cancelled=False |
| Sessions attended | attendance_records | COUNT WHERE status IN ('present','late') |
| Enrollment date | enrolments | enrolled_on |
| Holiday count (future) | holidays | holiday_date > today |

### Risk Score Additional Inputs
| Concept | DB Table | Field |
|---------|----------|-------|
| Assignment deadlines | assignments | due_at, is_published |
| Submission status | submissions | status: on_time/late/missed/excused |
| Risk weights | risk_config | w_margin, w_trend, w_deadline, w_missed |
| Band thresholds | risk_config | t_watch=30, t_risk=55, t_critical=80 |
| Min evidence | risk_config | min_classes (default 8) |

---

## 2. Outputs

### GET /api/v1/attendance/students/{student_id}/courses/{course_id}/buffer

`json
{
  "student_id": 1,
  "course_id": 1,
  "total_classes": 60,
  "held": 40,
  "attended": 30,
  "required": 45,
  "still_need": 15,
  "remaining": 20,
  "buffer": 5,
  "attendance_pct": 75.0,
  "holiday_count": 0,
  "insufficient_data": false,
  "status_message": "Can miss up to 5 more class(es)"
}
`

### GET /api/v1/risk/students/{student_id}/courses/{course_id}

`json
{
  "student_id": 1,
  "course_id": 1,
  "score": 37.5,
  "band": "Watch",
  "margin_points": 37.5,
  "trend_points": 0.0,
  "deadline_points": 0.0,
  "missed_points": 0.0,
  "insufficient_data": false,
  "factors": ["Attendance buffer = 5 class(es) (margin component +37.5 pts)"],
  "computed_at": "2026-10-17T18:00:00Z",
  "buffer": 5,
  "remaining": 20,
  "attendance_pct": 75.0,
  "status_message": "Can miss up to 5 more class(es)"
}
`

**IMPORTANT for Rishita:**  
- When insufficient_data=true, score is 
ull (not 0). Do not display a score.  
- Show status_message in the UI for student-facing text.  
- Use actors list for the explainability panel.  
- Band values: Safe | Watch | At risk | Critical | Insufficient data

### GET /api/v1/risk/courses/{course_id}/at-risk?band=At+risk

Returns array of RiskScoreOut objects. Optional and filter.

### POST /api/v1/risk/students/{sid}/courses/{cid}/recalculate

Forces recalculation and persists a new RiskSnapshotModel row.
Returns same schema as GET risk score.

### POST /api/v1/attendance/sessions

`json
{"course_id": 1, "held_on": "2026-08-10", "is_cancelled": false}
`

### POST /api/v1/attendance/sessions/{id}/mark

`json
{
  "session_id": 1,
  "records": [{"session_id": 1, "student_id": 5, "status": "present"}]
}
`
**Triggers synchronous risk recalculation for all affected students.**

### PATCH /api/v1/attendance/records/{id}

`json
{"session_id": 1, "student_id": 5, "status": "late"}
`
Writes audit_log entry and triggers risk recalculation.

---

## 3. Missing Data Behavior

| Situation | Behavior |
|-----------|---------|
| held < min_classes | insufficient_data=true, score=null, message="Not enough data yet" |
| buffer < 0 | status="Not recoverable by attendance alone", margin=50 (full) |
| No submissions yet | missed_points=0 (no penalty) |
| No trend history | trend_points=0 (no penalty) |
| No assignments | deadline_points=0 |
| Config missing | Falls back to DEFAULT_RISK_CONFIG (PRD defaults) |

---

## 4. Risk Bands

| Band | Score Range | Meaning |
|------|------------|---------|
| Safe | 0–29 | Low risk |
| Watch | 30–54 | Monitor |
| At risk | 55–79 | Intervention advised |
| Critical | 80–100 | Immediate action needed |
| Insufficient data | N/A | < min_classes sessions held |

---

## 5. Phase G — Recalculation Flow

1. Faculty marks attendance via POST /attendance/sessions/{id}/mark
2. Records are persisted in attendance_records (upsert)
3. persist_risk_snapshot() is called for each affected student
4. New RiskSnapshotModel row is written to risk_snapshots
5. Next GET /risk/students/... returns updated result
