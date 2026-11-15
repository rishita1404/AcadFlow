"""Phase 0 integration tests — Auth registration role lockdown.

Verifies that POST /auth/register always creates users with role='student'
regardless of the role field in the request payload.
"""

from fastapi.testclient import TestClient

BASE = "/api/v1/auth"


class TestRegisterRoleLockdown:
    def test_register_with_admin_role_gets_student(self, client: TestClient):
        """Sending role='admin' must still create a student account (HTTP 200/201)."""
        res = client.post(
            f"{BASE}/register",
            json={
                "name": "Evil Attacker",
                "email": "attacker_phase0@acadflow.edu",
                "password": "StrongPass1!",
                "role": "admin",
            },
        )
        # Should succeed (200 or 201), not 422
        assert res.status_code in (200, 201), f"Expected 200/201, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["role"] == "student", f"Expected role='student', got '{data['role']}'"

    def test_register_with_faculty_role_gets_student(self, client: TestClient):
        """Sending role='faculty' must still create a student account."""
        res = client.post(
            f"{BASE}/register",
            json={
                "name": "Fake Faculty",
                "email": "fakefaculty_phase0@acadflow.edu",
                "password": "StrongPass1!",
                "role": "faculty",
            },
        )
        assert res.status_code in (200, 201)
        data = res.json()
        assert data["role"] == "student"

    def test_register_with_coordinator_role_gets_student(self, client: TestClient):
        """Sending role='coordinator' must still create a student account."""
        res = client.post(
            f"{BASE}/register",
            json={
                "name": "Fake Coordinator",
                "email": "fakecoord_phase0@acadflow.edu",
                "password": "StrongPass1!",
                "role": "coordinator",
            },
        )
        assert res.status_code in (200, 201)
        data = res.json()
        assert data["role"] == "student"

    def test_register_with_student_role_gets_student(self, client: TestClient):
        """Explicitly sending role='student' also results in student account."""
        res = client.post(
            f"{BASE}/register",
            json={
                "name": "Normal Student",
                "email": "normal_phase0@acadflow.edu",
                "password": "StrongPass1!",
                "role": "student",
            },
        )
        assert res.status_code in (200, 201)
        data = res.json()
        assert data["role"] == "student"

    def test_register_without_role_gets_student(self, client: TestClient):
        """Omitting role defaults to student account."""
        res = client.post(
            f"{BASE}/register",
            json={
                "name": "Default Role User",
                "email": "defaultrole_phase0@acadflow.edu",
                "password": "StrongPass1!",
            },
        )
        assert res.status_code in (200, 201)
        data = res.json()
        assert data["role"] == "student"
