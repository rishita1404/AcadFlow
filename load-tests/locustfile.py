"""
Locust Performance and Load Testing Suite — AcadFlow (Lab 21 - Evaluation 2).
Simulates realistic student and coordinator multi-role user workflows:
- User Authentication (POST /api/v1/auth/login)
- Student Academic Dashboard (GET /api/v1/me/dashboard)
- Coordinator Cohort Summary (GET /api/v1/coordinator/summary)
- Virtualized Directory Pagination (GET /api/v1/coordinator/students)
- System Health & Telemetry (GET /health, GET /metrics)
"""
from locust import HttpUser, task, between


class StudentLoadUser(HttpUser):
    wait_time = between(1.0, 3.0)
    token = None

    def on_start(self):
        """Authenticate student and store bearer token."""
        res = self.client.post(
            "/api/v1/auth/login",
            data={"username": "student@acadflow.edu", "password": "AcadFlow@123"},
            name="/api/v1/auth/login (Student)",
        )
        if res.status_code == 200:
            self.token = res.json().get("access_token")

    @property
    def auth_headers(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task(5)
    def view_student_dashboard(self):
        self.client.get(
            "/api/v1/me/dashboard",
            headers=self.auth_headers,
            name="/api/v1/me/dashboard",
        )

    @task(3)
    def view_notifications(self):
        self.client.get(
            "/api/v1/notifications?limit=20&offset=0",
            headers=self.auth_headers,
            name="/api/v1/notifications",
        )

    @task(2)
    def view_timetable(self):
        self.client.get(
            "/api/v1/timetable/me",
            headers=self.auth_headers,
            name="/api/v1/timetable/me",
        )


class CoordinatorLoadUser(HttpUser):
    wait_time = between(1.0, 2.5)
    token = None

    def on_start(self):
        """Authenticate department coordinator."""
        res = self.client.post(
            "/api/v1/auth/login",
            data={"username": "coordinator@acadflow.edu", "password": "AcadFlow@123"},
            name="/api/v1/auth/login (Coordinator)",
        )
        if res.status_code == 200:
            self.token = res.json().get("access_token")

    @property
    def auth_headers(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task(6)
    def view_coordinator_summary(self):
        self.client.get(
            "/api/v1/coordinator/summary",
            headers=self.auth_headers,
            name="/api/v1/coordinator/summary",
        )

    @task(4)
    def paginate_students_directory_page_1(self):
        self.client.get(
            "/api/v1/coordinator/students?limit=50&offset=0&sort=roll_no",
            headers=self.auth_headers,
            name="/api/v1/coordinator/students?page=1",
        )

    @task(3)
    def paginate_students_directory_page_2(self):
        self.client.get(
            "/api/v1/coordinator/students?limit=50&offset=50&sort=roll_no",
            headers=self.auth_headers,
            name="/api/v1/coordinator/students?page=2",
        )

    @task(2)
    def filter_students_by_band(self):
        self.client.get(
            "/api/v1/coordinator/students?limit=50&band=at_risk",
            headers=self.auth_headers,
            name="/api/v1/coordinator/students?band=at_risk",
        )

    @task(2)
    def view_deadline_load(self):
        self.client.get(
            "/api/v1/coordinator/deadline-load",
            headers=self.auth_headers,
            name="/api/v1/coordinator/deadline-load",
        )
