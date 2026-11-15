"""
Server-Sent Events (SSE) Endpoint — AcadFlow.

GET /api/v1/events: Authenticated, role-scoped real-time event streaming.
Pushes 'attendance_updated' and 'risk_changed' events to coordinator and faculty dashboards.
"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_user
from app.models import UserModel
from app.services.event_bus import event_bus

router = APIRouter()


@router.get("/events", summary="Role-scoped Server-Sent Events stream")
async def sse_event_stream(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Establish a real-time Server-Sent Events connection.
    Streams role-scoped events: attendance_updated, risk_changed, notices.
    """
    user_id = int(current_user["sub"]) if "sub" in current_user else current_user.get("id", 0)
    role = current_user.get("role", "student")
    dept_id = current_user.get("department_id")

    async def event_generator():
        is_test = request.query_params.get("test") == "1"
        async for msg in event_bus.subscribe(user_id, role, dept_id):
            if await request.is_disconnected():
                break
            yield f"event: {msg['event']}\ndata: {msg['data']}\n\n"
            if is_test:
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
