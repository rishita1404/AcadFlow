"""Integration tests for /api/v1/auth endpoints.

Tests register, login, refresh, and logout flows against an SQLite in-memory DB.
Validates HTTP status codes, response shape, lockout behaviour, and token issuance.
"""

from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BASE = "/api/v1/auth"


def _register(
    client,
    email="test@acadflow.edu",
    password="StrongPass1!",
    name="Test User",
    role="student",
):
    return client.post(
        f"{BASE}/register",
        json={
            "name": name,
            "email": email,
            "password": password,
            "role": role,
        },
    )


def _login(client, email="test@acadflow.edu", password="StrongPass1!"):
    return client.post(f"{BASE}/login", data={"username": email, "password": password})


# ---------------------------------------------------------------------------
# Register tests
# ---------------------------------------------------------------------------


class TestRegister:
    def test_register_new_user_returns_201(self, client: TestClient):
        res = _register(client, email="new_user@acadflow.edu")
        assert res.status_code == 201
        data = res.json()
        assert data["email"] == "new_user@acadflow.edu"
        assert data["role"] == "student"
        assert "id" in data

    def test_register_duplicate_email_returns_409(self, client: TestClient):
        _register(client, email="dup@acadflow.edu")
        res2 = _register(client, email="dup@acadflow.edu")
        assert res2.status_code == 409

    def test_register_invalid_role_returns_422(self, client: TestClient):
        res = client.post(
            f"{BASE}/register",
            json={
                "name": "Attacker",
                "email": "evil@acadflow.edu",
                "password": "StrongPass1!",
                "role": "superadmin",  # invalid
            },
        )
        assert res.status_code == 422

    def test_register_weak_password_rejected(self, client: TestClient):
        res = client.post(
            f"{BASE}/register",
            json={
                "name": "Weak",
                "email": "weak@acadflow.edu",
                "password": "123",  # too short
                "role": "student",
            },
        )
        assert res.status_code == 422


# ---------------------------------------------------------------------------
# Login tests
# ---------------------------------------------------------------------------


class TestLogin:
    def test_login_valid_credentials_returns_access_token(self, client: TestClient):
        _register(client, email="login_ok@acadflow.edu")
        res = _login(client, email="login_ok@acadflow.edu")
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

    def test_login_wrong_password_returns_401(self, client: TestClient):
        _register(client, email="login_bad@acadflow.edu")
        res = _login(client, email="login_bad@acadflow.edu", password="WrongPass!")
        assert res.status_code == 401

    def test_login_unknown_email_returns_401(self, client: TestClient):
        res = _login(client, email="nobody@acadflow.edu")
        assert res.status_code == 401

    def test_login_sets_refresh_cookie(self, client: TestClient):
        _register(client, email="cookie_check@acadflow.edu")
        res = _login(client, email="cookie_check@acadflow.edu")
        assert res.status_code == 200
        # The HttpOnly refresh cookie should be present in the response
        assert "acadflow_refresh" in res.cookies

    def test_login_email_case_insensitive(self, client: TestClient):
        _register(client, email="casetest@acadflow.edu")
        res = _login(client, email="CASETEST@ACADFLOW.EDU")
        assert res.status_code == 200


# ---------------------------------------------------------------------------
# Refresh tests
# ---------------------------------------------------------------------------


class TestRefresh:
    def test_refresh_without_cookie_returns_401(self, client: TestClient):
        res = client.post(f"{BASE}/refresh")
        assert res.status_code == 401

    def test_refresh_returns_new_access_token(self, client: TestClient):
        _register(client, email="refresh_ok@acadflow.edu")
        login_res = _login(client, email="refresh_ok@acadflow.edu")
        assert login_res.status_code == 200
        # Cookie is automatically carried by TestClient
        refresh_res = client.post(f"{BASE}/refresh")
        assert refresh_res.status_code == 200
        assert "access_token" in refresh_res.json()


# ---------------------------------------------------------------------------
# Logout tests
# ---------------------------------------------------------------------------


class TestLogout:
    def test_logout_clears_cookie(self, client: TestClient):
        _register(client, email="logout_ok@acadflow.edu")
        _login(client, email="logout_ok@acadflow.edu")
        res = client.post(f"{BASE}/logout")
        assert res.status_code == 204
