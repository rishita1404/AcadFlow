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

### 2. Student Attendance & Subject Hub
- **Subject-Wise Attendance (`/student/attendance`)**:
  - Card-based breakdown of all enrolled subjects with attendance percentages, margin buffers (classes you can safely miss), and risk status badges.
  - Direct 1-click navigation to per-subject calendar and leave planner.
- **Strict Present / Absent Tracking**:
  - Normalized all attendance strictly to **Present** and **Absent** (eliminated confusing legacy "Late" statuses).

### 3. Interactive Calendar & Leave Planner (`/student/calendar`)
- **Subject-Level Scoping**:
  - Filter calendar days and leave projections for individual subjects or all subjects combined.
- **Daily Attendance Ratios**:
  - Calendar grid cells and day detail drawers display attendance as exact session ratios (e.g. `3/4 Present`, `1/1 Present`, `0/1 Absent`).
- **Proactive Leave Planner**:
  - Select upcoming dates to plan absences and view projected attendance impact before taking leave.
  - Tracks public and institutional holidays.

### 4. Notices & Timetable
- **Notice Board (`/notices`)**: Department and course-wide announcements with rich role-based authoring and instant dispatch.
- **Weekly Timetable (`/student/timetable`, `/faculty/timetable`)**: Class schedules with room allocations, batch tracking, and clash detection.

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
│   ├── tests/                  # Integration and unit test suites (186 pytest cases)
│   └── acadflow.db             # Local persistent SQLite database
├── frontend/
│   ├── src/
│   │   ├── api/                # Axios API client and endpoint service bindings
│   │   ├── app/                # Router configuration and role guards
│   │   ├── components/         # Reusable UI primitives, stat cards, drawers, forms
│   │   ├── layouts/            # AppShell navigation layout and topbar
│   │   ├── pages/              # Role-based pages (student, faculty, coordinator, admin)
│   │   └── styles/             # Editorial CSS variables and design tokens
│   └── package.json
├── scripts/
│   └── seed_semester5_data.py  # Realistic Semester 5 scenario seeder
├── deploy/                     # Docker Compose and deployment configurations
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

All demo accounts use the standard password: `AcadFlow@123`

| Role | Email | Capabilities |
| :--- | :--- | :--- |
| **Student** | `student@acadflow.edu` | View subject attendance, calendar ratios, plan leaves, check timetable |
| **Faculty** | `faculty@acadflow.edu` | Quick mark attendance checklist, Excel roster upload, course management |
| **Coordinator** | `coordinator@acadflow.edu` | Department-wide at-risk directory, academic analytics, notices |
| **Admin** | `admin@acadflow.edu` | System configuration, user provisioning, course allocations |

---

## 🧪 Testing & Code Quality

### Backend Tests (pytest)
```bash
cd backend
pytest tests/ -q
# All 186 unit and integration tests passing
```

### Linter (ruff)
```bash
ruff check backend/
```

### Frontend Tests (vitest)
```bash
cd frontend
npm test
```

### Production Build
```bash
cd frontend
npm run build
```

---

## 📄 License
This project was developed for the **Full Stack AI Engineering (24CAI0304)** curriculum. All rights reserved.
