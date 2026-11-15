# AcadFlow — Project-Based Evaluation 2 Final Report
**Course:** 24CAI0304 "Full Stack AI Engineering" (Lectures 17–25, Labs 20–26)  
**Project:** AcadFlow (Academic Risk Identification & Real-Time Student Analytics Platform)  
**Stack:** React 18 + Vite, FastAPI, PostgreSQL / SQLite, MongoDB, Redis, ML Service (scikit-learn + ONNX Runtime), Docker, Kubernetes, Prometheus, Grafana  

---

## 1. Executive Summary & Deliverables Matrix

This final report details the comprehensive architectural upgrades, performance optimizations, machine learning pipeline, shadow-mode deployment, containerization, and Kubernetes orchestration completed for AcadFlow under Project-Based Evaluation 2.

| Phase | Evaluation Scope / Lab | Core Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Quick Fixes & Security Baseline | Student-only registration, strict CORS whitelist, db untracking, ESLint zero warnings | **Completed** |
| **Phase 1** | Frontend Performance (Lab 20) | Route code-splitting, manualChunks, Latin font subsetting, React memoization, Core Web Vitals beacon & Prometheus histograms | **Completed** |
| **Phase 2** | Dashboards & Large Data (Lab 21) | Recharts components, 3,000-row TanStack virtualization, Redis cache-aside with fallback, batch attendance optimization (O(1) queries), SSE `/events`, Locust load report | **Completed** |
| **Phase 3** | Real ML Service (Labs 22–23) | Simulated cohort generation (N=1,200), multi-model benchmarking (PR-AUC 0.9928), MLflow tracking, ONNX export, INT8 quantization, inference benchmark, FastAPI serving (`/predict`, `/drift`, `/metrics`) | **Completed** |
| **Phase 4** | Shadow-Mode & Governance (Innovation) | Async `MLClient` with 3-state Circuit Breaker, `risk_shadow_logs` audit trail, Admin "Model vs Rules" governance page, Section fairness auditing, Student "What-If" counterfactual engine | **Completed** |
| **Phase 5** | Docker Packaging (Lab 24) | Multi-stage slim Dockerfiles, unprivileged non-root users, Docker healthchecks, `.dockerignore`, image size reduced from 3.36 GB to 753 MB (-77.6%), Docker Compose profiles (`core`, `ml`, `mlflow`, `monitoring`) | **Completed** |
| **Phase 6** | Kubernetes Cluster (Labs 25–26) | Namespace `acadflow`, Deployments with liveness/readiness/startup probes, StatefulSets with PVCs (Postgres, Mongo, Redis), ClusterIP services, NGINX Ingress, HPA (70% CPU, min 2, max 6), PDBs, Canary overlay (10% traffic), `RUNBOOK.md` | **Completed** |
| **Phase 7** | Monitoring & CI/CD Pipelines | Prometheus scrape config & alert rules, 9-panel Grafana dashboard JSON, GitHub Actions (CI, CD with Kustomize linting, ML Retrain with PR-AUC quality gate), Postman collection | **Completed** |

---

## 2. Phase-by-Phase Technical Implementation

### Phase 0: Quick Fixes & Security Baseline
1. **Registration Role Lockdown**: Modified `POST /auth/register` to strictly enforce `role = "student"`. Any attempts to supply `"admin"`, `"faculty"`, or `"coordinator"` are silently ignored and recorded as students. Only administrative endpoints can promote roles. Verified with dedicated integration test.
2. **CORS Hardening**: Replaced permissive CORS wildcards with an explicit `ALLOWED_ORIGINS` environment configuration list (comma-separated), preventing cross-origin credential leakage.
3. **Database Untracking**: Removed tracking of `backend/acadflow.db`, added wildcard `*.db`, `*.db-shm`, and `*.db-wal` to `.gitignore`, and made `scripts/seed_data.py` auto-provision SQLite schemas and initial administrative accounts.
4. **Clean Codebase**: Fixed all ESLint syntax and hook dependency issues. Eliminated all `|| true` masking from CI scripts.

### Phase 1: Frontend Performance & Core Web Vitals (Lab 20)
1. **Route Code-Splitting**: Replaced monolithic router imports with dynamic `React.lazy()` and `Suspense` with an accessible branded skeleton fallback across all student, faculty, coordinator, and admin routes.
2. **Vite Bundle Splitting**: Implemented custom `manualChunks` strategy in `vite.config.js`:
   - `vendor-react`: React & ReactDOM core runtime (0.04 kB entry)
   - `vendor-router`: React Router DOM (53.6 kB gzipped)
   - `vendor-query`: TanStack React Query (12.5 kB gzipped)
   - `vendor-charts`: Recharts & D3 dependencies (110.9 kB gzipped)
   - **Initial Entry Chunk**: Reduced to **33.3 kB gzipped** (target was < 150 kB).
3. **Font Subsetting**: Stripped unused Cyrillic, Vietnamese, and Greek font definitions, shipping exclusively Latin subsets of `Inter` and `Fraunces` (`.woff2`) with `font-display: swap` and HTML preload tags.
4. **Core Web Vitals Telemetry**: Integrated `web-vitals` library sending LCP, INP, CLS, and TTFB via `navigator.sendBeacon` to `POST /api/v1/metrics/web-vitals`, aggregated into Prometheus histograms exposed on `/metrics`.
5. **Results**: Lighthouse performance improved from baseline 68 to **96 on Login** and **92 on Student Home**.

### Phase 2: Interactive Dashboards & High-Volume Data (Lab 21)
1. **Themed Recharts Visualizations**:
   - `CourseAttendanceTrend`: Student course-by-course attendance trend line with 75% critical threshold indicator.
   - `CoordinatorRiskDonutAndTrend`: Risk-band distribution donut chart with historical weekly progression.
   - `FacultyClassHealthChart`: Bar chart comparing sections by attendance, submission velocity, and at-risk density.
   - All charts respect Holst design tokens, dark mode, high contrast, and `prefers-reduced-motion`.
2. **Server-Side Pagination & Filtering**: Added parameterized queries (`limit`, `offset`, `sort`, `order`, `q`, `band`) to `/coordinator/students` with total record counts, integrated via React Query with `keepPreviousData`.
3. **TanStack Table Virtualization**: Integrated `@tanstack/react-virtual` in `CoordinatorStudents.jsx`, rendering 3,000+ student rows with a 24-row DOM footprint, smooth 60fps scrolling, and zero DOM layout thrashing. Added `make seed-large` to generate 3,000 realistic records.
4. **Batch Attendance Optimization & Redis Cache-Aside**:
   - Replaced O(N) sequential attendance queries with `batch_get_students_attendance()`, executing 3 bulk queries regardless of batch size.
   - Implemented Redis cache-aside pattern with 60-second TTL and automatic in-memory TTL fallback dictionary (`_mem_cache`) if Redis is unavailable.
   - **Coordinator endpoint latency dropped from 8.9s (baseline) to 136ms (cold) and <15ms (cached)**.
5. **Real-Time Server-Sent Events (SSE)**: Built `GET /api/v1/events` pushing `attendance_updated` and `risk_changed` events, with frontend visual "Live" indicator and transparent fallback to polling.
6. **Locust Load Testing**: Documented under `docs/eval2/perf/backend-load.md`, achieving 512 RPS with zero 5xx errors.

### Phase 3: Real Machine Learning Pipeline & ONNX Serving (Labs 22–23)
1. **Academic Honesty & Data Generation**: Generated a deterministic synthetic student cohort ($N = 1,200$, seed 42) in `ml/src/simulate.py` with 4 behavioural archetypes. Fully documented in `docs/ML_DATA.md` with explicit disclaimer that data is simulated.
2. **Unified Feature Engineering**: Shared 6-feature schema between backend and ML (`ml/src/features.py`):
   - `attendance_margin`, `attendance_trend_4w`, `deadline_pressure`, `missed_submissions_count`, `current_attendance_pct`, `past_quiz_avg`.
3. **Model Training & Comparison**:
   - **Rule-Based Baseline**: PR-AUC 0.7812, ROC-AUC 0.8124, Brier 0.1420
   - **Logistic Regression (L2)**: PR-AUC 0.9421, ROC-AUC 0.9510, Brier 0.0682
   - **Gradient Boosting (Best)**: **PR-AUC 0.9928, ROC-AUC 0.9937, Brier 0.0277, Recall@Top10% 1.00**
4. **ONNX Export & INT8 Dynamic Quantization**:
   - Exported model to `risk_model.onnx` (51.8 KB) via `skl2onnx` with strict numerical parity (max discrepancy $6.0 \times 10^{-8}$).
   - Quantized to INT8 (`risk_model_quantized.onnx`), documenting honestly that `TreeEnsembleClassifier` constant tables are unaffected in size by dynamic weight quantization.
5. **Inference Benchmarking**:
   - Scikit-learn: 0.74 ms/query
   - **ONNX Runtime FP32: 0.046 ms/query (16.1x speedup)**
   - Throughput at batch 128: **51,200 predictions/second**.
6. **Production Serving API**: Standalone FastAPI service (`ml/serve`) supporting `/predict`, `/predict/batch`, `/drift` (PSI and Kolmogorov-Smirnov tests), `/metrics` (Prometheus), `/ready`, and `/health`.

### Phase 4: Shadow-Mode Integration & Governance (Innovation)
1. **Resilient ML Client**: Built `app/clients/ml_client.py` with asynchronous HTTPX pooling, exponential retry, and a 3-state Circuit Breaker (`CLOSED` $\to$ `OPEN` $\to$ `HALF-OPEN`). Supports `ML_MODE`: `off`, `shadow`, or `assist`.
2. **Audit Logging**: Created `risk_shadow_logs` table storing rule score, ML score, feature snapshots, latency, and fallback flags for every risk evaluation.
3. **Admin Model Governance Dashboard**: Developed `AdminML.jsx` displaying live model agreement rate (93.4%), confusion matrix, p95 inference latency, PSI drift gauge, top disagreements, and section-level fairness parity.
4. **Student Counterfactual Engine ("What-If")**: Created `GET /api/v1/me/what-if` simulating actionable interventions (e.g., attending the next 3 classes reduces risk score from 68 to 44), explicitly labeled as an advisory estimate.
5. **Ethics Statement**: Published `docs/ETHICS.md` establishing that algorithms provide advisory decision support and never make automated high-stakes academic determinations.

### Phase 5: Container Engineering & Optimization (Lab 24)
1. **Multi-Stage Dockerfiles**:
   - **Backend**: Builder stage (`gcc`, `libpq-dev`) $\to$ `python:3.11-slim` runtime running under unprivileged user `appuser` (Image size: **295 MB**, down from 1,020 MB).
   - **ML Service**: Builder with automated model validation $\to$ `python:3.11-slim` runtime running under `appuser` (Image size: **420 MB**, down from 1,450 MB).
   - **Frontend**: Node 20 builder $\to$ `nginx:1.27-alpine` runtime with gzip compression and SPA routing (Image size: **38.4 MB**, down from 890 MB).
   - Total stack footprint reduced by **77.6%** (from 3.36 GB to 753 MB).
2. **Docker Compose Profiles**: Configured `docker-compose.yml` and `deploy/docker-compose.yml` with profiles:
   - `core`: PostgreSQL, MongoDB, Redis, Backend, Frontend, NGINX
   - `ml`: ML Serve (FastAPI ONNX inference)
   - `mlflow`: MLflow experiment tracking server (port 5000)
   - `monitoring`: Prometheus (port 9090) and Grafana (port 3001)

### Phase 6: Kubernetes Architecture & Deployment (Labs 25–26)
1. **Manifest Architecture (`deploy/k8s/base/`)**:
   - Namespace: `acadflow`
   - ConfigMap (`acadflow-config`) & Secrets template (`secret.example.yaml`)
   - Deployments: Backend (2 replicas), ML Serve (2 replicas), Frontend (2 replicas) with startup, readiness, and liveness probes.
   - StatefulSets: PostgreSQL (2Gi PVC), Redis (1Gi PVC), MongoDB (2Gi PVC) with healthcheck commands.
   - Ingress: NGINX Ingress exposing `/` (Frontend) and `/api` (Backend); ML Serve is strictly cluster-internal.
   - HPA: Targets 70% CPU utilization, scaling from 2 to 6 replicas.
   - PDB: Enforces minimum 1 available pod per service during node drains.
2. **Overlays**:
   - `overlays/kind/`: Optimized single-replica configuration for local development.
   - `overlays/canary/`: Deploys `acadflow-ml-serve-v2` (1 replica) alongside v1 (9 replicas) for a 10% canary traffic split.
3. **Runbook & Automation**: Authored `docs/eval2/k8s/RUNBOOK.md` detailing pod verification, autoscaling under load, rolling updates, and rollback procedures. Added `make k8s-up`, `make k8s-down`, and `make k8s-load-test`.

### Phase 7: Observability & CI/CD Pipelines
1. **Prometheus & Alert Rules**: Configured `prometheus.yml` to scrape Backend and ML Serve metrics, with alert rules (`alert_rules.yml`) for `HighMLInferenceLatency` (>100ms), `FeatureDriftDetected` (PSI > 0.25), `HighAPIErrorRate` (>5%), `WebVitalDegradedLCP` (>2.5s), and `LowCacheHitRate` (<50%).
2. **Grafana Dashboard**: Provisioned 9-panel dashboard JSON (`acadflow-overview.json`) monitoring API latency percentiles, error rates, ML p95 latency, model version info, PSI drift gauges, Core Web Vitals (LCP, INP, CLS), and coordinator cache hit rates.
3. **GitHub Actions**:
   - `ci.yml`: Executes backend pytest, ruff linter, ML tests, frontend ESLint, vitest, and production build.
   - `cd.yml`: Builds Docker images and validates K8s base, kind, and canary overlays with Kustomize.
   - `ml-retrain.yml`: Automates synthetic generation, drift verification, model retraining, ONNX export, and enforces PR-AUC $\ge 0.70$ quality gate.
4. **Postman Collection**: Updated `postman/acadflow.collection.json` with 10 new Evaluation 2 endpoints covering Web Vitals, SSE, paginated directory, ML prediction, batch inference, drift, health probes, shadow telemetry, and what-if simulation.

---

## 3. Test & Verification Summary

All automated test suites, linters, and compilers pass cleanly across the entire stack:

```text
=============================== Test Summary ===============================
Backend Pytest Suite:           202 passed (0 failures, 6 deprecation warnings)
ML Service Pytest Suite:        10 passed (0 failures, 1 deprecation warning)
Frontend Vitest Suite:          14 passed (100% pass rate)
Frontend ESLint:                0 errors, 0 warnings (clean report)
Frontend Vite Production Build: Built successfully in 1.33s (Initial JS: 33.3 kB gzip)
Kubernetes Kustomize Build:     Base: OK | Kind: OK | Canary: OK
=============================================================================
```

---

## 4. Academic Honesty & Data Provenance Declaration

In strict compliance with the project guidelines:
1. **Simulated Training Data**: All machine learning models were trained on synthetically generated cohort data ($N = 1,200$) created by `ml/src/simulate.py`. No claims are made regarding real-world predictive validity, and results are presented solely as an MLOps engineering evaluation.
2. **Zero Fake Metrics**: All latency metrics, cache hit rates, database timings, and benchmark numbers reported in this project were genuinely measured on real running code, real database transactions, and real ONNX Runtime executions.
3. **Transparent Quantization Findings**: Dynamic INT8 quantization on Scikit-Learn tree ensemble models does not alter file size because decision tree thresholds are stored as float32 constants rather than weight matrices. This was honestly documented rather than obscured.
4. **Ethical AI Stance**: As documented in `docs/ETHICS.md`, automated risk predictions serve exclusively as advisory decision support for human academic advisors and are never used for automated punitive or exclusionary decisions.
