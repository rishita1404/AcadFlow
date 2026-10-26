# AcadFlow — Frontend Page to Backend API Viva Guide
> **Evaluation Reference Guide**  
> **Topic:** Frontend Architecture, Internal API Invocations, and Multi-Database Data Flow  
> **Target Audience:** Viva Examination, Project Defense, Technical Audits

---

## 📋 Executive Overview of Communication Flow

AcadFlow uses a decoupled client-server architecture:
* **Frontend:** React 18 SPA built with Vite, styled with custom CSS tokens, managed with React Router DOM.
* **API Client:** Centralized Axios instance (`frontend/src/api/client.js`) configured with:
  * Automatic `Authorization: Bearer <access_token>` injection.
  * Automatic CSRF / Cookie transport.
  * 401 interception for logout and token refresh triggers.
* **Backend:** FastAPI (Python 3.11/3.14) serving `/api/v1/*` endpoints.
* **Persistence Tier (Polyglot):**
  * **PostgreSQL 15:** Core relational data (Users, Roles, Courses, Timetables, Sessions, Attendance Records).
  * **Redis 7:** High-speed in-memory store (Login rate limits, Failed attempt lockouts, JWT revocation blacklist, Active sessions).
  * **MongoDB 6.0:** High-throughput document store (Sanitized & redacted security audit trails).

---

## 🏛️ Comprehensive Page-to-API Mapping

```
                                  ┌────────────────────────┐
                                  │   React Frontend       │
                                  │   (Axios Client)       │
                                  └───────────┬────────────┘
                                              │ HTTP / JSON
                                              ▼
                                  ┌────────────────────────┐
                                  │   FastAPI Gateway      │
                                  │   (/api/v1/*)          │
                                  └─────┬─────┬─────┬──────┘
                                        │     │     │
                 ┌──────────────────────┘     │     └─────────────────────┐
                 ▼                            ▼                           ▼
        ┌─────────────────┐          ┌─────────────────┐         ┌─────────────────┐
        │   PostgreSQL    │          │     Redis 7     │         │   MongoDB 6.0   │
        │ (Relational DB) │          │ (Cache/Security)│         │ (Audit Trail)   │
        │                 │          │                 │         │                 │
        │ • Users & Roles │          │ • fail:{email}  │         │ • audit_logs    │
        │ • Courses       │          │ • rl:login:{ip} │         │   (redacted)    │
        │ • Attendance    │          │ • rl:upload:{id}│         │                 │
        │ • Timetables    │          │ • blacklist:{t} │         │                 │
        └─────────────────┘          └─────────────────┘         └─────────────────┘
```

---

## 1. Authentication & Global Navigation

### 1.1 Login Page
* **File:** `frontend/src/pages/LoginPage.jsx` / `frontend/src/features/auth/SignInCard.jsx`
* **Route:** `/login`

| Method | Internal Endpoint | Request Payload | Response Data | Purpose & Viva Answer |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | `{ email, password }` | `{ access_token, token_type }` | Checks Redis `fail:{email}` key. Verifies Argon2 password hash. Resets failure counter on success or increments on failure. |
| `GET` | `/api/v1/me` | *Headers: Bearer Token* | `{ id, email, role, full_name, department_id }` | Fetches authenticated user profile immediately following login to bootstrap `AuthContext`. |
| `GET` | `/api/v1/me/permissions` | *Headers: Bearer Token* | `["course:edit", "attendance:upload", ...]` | Fetches RBAC permission scopes for client-side capability checking. |

### 1.2 Global Application Shell
* **File:** `frontend/src/layouts/AppShell.jsx`
* **Route:** Active on all authenticated pages

| Method | Internal Endpoint | Request Payload | Response Data | Purpose & Viva Answer |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notifications/unread-count` | None | `{ count: int }` | Polled by navigation bar to display unread badge icon. |

---

## 2. Student Portal

### 2.1 Student Home (Overview Dashboard)
* **File:** `frontend/src/pages/student/StudentHome.jsx`
* **Route:** `/student/home`

| Method | Internal Endpoint | Response Data | Purpose & Viva Answer |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/me/dashboard` | `[ { course_id, code, name, held, attended, attendance_pct, buffer, risk_band } ]` | **Primary single source of truth:** Calculates course-by-course attendance percentages, remaining buffer classes, and risk level. |
| `GET` | `/api/v1/me/warnings` | `[ { course_id, message, severity, attendance_pct } ]` | Alerts student if any course is approaching or below 75%. |
| `GET` | `/api/v1/notices/me` | `[ { id, title, body, priority, created_at } ]` | Department and institute announcements addressed to the student. |
| `GET` | `/api/v1/me/tasks?days=60` | `[ { task_id, title, course_code, due_date, type } ]` | Upcoming assignments, lab submissions, and quizzes within 60 days. |
| `GET` | `/api/v1/me/timetable` | `{ Monday: [ { slot_id, time, course, room } ], ... }` | Student's weekly class schedule. |

---

### 2.2 Student Course Detail & Attendance Buffer
* **File:** `frontend/src/pages/student/StudentCourseDetail.jsx`
* **Route:** `/student/courses/:id`

| Method | Internal Endpoint | Response Data | Purpose & Viva Answer |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/courses/:id` | Course syllabus, faculty instructor, total credits. | Course metadata. |
| `GET` | `/api/v1/attendance/students/:student_id/courses/:course_id/buffer` | `{ held, attended, pct, buffer, safe_to_miss, classes_needed_for_75 }` | **Attendance buffer logic:** Informs student how many classes they can safely miss without falling below 75%, or how many they must attend consecutively to recover. |
| `GET` | `/api/v1/attendance/students/:student_id/courses/:course_id/history` | `[ { session_date, slot, status: "PRESENT"|"ABSENT"|"EXCUSED" } ]` | Chronological session-by-session attendance history. |
| `GET` | `/api/v1/assignments?course_id=:id` | List of homework assignments and weights. | Course assignments. |
| `GET` | `/api/v1/risk/students/:student_id` | `{ overall_band, score, trend }` | Student's current risk assessment. |

---

### 2.3 Student Attendance Simulator & Risk Analysis
* **File:** `frontend/src/pages/student/StudentRisk.jsx`
* **Route:** `/student/risk`

| Method | Internal Endpoint | Request / Response | Purpose & Viva Answer |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/me/dashboard` | List of enrolled courses and attendance. | Baseline values for simulation slider. |
| `POST` | `/api/v1/me/simulate` | **Req:** `{ course_id: int, miss_count: int }`<br>**Res:** `{ projected_pct, projected_buffer, will_breach_75 }` | What-if simulation: Projects future percentage if student misses `miss_count` upcoming sessions. |

---

### 2.4 Student Calendar & Pressure Heatmap
* **File:** `frontend/src/pages/student/StudentCalendar.jsx`
* **Route:** `/student/calendar`

| Method | Internal Endpoint | Request / Response | Purpose & Viva Answer |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/me/calendar/:year/:month` | Scheduled lecture slots per calendar day. | Populates monthly calendar view. |
| `GET` | `/api/v1/me/pressure-forecast/:year/:month` | Days mapped to pressure index (Low, Medium, High). | Academic pressure heatmap based on deadline clustering. |
| `GET` | `/api/v1/me/holidays` | List of dates student marked as planned absence. | Highlights planned personal leaves. |
| `POST` | `/api/v1/me/holidays` | **Req:** `{ holiday_date: "YYYY-MM-DD", reason: str }` | Saves planned absence to database. |
| `DELETE`| `/api/v1/me/holidays/:date` | None | Resets / deletes planned absence. |
| `POST` | `/api/v1/me/plan/project` | **Req:** `{ planned_dates: ["YYYY-MM-DD", ...] }` | Calculates projected attendance impact of all planned leaves. |

---

### 2.5 Student Assignment Detail & Submissions
* **File:** `frontend/src/pages/student/StudentAssignmentDetail.jsx`
* **Route:** `/student/assignments/:id`

| Method | Internal Endpoint | Request / Response | Purpose & Viva Answer |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/assignments/:id` | Rubric, deadline, instructions, max score. | Assignment requirements. |
| `GET` | `/api/v1/submissions?assignment_id=:id` | Previous submission status, grade, feedback. | Displays past student upload. |
| `POST` | `/api/v1/submissions` | **Req:** `{ assignment_id: int, content: str, file_url: str }` | Submits homework solution before deadline. |

---

## 3. Faculty & Mentor Portal

### 3.1 Faculty Home (Lecture Schedule & Roster)
* **File:** `frontend/src/pages/faculty/FacultyHome.jsx`
* **Route:** `/faculty/home`

| Method | Internal Endpoint | Response Data | Purpose & Viva Answer |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/me/dashboard` | `[ { course_id, code, name, enrolled_count, avg_attendance, total_classes } ]` | Faculty course cards showing assigned student count and class average attendance. |
| `GET` | `/api/v1/me/timetable` | Today's teaching schedule with room assignments. | Faculty daily timetable. |
| `GET` | `/api/v1/mentor/students` | List of assigned student mentees. | Mentorship quick-summary panel. |

---

### 3.2 Bulk Attendance Upload & Preview
* **File:** `frontend/src/pages/faculty/FacultyAttendanceUpload.jsx`
* **Route:** `/faculty/courses/:id/attendance`

| Method | Internal Endpoint | Request / Response | Purpose & Viva Answer |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/courses/:id/attendance/preview` | **Req:** `multipart/form-data (file: CSV/XLSX)`<br>**Res:** `{ valid_rows: int, invalid_rows: int, preview_items: [...] }` | **Two-phase upload:** Validates column formatting and student IDs *in-memory* without mutating database. |
| `POST` | `/api/v1/attendance/upload` | **Req:** `multipart/form-data (file, course_id, change_reason)`<br>**Res:** `{ records_created: int, records_updated: int }` | Commits verified attendance to PostgreSQL. Writes structured audit entry to **MongoDB** if attendance is edited or excused. |

---

### 3.3 Live Lecture Attendance Marking
* **File:** `frontend/src/pages/faculty/FacultyCourseDetail.jsx`
* **Route:** `/faculty/courses/:id`

| Method | Internal Endpoint | Request / Response | Purpose & Viva Answer |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/students?course_id=:id` | List of all enrolled students in the section. | Class roster. |
| `POST` | `/api/v1/attendance/sessions` | **Req:** `{ course_id, session_date, start_time, session_type }` | Creates a new lecture entry in `attendance_sessions`. |
| `POST` | `/api/v1/attendance/sessions/:id/mark` | **Req:** `{ records: [ { student_id, status: "PRESENT"|"ABSENT" } ] }` | Commits attendance for every student in the session. |

---

### 3.4 Mentorship 360-Degree Profile
* **File:** `frontend/src/pages/faculty/FacultyMenteeDetail.jsx`
* **Route:** `/faculty/mentees/:id`

| Method | Internal Endpoint | Response Data | Purpose & Viva Answer |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/mentor/students/:id` | Mentee bio, department, GPA, overall attendance. | High-level mentee profile. |
| `GET` | `/api/v1/mentor/students/:id/courses` | Breakdown of mentee's attendance across all faculty. | Cross-course performance monitoring. |
| `GET` | `/api/v1/mentor/students/:id/notes` | Past private mentor counseling logs. | Counseling history. |
| `POST` | `/api/v1/mentor/students/:id/notes` | **Req:** `{ note: str }` | Appends a timestamped mentorship entry. |

---

### 3.5 At-Risk Student Intervention
* **File:** `frontend/src/pages/faculty/FacultyAtRisk.jsx`
* **Route:** `/faculty/courses/:id/at-risk`

| Method | Internal Endpoint | Request / Response | Purpose & Viva Answer |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/risk/courses/:id` | `[ { student_id, name, attendance_pct, risk_band, risk_score } ]` | Retrieves students below 75% or flagged with negative attendance velocity. |
| `POST` | `/api/v1/notifications` | **Req:** `{ user_id, title: "Attendance Warning", message: str, type: "warning" }` | Direct intervention: Sends automated warning nudge to the student. |

---

## 4. Coordinator Portal

### 4.1 Visual Timetable Grid Editor
* **File:** `frontend/src/pages/coordinator/CoordinatorTimetableEditor.jsx`
* **Route:** `/coordinator/timetable`

| Method | Internal Endpoint | Purpose & Viva Answer |
| :--- | :--- | :--- |
| `GET` | `/api/v1/coordinator/overview` | Loads department semester parameters. |
| `GET` | `/api/v1/coordinator/teachers` | Loads department faculty list for slot assignment. |
| `GET` | `/api/v1/courses` | Loads course catalog for scheduling. |
| `GET` | `/api/v1/timetable/rooms` | Lists available lecture halls and labs. |
| `GET` | `/api/v1/timetable/draft?department_id=...` | Retrieves currently saved draft schedule grid. |
| `PUT` | `/api/v1/timetable/draft` | **Req:** `[ { day, slot_id, course_id, teacher_id, room_id } ]` → Saves draft in progress. |
| `POST`| `/api/v1/timetable/draft/validate` | Detects clashes (e.g., same teacher or room assigned to multiple classes simultaneously). |
| `POST`| `/api/v1/timetable/publish` | Promotes draft to the official, active timetable version for students and faculty. |

---

### 4.2 Deadline Load & Academic Friction Analyzer
* **File:** `frontend/src/pages/coordinator/CoordinatorDeadlines.jsx`
* **Route:** `/coordinator/deadlines`

| Method | Internal Endpoint | Purpose & Viva Answer |
| :--- | :--- | :--- |
| `GET` | `/api/v1/coordinator/deadline-load` | Cross-course friction analysis: Aggregates assignment deadlines across all courses in a semester to identify overloaded dates. |

---

## 5. Admin Portal (Security & Infrastructure Specialty)

### 5.1 Admin System Health
* **File:** `frontend/src/pages/admin/AdminDashboard.jsx`
* **Route:** `/admin`

| Method | Internal Endpoint | Response Data | Purpose & Viva Answer |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/stats` | `{ total_users, students_count, faculty_count, active_sessions, db_size }` | Monitors overall platform health and resource utilization. |

---

### 5.2 Security Audit Trail (MongoDB Driven)
* **File:** `frontend/src/pages/admin/AdminAuditLog.jsx`
* **Route:** `/admin/audit`

| Method | Internal Endpoint | Purpose & Viva Answer |
| :--- | :--- | :--- |
| `GET` | `/api/v1/admin/audit-logs` | Queries compliance audit trail. Shows timestamped records of attendance overrides, failed login lockout incidents, and permission changes with secrets redacted (`[REDACTED]`). |

---

### 5.3 User & RBAC Management
* **File:** `frontend/src/pages/admin/AdminUsers.jsx`
* **Route:** `/admin/users`

| Method | Internal Endpoint | Request / Response | Purpose & Viva Answer |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/users` | List of all system users, roles, and account statuses. | User table. |
| `POST`| `/api/v1/admin/users` | **Req:** `{ email, password, full_name, role, department_id }` | Provisions new user accounts. Hashes passwords with Argon2. |
| `PATCH`| `/api/v1/admin/users/:id` | **Req:** `{ is_active: bool, role: str }` | Enables, disables, or updates user role. |

---

## 6. Notice Broadcast System

### 6.1 Compose & Broadcast Notice (with NLP Extraction)
* **File:** `frontend/src/pages/notices/ComposeNotice.jsx`
* **Route:** `/notices/new`

| Method | Internal Endpoint | Request / Response | Purpose & Viva Answer |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/notices/extract` | **Req:** `{ body: str }`<br>**Res:** `{ extracted_deadlines: ["YYYY-MM-DD", ...] }` | Uses regex/NLP extraction to detect dates in text bodies and suggest calendar entries. |
| `POST` | `/api/v1/notices/audience/preview` | **Req:** `{ target_role: str, department_id: int }`<br>**Res:** `{ estimated_recipients: int }` | Previews target recipient count before sending. |
| `POST` | `/api/v1/notices` | **Req:** `{ title, body, priority, target_filters }` | Broadcasts notice and queues push notifications. |

---

## 7. Master Cheatsheet for Rapid Viva Answering

| Viva Question | Exact Endpoint to Mention | HTTP Method | Database |
| :--- | :--- | :--- | :--- |
| **"Where does login happen?"** | `/api/v1/auth/login` | `POST` | Redis (lockouts) + PostgreSQL |
| **"What powers the student attendance percentage?"** | `/api/v1/me/dashboard` & `/attendance/.../buffer` | `GET` | PostgreSQL (`attendance_records`) |
| **"What calculates how many classes a student can miss?"** | `/api/v1/attendance/students/:id/courses/:id/buffer` | `GET` | PostgreSQL |
| **"What API tests 'what if I miss classes'?"** | `/api/v1/me/simulate` | `POST` | PostgreSQL (In-memory projection) |
| **"How is attendance uploaded in bulk?"** | `/courses/:id/attendance/preview` & `/attendance/upload`| `POST` | PostgreSQL + MongoDB (Audit) |
| **"Where are attendance excusals audited?"** | `/api/v1/admin/audit-logs` | `GET` | MongoDB (`audit_logs` collection) |
| **"How does the Coordinator detect room clashes?"** | `/api/v1/timetable/draft/validate` | `POST` | PostgreSQL (`timetable_slots`) |
| **"How does the Coordinator find deadline overload?"** | `/api/v1/coordinator/deadline-load` | `GET` | PostgreSQL (`assignments`) |
| **"Where is password hashing and user creation handled?"** | `/api/v1/admin/users` | `POST` | PostgreSQL (Argon2id hashing) |
