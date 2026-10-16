"""
Audit Logging Service for AcadFlow.

Implements PRD Section 4 & 6 compliance requirements:
Audits critical academic actions:
- Attendance edits
- Attendance excusals (with required reason)
- Due-date changes
- Administrative configuration changes
- Coordinator access to individual student records

Security & Privacy Guarantees:
- Strict automated redaction of passwords, tokens, session IDs, authorization headers.
- Persistent sink to MongoDB 'audit_logs' collection.
- In-memory inspection fallback for offline testing.
- No competing PostgreSQL audit migrations (preserves Liza's relational schema).
"""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
try:
    from app.db.mongo import mongo_db
except Exception:
    mongo_db = None


class AuditAction(str, Enum):
    ATTENDANCE_EDIT = "attendance_edit"
    ATTENDANCE_EXCUSAL = "attendance_excusal"
    DUE_DATE_CHANGE = "due_date_change"
    ADMIN_CONFIG_CHANGE = "admin_config_change"
    COORDINATOR_RECORD_ACCESS = "coordinator_record_access"


SENSITIVE_FIELD_NAMES = {
    "password",
    "password_hash",
    "secret",
    "token",
    "access_token",
    "refresh_token",
    "session_id",
    "authorization",
    "cookie",
    "submission_content",
}


def redact_sensitive_data(data: Any) -> Any:
    """
    Recursively traverse dictionary/lists and replace sensitive field values with '[REDACTED]'.
    """
    if isinstance(data, dict):
        cleaned = {}
        for k, v in data.items():
            if any(sensitive in k.lower() for sensitive in SENSITIVE_FIELD_NAMES):
                cleaned[k] = "[REDACTED]"
            else:
                cleaned[k] = redact_sensitive_data(v)
        return cleaned
    elif isinstance(data, list):
        return [redact_sensitive_data(item) for item in data]
    return data


class AuditLogger:
    def __init__(self, db=None):
        self.db = db if db is not None else mongo_db
        self._memory_sink: List[Dict[str, Any]] = []

    async def log_event(
        self,
        actor_id: int | str,
        actor_role: str,
        action: AuditAction | str,
        resource_type: str,
        resource_id: int | str,
        outcome: str = "SUCCESS",
        ip_address: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Record a sanitized, structured audit event.
        """
        clean_metadata = redact_sensitive_data(metadata or {})

        event = {
            "event_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "actor_id": str(actor_id),
            "actor_role": str(actor_role),
            "action": str(action.value if isinstance(action, AuditAction) else action),
            "resource_type": resource_type,
            "resource_id": str(resource_id),
            "outcome": outcome.upper(),
            "ip_address": ip_address or "unknown",
            "metadata": clean_metadata,
        }

        # Store in Mongo if available
        try:
            if self.db is not None:
                await self.db.audit_logs.insert_one(event.copy())
        except Exception as e:
            logger.warning(f"MongoDB audit sink unavailable, caching in-memory: {e}")

        # Always record in-memory sink for testing & liveness inspection
        self._memory_sink.append(event)
        return event

    def get_recent_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve recent events from in-memory fallback sink."""
        return self._memory_sink[-limit:]

    def clear_memory_sink(self) -> None:
        """Clear test events."""
        self._memory_sink.clear()


# Global instance
audit_logger = AuditLogger()
