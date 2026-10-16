from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def get_health_index():
    return {"endpoint": "health", "status": "active"}
