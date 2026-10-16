# AcadFlow: Unified Academic Platform

> An all-in-one academic platform with early-warning risk radar | Course: Full Stack AI Engineering (24CAI0304)

AcadFlow solves the core problem of academic visibility: students finding out about attendance shortfalls or assignment bottlenecks when it is already too late. It provides a centralized hub where faculty manage announcements, deadlines, and attendance, students receive proactive reminders, and an early-warning signal flags academic risk as decision support.

---

## 🏛️ Architecture Overview

- **Frontend**: React (Vite), React Router, TanStack Query, Tailwind/CSS Grid & Flexbox, Recharts.
- **Backend API**: Python, FastAPI, Pydantic v2, SQLAlchemy (asyncpg), Alembic.
- **Data Stores**:
  - **PostgreSQL**: Relational entities (Users, Courses, Enrollments, Grades, Attendance records).
  - **MongoDB**: Audit logs, activity streams, unread notifications.
  - **Redis**: Rate limiting, session caching, task queues.
- **ML / MLOps**: Gradient Boosted Risk Classifier, ONNX int8 runtime, Prometheus metrics, MLflow tracking.
- **Deployment & Orchestration**: Docker, Docker Compose, Kubernetes (kind/minikube), NGINX reverse proxy.

---

## 📂 Project Structure

```
acadflow/
├── .github/                  # CI/CD workflows, issue/PR templates, CODEOWNERS
├── backend/                  # FastAPI service, core, db, models, services, workers
├── ml/                       # Features, training, drift detection, ONNX export, FastAPI serve
├── frontend/                 # React + Vite client, role-based dashboards, components
├── deploy/                   # Docker compose, NGINX, Kubernetes manifests, Monitoring
├── scripts/                  # Seed scripts (500 students, 6 accounts), drift simulation, bootstrap
├── load-tests/               # Locust performance & load testing suites
├── postman/                  # Postman collection and environment definitions
├── docs/                     # Architecture, ADRs, API matrices, ethics, evidence labs
├── .env.example              # Centralized environment variable template
├── Makefile                  # Automation entrypoints (up, down, test, seed, migrate)
└── README.md
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Docker & Docker Compose
- Python 3.11+
- Node.js 20+

### 2. Setup Environment
```bash
cp .env.example .env
```

### 3. Start Local Stack
```bash
make up
# or
docker compose -f deploy/docker-compose.yml up -d
```

### 4. Seed Initial Data
```bash
make seed
```

Default seeded accounts:
- Student: `student@acadflow.edu` / `Password123!`
- Faculty: `faculty@acadflow.edu` / `Password123!`
- Trainer: `trainer@acadflow.edu` / `Password123!`
- Mentor: `mentor@acadflow.edu` / `Password123!`
- Coordinator: `coordinator@acadflow.edu` / `Password123!`
- Admin: `admin@acadflow.edu` / `Password123!`
