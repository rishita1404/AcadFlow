async def log_audit_event(user_id: int, action: str, target: str):
    """Log viewing and administrative events to MongoDB audit collection."""
