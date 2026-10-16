from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def get_attendance_index():
    return {"endpoint": "attendance", "status": "active"}
