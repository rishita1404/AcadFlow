# AcadFlow: Unified Academic Platform

> An all-in-one academic intelligence and workflow platform with early-warning risk radar, subject-level attendance planning, and streamlined faculty management.
> **Course:** Full Stack AI Engineering (24CAI0304)

AcadFlow solves the core problem of academic visibility: students discovering attendance shortfalls or assignment bottlenecks when it is already too late. It provides a unified portal where faculty manage schedules, notices, and attendance in one click, students track real-time attendance buffers and plan leaves proactively, and an early-warning ML risk engine flags academic risk for timely intervention.

---

## 🏛️ Architecture Overview

- **Frontend Client**:
  - React 18 (Vite), React Router 6, TanStack Query (React Query v5).
  - Editorial design system (Fraunces serif & Inter sans-serif typography, light theme tokens).
  - Recharts for attendance analytics and risk telemetry, Lucide React icons.
- **Backend API**:
  - Python 3.11+, FastAPI, Pydantic v2.
  - SQLAlchemy 2.0 (typed `Mapped[]` style).
  - OpenPyXL for dynamic spreadsheet template generation and data validation.
- **Data & Persistence**:
  - **PostgreSQL 16** with automatic zero-configuration fallback to local persistent **SQLite (`acadflow.db`)**.
  - 3NF relational schema (Users, Courses, Enrolments, Class Sessions, Attendance Records, Risk Snapshots, Notices, Timetable).
- **ML / Risk Engine**:
  - Gradient Boosted Risk Classifier with real-time margin buffer calculations and automated notification dispatch.

---

## 🌟 Key Features & Capabilities

### 1. Faculty Attendance Management
- **Option 1: Direct Roster Checklist (Tick Circles)**
  - View enrolled students for any selected session date.
  - Interactive circular tick buttons: checked (**✓**) for **Present** (green), unchecked for **Absent** (soft red).
  - Bulk actions: *Mark All Present*, *Mark All Absent*, and live student search.
  - Real-time stat chips: `✓ 24 Present (96%)` & `✕ 1 Absent`.
  - **Zero-verification 1-step save**: records attendance and updates risk scores immediately without dry-run preview steps.
- **Option 2: Excel / CSV Spreadsheet Upload**
  - Instant drag-and-drop file ingest.
  - **Improved Template Generation**: downloads `.xlsx` templates pre-filled with enrolled students and session date, featuring native Excel **DataValidation dropdowns** (`Present`, `Absent`) and checkbox compatibility (`TRUE`/`FALSE`, `1`/`0`, `✓`/`✕`, `P`/`A`).

### 2. Student Attendance, Buffer & Impact Preview
- **Subject-Wise Attendance (`/student/attendance`)**:
  - Card-based breakdown of all enrolled subjects with attendance percentages, classes needed (`still_need`), reserve cushion (`buffer`), and supportive status badges.
  - Direct 1-click navigation to per-subject calendar and impact preview.
- **Strict Present / Absent Tracking**:
  - Normalized all attendance strictly to **Present** and **Absent**.

### 3. Leave Requests, Condonation & Interventions
- **Student Leave (`/student/leave`)**:
  - Segmented category selector (**Medical** or **Duty / Event**) with keyboard navigation.
  - **Medical leave** requires a supporting document upload (PDF/JPG/PNG, max 5 MB via `multipart/form-data`).
  - **Duty / Event leave** captures event/duty name (required), club/organisation, and role/duty.
  - Neutral attendance arithmetic: approved leave sessions are excluded from held/total/attended counts.
- **Faculty / Mentor Leave Inbox (`/faculty/leave`)**:
  - Review pending and decided leave submissions from assigned mentees with **Approve** and **Reject** (note required) actions.
- **Dean Condonation Queue (`/dean/condonation`)** & **Intervention Log**:
  - Mentors log structured student interventions (`talk`, `call`, `email`, `referral`, `other`) with follow-up dates and outcomes, and recommend eligible students for condonation review by the Dean.

### 4. Interactive Calendar & Deadline Collision Warning (`/student/calendar`)
- **Subject-Level Scoping & Daily Attendance Ratios**:
  - Calendar grid cells and day detail drawers display attendance as exact session ratios (e.g. `3/4 Present`, `1/1 Present`, `0/1 Absent`) and institutional holidays.
- **Impact Preview & Collision Warnings**:
  - Simulates projected attendance impact and flags high-density assignment/exam deadline windows.

### 5. Targeted Notices, Timetable & Dean Analytics
- **Targeted Notices (`/notices`)**: 3-step compose wizard with audience targeting, priority, deadline extraction, and read/done tracking.
- **Timetable Manager (`/student/timetable`, `/faculty/timetable`, `/coordinator/timetable`)**: Weekly schedules with room allocations, non-blocking clash warnings, version publish/restore, and diff notifications.
- **Dean Trends (`/dean/trends`)**: Department-wide attendance/risk trends, hotspot courses, intervention funnel, mentor load, and Excel export.

### 6. ML Risk Engine, ONNX & Cloud-Native Deployment
- **ML Serving & Optimization (`ml/`)**: FastAPI inference service, experiment tracking (MLflow), data/concept drift checks, ONNX export, quantization, and latency/throughput benchmarking.
- **Containers, K8s & CI/CD (`deploy/`, `.github/workflows/`)**: Multi-service Dockerfiles, Kubernetes manifests (Deployments, Services, ConfigMaps, HPA, Canary overlay), Prometheus/Grafana monitoring, and GitHub Actions CI/CD.

---

## 📂 Project Structure

```
acadflow/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # Modular API routes (attendance, courses, me, notices, timetable, risk)
│   │   ├── core/               # Security, tokens, permissions, database configuration
│   │   ├── models/             # SQLAlchemy 2.0 declarative database models
│   │   ├── schemas/            # Pydantic v2 request/response schemas
│   │   └── services/           # Business logic (calendar, risk data, csv/excel ingest, notifications)
│   ├── tests/                  # Integration and unit test suites (259 pytest cases)
│   ├── seed_clean_demo.py      # Clean 20-student single-section demo data seeder
│   └── acadflow.db             # Local persistent SQLite database
├── frontend/
│   ├── src/
│   │   ├── api/                # Axios API client and endpoint service bindings
│   │   ├── app/                # Router configuration and role guards
│   │   ├── components/         # Reusable UI primitives, stat cards, drawers, forms
│   │   ├── features/auth/      # Asymmetric split login UI, ProductScene, SignInCard
│   │   ├── layouts/            # AppShell navigation layout and topbar
│   │   ├── pages/              # Role-based pages (student, faculty, dean, coordinator, admin)
│   │   └── styles/             # Editorial CSS variables and design tokens
│   └── package.json            # Frontend dependencies & Vitest suite (72 tests)
├── ml/                         # ML training, drift detection, ONNX export/quantization, FastAPI serve
├── deploy/                     # Docker Compose, Kubernetes manifests (base/HPA/canary), Prometheus & Grafana
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python:** 3.11+
- **Node.js:** 18+ (Node 20 recommended)
- **Git**

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

Start the FastAPI development server:
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Note: AcadFlow connects to PostgreSQL if available, and seamlessly falls back to `acadflow.db` (SQLite) if PostgreSQL is not running locally.*

- **Interactive API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```

Open your browser at **[http://localhost:3000](http://localhost:3000)** (or the port Vite outputs).

---

## 👥 Default Demo Accounts

All 4 demo login types use the standard password: `AcadFlow@123` (seeded via `backend/seed_clean_demo.py` with 20 Section A students, 5 subjects, timetable, attendance, leaves, notices, and notifications).

| Login Type | Email | Capabilities |
| :--- | :--- | :--- |
| **Student** | `student@acadflow.edu` | Attendance buffer, calendar ratios, medical/duty leave requests, notices, timetable |
| **Faculty / Mentor** | `faculty@acadflow.edu` | Mark attendance, Excel upload with preview/undo, mentee leave inbox, interventions |
| **Dean / Coordinator** | `coordinator@acadflow.edu` | Condonation queue, department trends & Excel export, targeted notices, timetable editor |
| **Admin** | `admin@acadflow.edu` | System risk configuration, user provisioning, course allocations, audit logs |

To reset and re-seed the local demo database:
```bash
cd backend
python seed_clean_demo.py
```

---

## 🧪 Testing & Code Quality

### Backend Tests (pytest)
```bash
cd backend
pytest tests/ -q
# 259 unit and integration tests passing
```

### Linter (ruff)
```bash
ruff check backend/
```

### Frontend Tests (vitest)
```bash
cd frontend
npm test -- --run
# 72 tests passing across 11 test files
```

### Production Build
```bash
cd frontend
npm run build
```

---

## 📄 License
This project was developed for the **Full Stack AI Engineering (24CAI0304)** curriculum. All rights reserved.
