import pytest

from app.core.audit import AuditAction, AuditLogger, redact_sensitive_data


def test_audit_sensitive_data_redaction():
    payload = {
        "user_email": "student@acadflow.edu",
        "action": "login",
        "password": "SuperSecretPassword123!",
        "access_token": "eyJhbGciOi...",
        "refresh_token": "d9834jh...",
        "session_id": "sess_894312...",
        "nested": {
            "auth_header": "Bearer secret_token",
            "safe_detail": "Course attendance update",
            "submission_content": "print('hello')",
        },
    }

    cleaned = redact_sensitive_data(payload)

    # Sensitive fields masked
    assert cleaned["password"] == "[REDACTED]"
    assert cleaned["access_token"] == "[REDACTED]"
    assert cleaned["refresh_token"] == "[REDACTED]"
    assert cleaned["session_id"] == "[REDACTED]"
    assert cleaned["nested"]["submission_content"] == "[REDACTED]"

    # Safe fields preserved
    assert cleaned["user_email"] == "student@acadflow.edu"
    assert cleaned["nested"]["safe_detail"] == "Course attendance update"


@pytest.mark.asyncio
async def test_audit_logger_event_creation():
    logger = AuditLogger(db=None)
    logger.clear_memory_sink()

    event = await logger.log_event(
        actor_id=202,
        actor_role="faculty",
        action=AuditAction.ATTENDANCE_EXCUSAL,
        resource_type="attendance_record",
        resource_id="att_901",
        outcome="SUCCESS",
        ip_address="192.168.1.50",
        metadata={
            "student_id": 501,
            "reason": "Medical certificate verified",
            "admin_token": "secret_internal_token",
        },
    )

    assert event["actor_id"] == "202"
    assert event["action"] == "attendance_excusal"
    assert event["resource_id"] == "att_901"
    assert event["outcome"] == "SUCCESS"
    assert event["metadata"]["reason"] == "Medical certificate verified"
    assert event["metadata"]["admin_token"] == "[REDACTED]"

    # Verified recorded in sink
    recent = logger.get_recent_events()
    assert len(recent) == 1
    assert recent[0]["event_id"] == event["event_id"]
