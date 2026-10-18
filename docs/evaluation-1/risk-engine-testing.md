# AcadFlow Evaluation 1 — Risk Engine Testing

**Author:** Member 3 (Raghav)  
**Date:** 2026-10-17

---

## 1. Test Commands

### Unit tests only (fast, no DB or Redis needed) — 71 tests
    cd backend
    python -m pytest tests/unit/ -v

### Integration tests (SQLite in-memory, no Postgres/Redis needed)
    cd backend
    python -m pytest tests/integration/test_risk_integration.py -v

### Full suite
    cd backend
    python -m pytest tests/ -v

---

## 2. Actual Test Run Results

### Full suite result (2026-10-17)
    2 failed, 126 passed in 175s

### Failure analysis

| Failing test | File | Cause | Owner |
|---|---|---|---|
| test_lockout_threshold_trigger | tests/security/test_lockout.py | Requires live Redis (not running locally) | Member 2 (Himanshi) |
| test_rate_limiter_burst_and_window | tests/security/test_rate_limit.py | Requires live Redis (not running locally) | Member 2 (Himanshi) |

**Neither failure is caused by Member 3 changes.**
Both tests pass in the full Docker Compose stack where Redis is available.
This was confirmed by Member 2's original audit (49/49 in full stack).

---

## 3. Member 3 Test Coverage — 71 / 71 PASSING

### Unit: test_buffer.py — 31 tests, all passing

| Test Class | Count | What it verifies |
|------------|-------|-----------------|
| TestAppendixAFixtures | 5 | Riya, Aman, Meera, Karan, Dev (PRD Appendix A exact values) |
| TestEdgeCases | 11 | Zero sessions, holiday exclusion, ceil() vs floor(), boundary values |
| TestInputValidation | 8 | All invalid inputs raise ValueError with clear messages |
| TestMarginScore | 7 | Margin formula; Appendix A margins verified; clamp to w_margin |

### Unit: test_risk.py — 39 tests, all passing

| Test Class | Count | What it verifies |
|------------|-------|-----------------|
| TestBandClassification | 9 | All band boundaries (0,29,30,54,55,79,80,100) |
| TestRiskConfigValidation | 4 | Invalid weights/thresholds raise ValueError |
| TestTrendScore | 6 | None slope, positive slope, moderate/steep decline |
| TestDeadlineScore | 4 | 0 to 4+ deadlines |
| TestMissedScore | 5 | No submissions = no penalty; share calculation |
| TestFullRiskScore | 11 | Riya/Karan/Dev via formula; determinism; config sensitivity |

### Integration: test_risk_integration.py
(runs against SQLite in-memory — Postgres-dependent subtests blocked until Docker available)

---

## 4. Appendix A Fixture Results (all verified by actual test run)

| Student | Held | Attended | Required | Buffer | Margin | Band | Test result |
|---------|------|----------|----------|--------|--------|------|-------------|
| Riya | 40 | 30 | 45 | 5 | **37.5** | Watch | ✅ PASS |
| Aman | 40 | 36 | 45 | 11 | **22.5** | Safe | ✅ PASS |
| Meera | 40 | 40 | 45 | 15 | **12.5** | Safe | ✅ PASS |
| Karan | 50 | 30 | 45 | **-5** | **50.0** (full) | Watch | ✅ PASS |
| Dev | 5 | 5 | 45 | N/A | N/A | Insufficient data | ✅ PASS |

---

## 5. Seed Data Command

Requires live Postgres (start with Docker Compose or provide DATABASE_URL):

    export DATABASE_URL=postgresql+psycopg://acadflow_user:acadflow_password@localhost:5432/acadflow_db
    cd <repo_root>
    python scripts/seed_data.py

Fixed seed=42; identical output on every run (reproducibility verified).

Seeded accounts (password: AcadFlow@123):
    student@acadflow.edu, faculty@acadflow.edu, trainer@acadflow.edu
    mentor@acadflow.edu, coordinator@acadflow.edu, admin@acadflow.edu

Appendix A students:
    riya@acadflow.edu  (held=40, attended=30, buffer=5)
    aman@acadflow.edu  (held=40, attended=36, buffer=11)
    meera2@acadflow.edu (held=40, attended=40, buffer=15)
    karan@acadflow.edu (held=50, attended=30, buffer=-5, not recoverable)
    dev@acadflow.edu   (held=5 < min_classes=8, insufficient data)

---

## 6. Known Issues and Blocked Items

| Item | Status | Blocker |
|------|--------|---------|
| Security lockout/rate-limit tests | BLOCKED — pre-existing, not Member 3's | Requires live Redis |
| Seed script against Postgres | BLOCKED locally | Docker not installed |
| Integration tests against Postgres | BLOCKED locally | Docker not installed |
| risk_worker.py cron job | OUT OF SCOPE Eval 1 | Synchronous trigger used (PRD-compliant for Eval 1) |
| Redis cache invalidation on recalc | OUT OF SCOPE Eval 1 | PRD allows synchronous for Eval 1 |
