# AcadFlow — Member 2 Security & Infrastructure Integration Guide
> Author: Member 2 (Security & Infrastructure)  
> Target: Member 1 (Liza - Backend & Database Lead)  
> Scope: Evaluation 1 Backend Integration

---

## 1. Overview & Architecture Handshake

All Security and Infrastructure components for **Evaluation 1** have been implemented, tested, and isolated behind clean interfaces. They preserve your ownership of SQLAlchemy models, Alembic migrations, PostgreSQL session dependencies, and router endpoints.

All components have 100% test passing rates in `backend/tests/security/` (28/28 tests passing).

---

## 2. Integration Interfaces

### A. Central Authorization & Scope Checking (`app.core.authorization`)

Use `can_access(user, action, resource)` or the FastAPI dependency `require_access(action, resource_getter)`.

#### Usage Example in Endpoints:
```python
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.core.authorization import can_access, verify_access, Action, sanitize_coordinator_view

router = APIRouter()

# 1. Course Editing (Faculty / Admin)
@router.put("/{course_id}")
async def update_course(course_id: int, payload: dict, current_user: dict = Depends(get_current_user)):
    # Resource representation contains course_id
    resource = {"course_id": course_id}
    verify_access(current_user, Action.EDIT_COURSE, resource)
    # Proceed with DB update...

# 2. Coordinator Record View (Restricted to approved fields + audited)
@router.get("/students/{student_id}")
async def get_coordinator_student_record(student_id: int, current_user: dict = Depends(get_current_user)):
    # 1. Verify coordinator belongs to same department as student
    student_record = await fetch_student_from_db(student_id)
    verify_access(current_user, Action.VIEW_COORDINATOR_RECORD, {"department_id": student_record.department_id})
    
    # 2. Audit record access
    await audit_logger.log_event(
        actor_id=current_user["id"],
        actor_role=current_user["role"],
        action=AuditAction.COORDINATOR_RECORD_ACCESS,
        resource_type="student_record",
        resource_id=student_id,
        outcome="SUCCESS"
    )
    
    # 3. Strip sensitive fields (passwords, raw submission content, private notes)
    return sanitize_coordinator_view(student_record.__dict__)
```

---

### B. Login Lockout & Rate Limiting (`POST /api/v1/auth/login`)

```python
from app.core.rate_limit import login_rate_limiter, get_client_ip
from app.core.lockout import lockout_policy
from app.core.tokens import token_service
from app.core.security import verify_password

@router.post("/login")
async def login(credentials: LoginRequest, request: Request):
    client_ip = get_client_ip(request)
    
    # 1. Rate Limiting (10 req/min burst protection)
    await login_rate_limiter.check(client_ip)
    
    # 2. Check Lockout Status
    is_locked, remaining_seconds = await lockout_policy.is_locked(credentials.email)
    if is_locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": {"code": "RATE_429", "message": f"Account temporarily locked due to repeated failed logins. Retry in {remaining_seconds}s."}}
        )
    
    # 3. Authenticate User against Database
    user = await get_user_by_email(credentials.email)
    if not user or not verify_password(credentials.password, user.password_hash):
        # Record failed attempt atomically
        _, is_now_locked = await lockout_policy.record_failed_attempt(credentials.email)
        # Uniform message to prevent user enumeration
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # 4. Success -> Reset lockout counter
    await lockout_policy.reset_lockout(credentials.email)
    
    # 5. Issue Tokens
    access_token = token_service.create_access_token(user_id=user.id, role=user.role)
    refresh_token = token_service.create_refresh_token(user_id=user.id, role=user.role)
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}
```

---

### C. Refresh Token Rotation & Revocation (`POST /api/v1/auth/refresh` & `/logout`)

```python
@router.post("/refresh")
async def refresh_tokens(refresh_token: str):
    tokens = await token_service.rotate_refresh_token(refresh_token)
    if not tokens:
        raise HTTPException(status_code=401, detail="Invalid or revoked refresh token")
    new_access, new_refresh = tokens
    return {"access_token": new_access, "refresh_token": new_refresh, "token_type": "bearer"}

@router.post("/logout")
async def logout(current_token_payload: dict = Depends(get_current_user)):
    jti = current_token_payload.get("jti")
    if jti:
        await token_service.revoke_token(jti)
    return {"message": "Successfully logged out"}
```

---

### D. Session-Cookie Authentication (`POST /api/v1/auth/session/login`)

```python
from app.core.session import session_store, get_session_cookie_settings

@router.post("/session/login")
async def session_login(credentials: LoginRequest, response: Response):
    user = await authenticate_user(credentials.email, credentials.password)
    session_id = await session_store.create_session(user_id=user.id, role=user.role)
    
    cookie_kwargs = get_session_cookie_settings(is_production=(settings.ENVIRONMENT == "production"))
    response.set_cookie(value=session_id, **cookie_kwargs)
    return {"message": "Session authenticated successfully"}
```

---

### E. Audit Logging Events (`app.core.audit`)

Whenever attendance is edited, excusals are made, or due dates are changed, call `audit_logger.log_event`:
```python
from app.core.audit import audit_logger, AuditAction

await audit_logger.log_event(
    actor_id=current_user["id"],
    actor_role=current_user["role"],
    action=AuditAction.ATTENDANCE_EXCUSAL,
    resource_type="attendance_record",
    resource_id=record_id,
    outcome="SUCCESS",
    metadata={"reason": excusal_reason, "course_id": course_id}
)
```

---

## 3. Infrastructure & Compose Stack

- **NGINX Reverse Proxy**: Configured at `deploy/nginx/nginx.conf` and added to `deploy/docker-compose.yml`. Listens on port 80.
- **Two API Replicas**: `backend-1` and `backend-2` are defined in `deploy/docker-compose.yml` to satisfy PRD high-availability balancing.
- **Healthchecks**: Configured for `postgres`, `redis`, and `mongo` with `service_healthy` dependencies.
- **Max Upload Limit**: Enforced at 15MB via NGINX (`client_max_body_size`).
