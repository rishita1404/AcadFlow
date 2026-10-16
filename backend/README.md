# AcadFlow Backend Service

Production-ready backend API and database foundation for the **AcadFlow** unified academic platform.

---

## 🛠️ Tech Stack
- **Runtime:** Python 3.11+
- **Framework:** FastAPI
- **Data Validation:** Pydantic v2
- **ORM:** SQLAlchemy 2.0 (typed `Mapped[]` style)
- **Database:** PostgreSQL 16 (`psycopg` v3 sync driver)
- **Migrations:** Alembic
- **Testing:** pytest with isolated test database

---

## 🚀 Quick Setup & Execution

### 1. Install Dependencies
From the `backend` folder:
```bash
pip install -r requirements.txt
```

### 2. Environment Configuration
Copy environment variables template from the project root:
```bash
cp ../.env.example .env
```

Ensure `DATABASE_URL` is set to your PostgreSQL instance:
```env
DATABASE_URL=postgresql+psycopg://acadflow_user:acadflow_password@localhost:5432/acadflow_db
```

### 3. Run Database Migrations
Apply the initial 3NF relational schema (all 18 tables):
```bash
alembic upgrade head
```

To roll back the migration:
```bash
alembic downgrade base
```

### 4. Start Development Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API documentation will be available at:
- **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

## 🧪 Running Automated Tests
Run integration tests using the isolated test database:
```bash
pytest tests/integration/ -v
```

---

## 🏛️ Endpoints Overview (Scope)

### Health Check
- `GET /api/v1/health` $\rightarrow$ `{"status": "ok"}`

### Courses
- `GET /api/v1/courses` $\rightarrow$ List courses with pagination (`page`, `page_size`), filtering (`department_id`, `code`), and sorting (`sort=name` or `sort=-total_classes`)
- `POST /api/v1/courses` $\rightarrow$ Create course (201 Created), rejects duplicates with `409 CONFLICT`
- `GET /api/v1/courses/{id}` $\rightarrow$ Get course by ID (404 if not found)
- `PATCH /api/v1/courses/{id}` $\rightarrow$ Partial update
- `DELETE /api/v1/courses/{id}` $\rightarrow$ Delete course (204 No Content)
- `POST /api/v1/courses/{id}/enrolments` $\rightarrow$ Enrol one or more students, rejects duplicate enrolments with `409 CONFLICT`

### Students
- `GET /api/v1/students` $\rightarrow$ List students with pagination and batch/department filtering
- `POST /api/v1/students` $\rightarrow$ Create student user + profile, rejects duplicate email or roll number with `409 CONFLICT`
- `GET /api/v1/students/{user_id}` $\rightarrow$ Get student profile by user ID

---

## ⚠️ Global Error Response Format
All errors conform to the standard error envelope:
```json
{
  "error": {
    "code": "VALIDATION_ERROR | NOT_FOUND | CONFLICT | FORBIDDEN | UNAUTHORIZED | INTERNAL_ERROR",
    "message": "Human-readable description of error",
    "details": []
  }
}
```
