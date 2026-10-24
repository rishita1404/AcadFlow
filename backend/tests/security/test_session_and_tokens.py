import pytest

from app.core.permissions import Role
from app.core.session import SessionStore, get_session_cookie_settings
from app.core.tokens import TokenService


@pytest.mark.asyncio
async def test_session_lifecycle():
    store = SessionStore(client=None)  # Use internal fallback store

    # Create session
    session_id = await store.create_session(
        user_id=101, role=Role.STUDENT.value, metadata={"ip": "127.0.0.1"}
    )
    assert session_id is not None
    assert len(session_id) >= 32

    # Retrieve session
    data = await store.get_session(session_id)
    assert data is not None
    assert data["user_id"] == "101"
    assert data["role"] == Role.STUDENT.value
    assert data["metadata"]["ip"] == "127.0.0.1"

    # Revoke/destroy session
    destroyed = await store.destroy_session(session_id)
    assert destroyed is True

    # Re-fetch should yield None
    expired_data = await store.get_session(session_id)
    assert expired_data is None


def test_session_cookie_security_flags():
    dev_cookie = get_session_cookie_settings(is_production=False)
    assert dev_cookie["httponly"] is True
    assert dev_cookie["samesite"] == "lax"
    assert dev_cookie["secure"] is False

    prod_cookie = get_session_cookie_settings(is_production=True)
    assert prod_cookie["httponly"] is True
    assert prod_cookie["samesite"] == "lax"
    assert prod_cookie["secure"] is True


@pytest.mark.asyncio
async def test_access_token_creation_and_verification():
    ts = TokenService(client=None)
    token = ts.create_access_token(user_id=202, role=Role.FACULTY.value)

    payload = await ts.verify_token(token, expected_type="access")
    assert payload is not None
    assert payload["sub"] == "202"
    assert payload["role"] == Role.FACULTY.value
    assert payload["type"] == "access"
    assert payload["iss"] == "acadflow"
    assert payload["aud"] == "acadflow-web"

    # Wrong type verification must reject
    assert await ts.verify_token(token, expected_type="refresh") is None


@pytest.mark.asyncio
async def test_refresh_token_rotation_and_revocation():
    ts = TokenService(client=None)
    refresh_token = ts.create_refresh_token(user_id=303, role=Role.MENTOR.value)

    # First rotation should succeed
    rotation_result = await ts.rotate_refresh_token(refresh_token)
    assert rotation_result is not None
    new_access, new_refresh = rotation_result
    assert new_access is not None
    assert new_refresh is not None
    assert new_refresh != refresh_token

    # Verify new access token works
    new_access_payload = await ts.verify_token(new_access, expected_type="access")
    assert new_access_payload["sub"] == "303"

    # Replaying the OLD refresh token MUST FAIL (Replay attack detection)
    replayed_result = await ts.rotate_refresh_token(refresh_token)
    assert replayed_result is None
