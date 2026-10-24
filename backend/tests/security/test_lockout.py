import pytest

from app.core.lockout import LockoutPolicy


@pytest.mark.asyncio
async def test_lockout_threshold_trigger():
    policy = LockoutPolicy(client=None, max_attempts=3, lockout_duration_seconds=10)
    email = "attacker@acadflow.edu"

    # Attempt 1
    attempts, is_locked = await policy.record_failed_attempt(email)
    assert attempts == 1
    assert is_locked is False
    locked, remaining = await policy.is_locked(email)
    assert locked is False

    # Attempt 2
    attempts, is_locked = await policy.record_failed_attempt(email)
    assert attempts == 2
    assert is_locked is False

    # Attempt 3 -> hits threshold of 3
    attempts, is_locked = await policy.record_failed_attempt(email)
    assert attempts == 3
    assert is_locked is True

    # Account is now locked
    locked, remaining = await policy.is_locked(email)
    assert locked is True
    assert remaining > 0


@pytest.mark.asyncio
async def test_lockout_successful_reset():
    policy = LockoutPolicy(client=None, max_attempts=3, lockout_duration_seconds=10)
    email = "faculty@acadflow.edu"

    # 2 failed attempts
    await policy.record_failed_attempt(email)
    await policy.record_failed_attempt(email)

    # Successful login resets the counter
    await policy.reset_lockout(email)

    locked, _ = await policy.is_locked(email)
    assert locked is False

    # Next attempt should start count from 1, not 3
    attempts, is_locked = await policy.record_failed_attempt(email)
    assert attempts == 1
    assert is_locked is False


@pytest.mark.asyncio
async def test_lockout_case_insensitivity():
    policy = LockoutPolicy(client=None, max_attempts=2, lockout_duration_seconds=10)

    await policy.record_failed_attempt("Student@AcadFlow.EDU")
    attempts, is_locked = await policy.record_failed_attempt("student@acadflow.edu")

    assert attempts == 2
    assert is_locked is True
    locked, _ = await policy.is_locked("STUDENT@ACADFLOW.EDU")
    assert locked is True
