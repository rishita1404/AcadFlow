# AcadFlow Evaluation 1 — Risk Engine Audit

**Date:** 2026-10-17  
**Auditor:** Member 3 (Raghav — Risk Engine & Data)  
**Branch:** main (up to date with origin)  
**Git HEAD:** 6824b83

---

## 1. Repository Inspection Summary

### 1.1 Git Status
- Branch: main, up to date with origin/main
- All model files modified only to fix SQLAlchemy 2.x nullable= compatibility bug (safe fix; preserves schema semantics)

### 1.2 Existing Backend Inventory

| Layer | State |
|-------|-------|
| Models (18 tables) | Complete — see backend-audit.md §2.1 |
| Alembic migration | 001_initial_schema.py |
| Auth endpoints | Implemented (Member 2) |
| Course/Student CRUD | Implemented (Member 1) |
| Attendance endpoints | STUB → now IMPLEMENTED (Member 3) |
| Risk endpoints | STUB → now IMPLEMENTED (Member 3) |
| services/buffer.py | REWRITTEN with PRD formulas |
| services/risk.py | REWRITTEN with PRD formulas |
| workers/risk_worker.py | Stub (synchronous trigger used instead for Eval 1) |
| scripts/seed_data.py | IMPLEMENTED with Appendix A students |

---

## 2. PRD Formulas (Section 8)

### 2.1 Attendance Buffer

required   = ceil(0.75 x total_classes)
still_need = max(0, required - attended)
remaining  = total_classes - held - holiday_count
buffer     = remaining - still_need

### 2.2 Margin Score

margin = 50 x (1 - buffer/remaining)   when buffer >= 0 and remaining > 0
margin = 50                             when buffer < 0

### 2.3 Full Risk Score (0-100)

| Component | Max pts | Formula |
|-----------|---------|---------|
| Margin | 50 | 50 x (1 - buffer/remaining), full 50 when buffer < 0 |
| Trend | 20 | Attendance slope over last 2 weeks |
| Deadlines | 20 | Unsubmitted work due within 14 days |
| Missed subs | 10 | Share of submissions marked 'missed' |

Bands: 0-29 Safe, 30-54 Watch, 55-79 At risk, 80-100 Critical.

---

## 3. Appendix A Verification

All computed from formulas, not hardcoded:

| Student | Held | Attended | Required | Buffer | Margin | Band |
|---------|------|----------|----------|--------|--------|------|
| Riya | 40 | 30 | 45 | 5 | 37.5 | Watch |
| Aman | 40 | 36 | 45 | 11 | 22.5 | Safe |
| Meera | 40 | 40 | 45 | 15 | 12.5 | Safe |
| Karan | 50 | 30 | 45 | -5 | 50.0 (full) | Watch |
| Dev | 5 | 5 | 45 | N/A | N/A | Insufficient data |

---

## 4. Module Boundaries Implemented

backend/app/
├── services/
│   ├── buffer.py          REWRITTEN: pure buffer + margin (no DB)
│   ├── risk.py            REWRITTEN: pure risk score, bands, config (no DB)
│   └── risk_data.py       NEW: DB queries + orchestration
├── api/v1/endpoints/
│   ├── attendance.py      IMPLEMENTED: sessions, mark, patch+audit, buffer GET
│   └── risk.py            IMPLEMENTED: per-student, at-risk list, recalc, config
└── schemas/risk.py        REWRITTEN: typed Pydantic output
scripts/seed_data.py       IMPLEMENTED: Appendix A students, deterministic seed 42

---

## 5. Integration Notes for Liza

- AuditLogModel: fixed redundant nullable= args (same SQLAlchemy 2.x bug)
- RiskSnapshotModel.config_id: made Optional[int] (snapshot can exist before config row)
- No new tables created; existing risk_config and risk_snapshots are sufficient
- Attendance mark endpoint writes audit log entries as required

## 6. Integration Notes for Rishita (Frontend)

API contract documented in risk-engine-contract.md.
Key: always check insufficient_data field before displaying score.
score field is null (not 0) when data is insufficient.
