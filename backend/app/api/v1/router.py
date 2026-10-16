from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    assignments,
    attendance,
    auth,
    coordinator,
    courses,
    health,
    mentor,
    notifications,
    risk,
    submissions,
)

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(courses.router, prefix="/courses", tags=["Courses"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["Attendance"])
api_router.include_router(
    assignments.router, prefix="/assignments", tags=["Assignments"]
)
api_router.include_router(
    submissions.router, prefix="/submissions", tags=["Submissions"]
)
api_router.include_router(
    notifications.router, prefix="/notifications", tags=["Notifications"]
)
api_router.include_router(risk.router, prefix="/risk", tags=["Risk"])
api_router.include_router(mentor.router, prefix="/mentor", tags=["Mentor"])
api_router.include_router(
    coordinator.router, prefix="/coordinator", tags=["Coordinator"]
)
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
